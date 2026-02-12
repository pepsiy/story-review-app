import { Request, Response } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, farmPlots, inventory, gameItems, gameLogs, missions } from "../../../../packages/db/src";
import { ITEM_TYPES, CULTIVATION_LEVELS, PLOT_UNLOCK_COSTS, WATER_CONFIG } from "../data/gameData";

// --- Helpers ---

const getUserGameState = async (userId: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) return null;

    const plots = await db.query.farmPlots.findMany({
        where: eq(farmPlots.userId, userId),
    });

    const userInventory = await db.query.inventory.findMany({
        where: eq(inventory.userId, userId),
    });

    const itemsDef = await db.query.gameItems.findMany();
    const itemsMap = itemsDef.reduce((acc, item) => {
        let parsedIngredients = null;
        if (item.ingredients) {
            try {
                parsedIngredients = typeof item.ingredients === 'string'
                    ? JSON.parse(item.ingredients)
                    : item.ingredients;
            } catch (e) {
                parsedIngredients = [];
            }
        }
        acc[item.id] = { ...item, ingredients: parsedIngredients };
        return acc;
    }, {} as Record<string, any>);

    // Parse active_buffs if string
    let parsedBuffs = [];
    if (user.activeBuffs) {
        try {
            parsedBuffs = typeof user.activeBuffs === 'string'
                ? JSON.parse(user.activeBuffs)
                : user.activeBuffs;
        } catch (e) { parsedBuffs = []; }
    }

    return {
        user: { ...user, activeBuffs: parsedBuffs },
        plots,
        inventory: userInventory,
        itemsDef: itemsMap
    };
};

const getGameLogsHelper = async (userId: string) => {
    return await db.query.gameLogs.findMany({
        where: or(eq(gameLogs.userId, userId), eq(gameLogs.targetUserId, userId)),
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        limit: 20
    });
};

// --- Controllers ---

export const getGameState = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const state = await getUserGameState(userId);
        if (!state) return res.status(404).json({ error: "User not found" });

        res.json(state);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// --- Mission Logic Helpers ---
const trackMissionProgress = async (userId: string, actionType: string, count: number = 1) => {
    try {
        // Direct DB access to avoid circular dependency issues
        const { userMissions, missions } = await import("../../../../packages/db/src");

        const activeMissions = await db.select({
            userMission: userMissions,
            missionDef: missions
        })
            .from(userMissions)
            .innerJoin(missions, eq(userMissions.missionId, missions.id))
            .where(and(
                eq(userMissions.userId, userId),
                eq(userMissions.status, 'IN_PROGRESS'),
                eq(missions.type, 'PROGRESS')
            ));

        // 2. Update progress
        for (const { userMission, missionDef } of activeMissions) {
            // Dynamic matching based on requiredAction field
            if (missionDef.requiredAction === actionType) {
                const newProgress = (userMission.progress || 0) + count;
                await db.update(userMissions)
                    .set({ progress: newProgress })
                    .where(eq(userMissions.id, userMission.id));
            }
        }
    } catch (e) {
        console.error("Track Progress Error:", e);
    }
}


export const buyItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId, quantity } = req.body;
        const qty = quantity || 1;

        const item = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!item || !item.price) return res.status(400).json({ error: "Item not available" });

        const cost = item.price * qty;

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < cost) return res.status(400).json({ error: "Not enough gold" });

        await db.transaction(async (tx) => {
            // Deduct Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - cost })
                .where(eq(users.id, userId));

            // Add Item
            const existingItem = await tx.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
            });

            if (existingItem) {
                await tx.update(inventory)
                    .set({ quantity: existingItem.quantity + qty })
                    .where(eq(inventory.id, existingItem.id));
            } else {
                await tx.insert(inventory).values({
                    userId,
                    itemId,
                    quantity: qty,
                    type: item.type
                });
            }
        });

        res.json({ success: true, message: `Bought ${qty} ${item.name}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Transaction failed" });
    }
};

export const sellItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId, quantity } = req.body;
        const qty = quantity || 1;

        const userItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
        });

        if (!userItem || userItem.quantity < qty) return res.status(400).json({ error: "Not enough items" });

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef || !itemDef.sellPrice) return res.status(400).json({ error: "Cannot sell this item" });

        const earn = itemDef.sellPrice * qty;

        await db.transaction(async (tx) => {
            // Remove Item
            if (userItem.quantity === qty) {
                await tx.delete(inventory).where(eq(inventory.id, userItem.id));
            } else {
                await tx.update(inventory)
                    .set({ quantity: userItem.quantity - qty })
                    .where(eq(inventory.id, userItem.id));
            }

            // Add Gold
            const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
            await tx.update(users)
                .set({ gold: (user?.gold || 0) + earn })
                .where(eq(users.id, userId));
        });

        res.json({ success: true, message: `Sold ${qty} ${itemDef.name} for ${earn} Gold` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Transaction failed" });
    }
};

export const craftItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId } = req.body;

        const recipe = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!recipe || !recipe.ingredients) return res.status(400).json({ error: "Invalid recipe" });

        let ingredients: { itemId: string, quantity: number }[] = [];
        try {
            ingredients = typeof recipe.ingredients === 'string'
                ? JSON.parse(recipe.ingredients)
                : recipe.ingredients;
        } catch (e) {
            return res.status(500).json({ error: "Recipe data error" });
        }

        // Check cost
        const cost = 100; // Hardcoded craft cost for now
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < cost) return res.status(400).json({ error: "Not enough gold (100)" });

        // Check ingredients
        for (const ing of ingredients) {
            const userInv = await db.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, ing.itemId))
            });
            if (!userInv || userInv.quantity < ing.quantity) {
                return res.status(400).json({ error: `Deficient ingredient: ${ing.itemId}` });
            }
        }

        // --- Phase 5: Profession & Success Rate ---
        const alchLevel = user.professionAlchemyLevel || 1;
        const alchExp = user.professionAlchemyExp || 0;

        // Success Rate: Base 50% + 5% per level (Max 90%)
        let successChance = 0.5 + (alchLevel * 0.05);
        if (successChance > 0.9) successChance = 0.9;

        // Crit Chance: Base 10% + 1% per level (Max 30%)
        let critChance = 0.1 + (alchLevel * 0.01);
        if (critChance > 0.3) critChance = 0.3;

        const roll = Math.random();
        const isSuccess = roll < successChance;
        const isCrit = isSuccess && Math.random() < critChance;

        const craftQty = isSuccess ? (isCrit ? 2 : 1) : 0; // 0 if failed

        // Profession XP logic
        // Success: +10 XP, Fail: +2 XP
        const profExpGain = isSuccess ? 10 : 2;
        let newProfExp = alchExp + profExpGain;
        let newProfLevel = alchLevel;

        // Level Up Threshold: Level * 100 XP
        const reqExp = newProfLevel * 100;
        let levelUpMsg = "";

        if (newProfExp >= reqExp) {
            newProfLevel++;
            newProfExp -= reqExp; // Carry over? Or reset? Let's carry over or just set to 0. 
            // Simple: carry over remnant
            levelUpMsg = ` (Thăng cấp Luyện Đan Sư lên Lv${newProfLevel}!)`;
        }

        await db.transaction(async (tx) => {
            // Consume Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - cost })
                .where(eq(users.id, userId));

            // Consume Ingredients (Always consumed)
            for (const ing of ingredients) {
                const userInv = await tx.query.inventory.findFirst({
                    where: and(eq(inventory.userId, userId), eq(inventory.itemId, ing.itemId))
                });
                if (userInv) {
                    if (userInv.quantity === ing.quantity) {
                        await tx.delete(inventory).where(eq(inventory.id, userInv.id));
                    } else {
                        await tx.update(inventory)
                            .set({ quantity: userInv.quantity - ing.quantity })
                            .where(eq(inventory.id, userInv.id));
                    }
                }
            }

            if (isSuccess) {
                // Grant Item
                const existing = await tx.query.inventory.findFirst({
                    where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
                });
                if (existing) {
                    await tx.update(inventory)
                        .set({ quantity: existing.quantity + craftQty })
                        .where(eq(inventory.id, existing.id));
                } else {
                    await tx.insert(inventory).values({
                        userId,
                        itemId,
                        quantity: craftQty,
                        type: recipe.type
                    });
                }

                // Grant Cultivation Exp
                const expGain = (recipe.exp || 10) * craftQty;
                await tx.update(users)
                    .set({
                        cultivationExp: (user.cultivationExp || 0) + expGain,
                        professionAlchemyLevel: newProfLevel,
                        professionAlchemyExp: newProfExp
                    })
                    .where(eq(users.id, userId));
            } else {
                // Failed: Only update Profession Stats (Fail XP)
                await tx.update(users)
                    .set({
                        professionAlchemyLevel: newProfLevel,
                        professionAlchemyExp: newProfExp
                    })
                    .where(eq(users.id, userId));
            }
        });

        if (isSuccess) {
            const msg = isCrit
                ? `Đại Thành Công! Nhận ${craftQty} ${recipe.name}! (+${profExpGain} Nghề Exp)${levelUpMsg}`
                : `Luyện thành công ${recipe.name}. (+${profExpGain} Nghề Exp)${levelUpMsg}`;
            res.json({ success: true, message: msg, isCrit, craftQty });
        } else {
            res.json({ success: false, message: `Luyện thất bại... (Tốn nguyên liệu, +${profExpGain} Nghề Exp)${levelUpMsg}` });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Crafting failed" });
    }
};

// --- Admin / Seeding ---
import { ITEMS, RECIPES, DAILY_MISSIONS } from "../data/gameData";

export const seedGameData = async (req: Request, res: Response) => {
    try {
        const { secret } = req.body;
        // Simple security check (or rely on admin middleware if exists, but for now simple check)
        // if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: "Unauthorized" });

        // Sync Items
        for (const itemKey in ITEMS) {
            const itemDef = ITEMS[itemKey];

            // Resolve recipe if exists
            let recipeIngredients = null;
            if (RECIPES[itemKey]) {
                recipeIngredients = JSON.stringify(RECIPES[itemKey].ingredients);
            }

            // Upsert (Postgres specific)
            // Drizzle doesn't have native upsert in 'query', need 'insert().onConflictDoUpdate'
            await db.insert(gameItems).values({
                id: itemDef.id,
                name: itemDef.name,
                type: itemDef.type,
                price: itemDef.price || 0,
                sellPrice: itemDef.sellPrice || 0,
                growTime: itemDef.growTime || 0,
                exp: itemDef.exp || 0,
                description: itemDef.description,
                icon: '📦', // Default, frontend handles specific icons mostly or we update DB
                ingredients: recipeIngredients
            }).onConflictDoUpdate({
                target: gameItems.id,
                set: {
                    name: itemDef.name,
                    price: itemDef.price || 0,
                    sellPrice: itemDef.sellPrice || 0,
                    growTime: itemDef.growTime || 0,
                    exp: itemDef.exp || 0,
                    description: itemDef.description,
                    ingredients: recipeIngredients
                }
            });
        }

        // Sync Missions
        for (const mission of DAILY_MISSIONS) {
            await db.insert(missions).values({
                id: mission.id,
                title: mission.title,
                description: mission.description,
                type: mission.type,
                requiredAction: mission.requiredAction || null, // Add requiredAction field
                rewardGold: mission.rewardGold,
                rewardExp: mission.rewardExp,
                requiredQuantity: mission.requiredCount, // Map from config 'requiredCount' to schema 'requiredQuantity'
            }).onConflictDoUpdate({
                target: missions.id,
                set: {
                    title: mission.title,
                    description: mission.description,
                    type: mission.type,
                    requiredAction: mission.requiredAction || null, // Add requiredAction field
                    rewardGold: mission.rewardGold,
                    rewardExp: mission.rewardExp,
                    requiredQuantity: mission.requiredCount
                }
            });
        }

        res.json({ success: true, message: "Game Data Seeded Successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Seeding Failed" });
    }
};

export const useItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId } = req.body;
        const userItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
        });

        if (!userItem || userItem.quantity < 1) return res.status(400).json({ error: "Item not found" });

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef || itemDef.type !== 'CONSUMABLE') return res.status(400).json({ error: "Cannot use this item" });

        await db.transaction(async (tx) => {
            // Consume
            if (userItem.quantity === 1) {
                await tx.delete(inventory).where(eq(inventory.id, userItem.id));
            } else {
                await tx.update(inventory)
                    .set({ quantity: userItem.quantity - 1 })
                    .where(eq(inventory.id, userItem.id));
            }

            // Effect (Add Exp)
            const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
            await tx.update(users)
                .set({ cultivationExp: (user?.cultivationExp || 0) + (itemDef.exp || 0) })
                .where(eq(users.id, userId));
        });

        res.json({ success: true, message: `Used ${itemDef.name}, gained ${itemDef.exp} Exp` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to use item" });
    }
};

export const plantSeed = async (req: Request, res: Response) => {
    try {
        const { userId, plotId, seedId } = req.body;

        const plot = await db.query.farmPlots.findFirst({ where: eq(farmPlots.id, plotId) });
        if (!plot || plot.userId !== userId) return res.status(400).json({ error: "Invalid plot" });
        if (plot.seedId) return res.status(400).json({ error: "Plot already occupied" });

        const seedInv = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, seedId))
        });
        if (!seedInv || seedInv.quantity < 1) return res.status(400).json({ error: "Missing seed" });

        await db.transaction(async (tx) => {
            // Consume Seed
            if (seedInv.quantity === 1) {
                await tx.delete(inventory).where(eq(inventory.id, seedInv.id));
            } else {
                await tx.update(inventory)
                    .set({ quantity: seedInv.quantity - 1 })
                    .where(eq(inventory.id, seedInv.id));
            }

            // Plant
            await tx.update(farmPlots)
                .set({ seedId, plantedAt: new Date(), waterCount: 0, lastWateredAt: null })
                .where(eq(farmPlots.id, plotId));
        });

        res.json({ success: true, message: "Planted successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Planting failed" });
    }
};

export const harvestPlant = async (req: Request, res: Response) => {
    try {
        const { userId, plotId } = req.body;

        const plot = await db.query.farmPlots.findFirst({
            where: and(eq(farmPlots.id, plotId), eq(farmPlots.userId, userId))
        });

        if (!plot || !plot.seedId || !plot.plantedAt) {
            return res.status(400).json({ error: "Ô đất trống" });
        }

        const seedDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, plot.seedId) });
        if (!seedDef) return res.status(400).json({ error: "Loại hạt giống không tồn tại" });

        const now = Date.now();
        const baseGrowTimeMs = (seedDef.growTime || 60) * 1000;

        // Calculate reduction from watering
        const waterCount = plot.waterCount || 0;
        const reductionMs = baseGrowTimeMs * waterCount * WATER_CONFIG.REDUCTION_PERCENT;
        const finalGrowTimeMs = Math.max(0, baseGrowTimeMs - reductionMs);

        const elapsed = now - new Date(plot.plantedAt).getTime();

        if (elapsed < finalGrowTimeMs) {
            return res.status(400).json({ error: "Cây chưa lớn" });
        }

        // Determine Product (simplified: harvest produces the 'product' version of seed)
        // Need mapping in gameData or DB. For now hardcode or use convention.
        // Convention: seed_X -> herb_X
        const productId = plot.seedId.replace('seed_', 'herb_');
        const productDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, productId) });

        if (!productDef) return res.status(400).json({ error: "Không tìm thấy vật phẩm thu hoạch" });

        await db.transaction(async (tx) => {
            // Clear plot
            await tx.update(farmPlots)
                .set({ seedId: null, plantedAt: null, waterCount: 0, lastWateredAt: null })
                .where(eq(farmPlots.id, plotId));

            // Add product
            const existing = await tx.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, productId))
            });
            if (existing) {
                await tx.update(inventory)
                    .set({ quantity: existing.quantity + 1 })
                    .where(eq(inventory.id, existing.id));
            } else {
                await tx.insert(inventory).values({
                    userId,
                    itemId: productId,
                    quantity: 1,
                    type: productDef.type
                });
            }

            // Grant Exp
            if (productDef.exp) {
                const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
                await tx.update(users)
                    .set({ cultivationExp: (user?.cultivationExp || 0) + productDef.exp })
                    .where(eq(users.id, userId));
            }
        });

        // Trigger Mission Update (outside transaction to avoid blocking)
        trackMissionProgress(userId, 'HARVEST', 1);

        res.json({ success: true, message: `Thu hoạch thành công: ${productDef.name}` });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Harvest failed" });
    }
};

export const unlockSlot = async (req: Request, res: Response) => {
    try {
        const { userId, plotIndex } = req.body;

        const cost = PLOT_UNLOCK_COSTS[plotIndex];
        if (!cost) return res.status(400).json({ error: "Ô đất không hợp lệ" });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < cost) return res.status(400).json({ error: "Không đủ vàng" });

        // Update plot
        const plot = await db.query.farmPlots.findFirst({
            where: and(eq(farmPlots.userId, userId), eq(farmPlots.plotIndex, plotIndex))
        });

        if (plot && plot.isUnlocked) return res.status(400).json({ error: "Ô đất đã mở" });
        if (!plot) return res.status(404).json({ error: "Lỗi dữ liệu plot" });

        await db.transaction(async (tx) => {
            await tx.update(users).set({ gold: (user.gold || 0) - cost }).where(eq(users.id, userId));
            await tx.update(farmPlots).set({ isUnlocked: true }).where(eq(farmPlots.id, plot.id));

            // Log
            await tx.insert(gameLogs).values({
                userId,
                action: 'UNLOCK_PLOT',
                description: `Mở khóa ô đất số ${plotIndex} (-${cost} Vàng)`,
                createdAt: new Date()
            });
        });

        res.json({ success: true, message: "Mở khóa thành công!" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed" });
    }
};

export const waterPlant = async (req: Request, res: Response) => {
    try {
        const { userId, targetPlotId } = req.body;

        const plot = await db.query.farmPlots.findFirst({ where: eq(farmPlots.id, targetPlotId) });
        if (!plot || !plot.seedId) return res.status(400).json({ error: "Không có cây để tưới" });

        // Check Max Water
        if ((plot.waterCount || 0) >= WATER_CONFIG.MAX_WATER_PER_CROP) {
            return res.status(400).json({ error: "Cây đã đủ nước" });
        }

        // Check Cooldown
        if (plot.lastWateredAt) {
            const now = Date.now();
            const elapsed = now - new Date(plot.lastWateredAt).getTime();
            if (elapsed < WATER_CONFIG.COOLDOWN_MS) {
                const remainingMin = Math.ceil((WATER_CONFIG.COOLDOWN_MS - elapsed) / 60000);
                return res.status(400).json({ error: `Cây đang ướt, hãy đợi ${remainingMin} phút nữa.` });
            }
        }

        await db.transaction(async (tx) => {
            await tx.update(farmPlots)
                .set({
                    waterCount: (plot.waterCount || 0) + 1,
                    lastWateredAt: new Date()
                })
                .where(eq(farmPlots.id, targetPlotId));

            // If watering FRIEND's plot (future feature), log it.
            // Current is self-watering mostly.

            // Log for self too
            await tx.insert(gameLogs).values({
                userId,
                targetUserId: plot.userId, // owner
                action: 'WATER',
                description: `Tưới nước cho cây (lần ${(plot.waterCount || 0) + 1})`,
                createdAt: new Date()
            });
        });

        // Trigger Mission Update
        trackMissionProgress(userId, 'WATER', 1);

        res.json({ success: true, message: "Đã tưới nước! Cây lớn nhanh hơn chút." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed" });
    }
};

// --- Phase 2: Retention Features ---

// Breakthrough Logic
export const attemptBreakthrough = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        const currentLevelIndex = CULTIVATION_LEVELS.findIndex(l => l.name === user.cultivationLevel);
        if (currentLevelIndex === -1 || currentLevelIndex === CULTIVATION_LEVELS.length - 1) {
            return res.status(400).json({ error: "Đã đạt cảnh giới tối cao hoặc lỗi dữ liệu" });
        }

        const currentLevelDef = CULTIVATION_LEVELS[currentLevelIndex];
        const nextLevelDef = CULTIVATION_LEVELS[currentLevelIndex + 1];

        // Check EXP Requirement
        const currentExp = user.cultivationExp || 0;
        if (currentExp < nextLevelDef.exp) {
            return res.status(400).json({ error: `Chưa đủ tu vi để đột phá. Cần ${nextLevelDef.exp} Exp.` });
        }

        // --- PHASE 3: TRIBULATION (Thiên Kiếp) ---
        // From Level 3 (Kim Đan) upwards, tribulation occurs
        const isTribulation = currentLevelIndex >= 2;

        let chance = currentLevelDef.breakthroughChance || 0.5;
        let tribulationMsg = "";

        if (isTribulation) {
            // Check for Protection Item (Hộ Thân Phù - item_talisman_protect)
            const protectionItem = await db.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, 'item_talisman_protect'))
            });

            if (protectionItem && protectionItem.quantity && protectionItem.quantity > 0) {
                // Use Item to boost chance
                chance = Math.min(0.9, chance + 0.3); // Boost 30%
                tribulationMsg = "(Đã dùng Hộ Thân Phù)";

                // Consume Item Logic would go here in a Transaction, but let's keep it simple for now or assume auto-consume
                // Ideally we should consume it ONLY if we actually attempt.
            } else {
                tribulationMsg = "(CẢNH BÁO: Không có Hộ Thân Phù, tỉ lệ thấp!)";
            }
        }

        // Check Success Rate
        const roll = Math.random();
        const isSuccess = roll < chance;

        if (isSuccess) {
            await db.transaction(async (tx) => {
                await tx.update(users)
                    .set({ cultivationLevel: nextLevelDef.name })
                    .where(eq(users.id, userId));

                // If used talisman, consume it
                if (isTribulation && tribulationMsg.includes("Đã dùng")) {
                    // Find again to be safe inside tx
                    const pItem = await tx.query.inventory.findFirst({
                        where: and(eq(inventory.userId, userId), eq(inventory.itemId, 'item_talisman_protect'))
                    });
                    if (pItem) {
                        if (pItem.quantity === 1) await tx.delete(inventory).where(eq(inventory.id, pItem.id));
                        else await tx.update(inventory).set({ quantity: pItem.quantity - 1 }).where(eq(inventory.id, pItem.id));
                    }
                }

                // Log it
                await tx.insert(gameLogs).values({
                    userId,
                    action: 'BREAKTHROUGH_SUCCESS',
                    description: `Đột phá thành công lên ${nextLevelDef.name}! ${tribulationMsg}`,
                    createdAt: new Date()
                });
            });

            return res.json({ success: true, message: `Chúc mừng! Đã đột phá lên ${nextLevelDef.name}! ${tribulationMsg}` });
        } else {
            // Failure Penalty: Lose 10% of current EXP
            // Tribulation Failure: Lose 30% if no protection!
            let lossPercent = 0.1;
            if (isTribulation && !tribulationMsg.includes("Đã dùng")) {
                lossPercent = 0.3; // High penalty for failing Tribulation without protection
            }

            const penalty = Math.floor(currentExp * lossPercent);
            const newExp = Math.max(0, currentExp - penalty);

            await db.update(users)
                .set({ cultivationExp: newExp })
                .where(eq(users.id, userId));

            // Log it
            await db.insert(gameLogs).values({
                userId,
                action: 'BREAKTHROUGH_FAIL',
                description: `Đột phá thất bại! Tổn hao ${penalty} tu vi. ${tribulationMsg}`,
                createdAt: new Date()
            });

            return res.json({ success: false, message: `Đột phá thất bại! Thiên kiếp đánh rớt ${penalty} Exp. ${tribulationMsg}`, newExp });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Lỗi Server" });
    }
};

// Leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
    try {
        const topUsers = await db.select({
            id: users.id,
            name: users.name,
            image: users.image,
            cultivationLevel: users.cultivationLevel,
            cultivationExp: users.cultivationExp
        })
            .from(users)
            .orderBy(desc(users.cultivationExp))
            .limit(10);

        res.json(topUsers);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Lỗi Server" });
    }
};

export const getLogs = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query as { userId: string };
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const logs = await getGameLogsHelper(userId);
        res.json(logs);
    } catch (error: any) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// --- Phase 4: Story Events ---
export const syncStoryEvent = async (req: Request, res: Response) => {
    try {
        const { userId, events } = req.body;
        // events is string[] from AI, e.g., ["HEAVY_RAIN", "BATTLE"]

        if (!userId || !Array.isArray(events) || events.length === 0) {
            return res.json({ success: true, message: "No active events" });
        }

        console.log(`⚡ Syncing Story Events for ${userId}:`, events);

        const durationMinutes = 30;
        const expireAt = Date.now() + durationMinutes * 60 * 1000;

        // Map events to Buffs
        const newBuffs = events.map(evt => {
            switch (evt) {
                case "HEAVY_RAIN": return { type: "GROWTH_SPEED", value: 1.5, expireAt, source: "Cốt truyện: Mưa Lớn" };
                case "SUNNY_DAY": return { type: "GROWTH_SPEED", value: 0.8, expireAt, source: "Cốt truyện: Nắng Gắt" };
                case "BATTLE": return { type: "BREAKTHROUGH_CHANCE", value: 0.2, expireAt, source: "Cốt truyện: Chiến Đấu" };
                case "AUCTION": return { type: "SHOP_DISCOUNT", value: 0.1, expireAt, source: "Cốt truyện: Đấu Giá" };
                case "MEDITATION": return { type: "EXP_BOOST", value: 1.2, expireAt, source: "Cốt truyện: Bế Quan" };
                case "DANGER": return { type: "BREAKTHROUGH_CHANCE", value: -0.2, expireAt, source: "Cốt truyện: Nguy Hiểm" };
                default: return null;
            }
        }).filter(b => b !== null);

        if (newBuffs.length === 0) return res.json({ success: true });

        await db.update(users)
            .set({ activeBuffs: JSON.stringify(newBuffs) })
            .where(eq(users.id, userId));

        return res.json({ success: true, message: "Đã kích hoạt sự kiện Thiên Địa!" });

    } catch (e) {
        console.error("Sync Event Error:", e);
        res.status(500).json({ error: "Sync failed" });
    }
};
