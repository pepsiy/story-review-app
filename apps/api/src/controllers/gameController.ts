import { Request, Response } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, farmPlots, inventory, gameItems, gameLogs } from "../../../../packages/db/src";
import { ITEM_TYPES, CULTIVATION_LEVELS, PLOT_UNLOCK_COSTS, WATER_CONFIG } from "../data/gameData";

// --- Helpers ---
const getUserGameState = async (userId: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    // Ensure plots exist (create if not)
    let plots = await db.select().from(farmPlots).where(eq(farmPlots.userId, userId));
    if (plots.length === 0) {
        // Initialize 9 plots
        const newPlots = Array.from({ length: 9 }).map((_, i) => ({
            userId,
            plotIndex: i,
            isUnlocked: i < 3, // Unlock first 3 plots
        }));
        plots = await db.insert(farmPlots).values(newPlots).returning();
    }

    const userInventory = await db.select().from(inventory).where(eq(inventory.userId, userId));

    // Fetch Game Definitions from DB
    const itemsList = await db.select().from(gameItems);
    const itemsDef: any = {};
    itemsList.forEach(item => {
        itemsDef[item.id] = {
            ...item,
            // Parse ingredients if exists (for frontend recipe display)
            ingredients: item.ingredients ? JSON.parse(item.ingredients) : undefined
        };
    });

    return { user, plots, inventory: userInventory, itemsDef };
};

// --- Controllers ---

export const getGameState = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const state = await getUserGameState(userId);
        res.json(state);
    } catch (error: any) {
        console.error("Game State Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const plantSeed = async (req: Request, res: Response) => {
    try {
        const { userId, plotId, seedId } = req.body;

        // Check plot
        const plot = await db.query.farmPlots.findFirst({
            where: and(eq(farmPlots.id, plotId), eq(farmPlots.userId, userId))
        });
        if (!plot || !plot.isUnlocked || plot.seedId) {
            return res.status(400).json({ error: "Ô đất không hợp lệ hoặc đã gieo trồng" });
        }

        // Check inventory
        const seedItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, seedId))
        });
        if (!seedItem || seedItem.quantity < 1) {
            return res.status(400).json({ error: "Không đủ hạt giống" });
        }

        // Transaction: Deduct seed, Plant plot
        await db.transaction(async (tx) => {
            await tx.update(inventory)
                .set({ quantity: seedItem.quantity - 1 })
                .where(eq(inventory.id, seedItem.id));

            await tx.update(farmPlots)
                .set({ seedId, plantedAt: new Date() })
                .where(eq(farmPlots.id, plotId));
        });

        res.json({ message: "Gieo hạt thành công" });
    } catch (error: any) {
        console.error("Plant Error:", error);
        res.status(500).json({ error: error.message });
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

        // Fetch Seed Definition form DB
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

        // Determine product ID (simple mapping: seed_X -> herb_X)
        const productId = plot.seedId.replace("seed_", "herb_");

        // Fetch Product Definition for Yield Config (Optional, usually stored on PRODUCT)
        const productDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, productId) });

        let quantity = 1;
        if (productDef) {
            const min = productDef.minYield || 1;
            const max = productDef.maxYield || 1;
            // Random yield logic
            if (max > min) {
                quantity = Math.floor(Math.random() * (max - min + 1)) + min;
            } else {
                quantity = min;
            }
        }

        // Transaction: Clear plot, Add product
        await db.transaction(async (tx) => {
            // Clear plot
            await tx.update(farmPlots)
                .set({ seedId: null, plantedAt: null, waterCount: 0, lastWateredAt: null })
                .where(eq(farmPlots.id, plotId));

            // Add product
            const existingItem = await tx.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, productId))
            });

            if (existingItem) {
                await tx.update(inventory)
                    .set({ quantity: existingItem.quantity + quantity })
                    .where(eq(inventory.id, existingItem.id));
            } else {
                await tx.insert(inventory).values({
                    userId,
                    itemId: productId,
                    quantity: quantity,
                    type: ITEM_TYPES.PRODUCT
                });
            }
        });

        res.json({ message: `Thu hoạch thành công: +${quantity} ${productDef?.name || productId}!` });
    } catch (error: any) {
        console.error("Harvest Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const buyItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId, quantity } = req.body;
        const qty = quantity || 1;

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef || !itemDef.price) return res.status(400).json({ error: "Vật phẩm không bán" });

        const totalCost = itemDef.price * qty;

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < totalCost) {
            return res.status(400).json({ error: "Không đủ vàng" });
        }

        // Transaction
        await db.transaction(async (tx) => {
            // Deduct Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - totalCost })
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
                    type: itemDef.type
                });
            }
        });

        res.json({ message: `Mua thành công ${qty} ${itemDef.name}` });
    } catch (error: any) {
        console.error("Buy Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const sellItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId, quantity } = req.body;
        const qty = quantity || 1;

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef || !itemDef.sellPrice) return res.status(400).json({ error: "Vật phẩm không thể bán" });

        const totalValue = itemDef.sellPrice * qty;

        // Check Inventory
        const inventoryItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
        });

        if (!inventoryItem || inventoryItem.quantity < qty) {
            return res.status(400).json({ error: "Không đủ vật phẩm" });
        }

        // Transaction
        await db.transaction(async (tx) => {
            // Deduct Item
            if (inventoryItem.quantity === qty) {
                await tx.delete(inventory).where(eq(inventory.id, inventoryItem.id));
            } else {
                await tx.update(inventory)
                    .set({ quantity: inventoryItem.quantity - qty })
                    .where(eq(inventory.id, inventoryItem.id));
            }

            // Add Gold
            const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
            await tx.update(users)
                .set({ gold: (user?.gold || 0) + totalValue })
                .where(eq(users.id, userId));
        });

        res.json({ message: `Bán ${qty} ${itemDef.name} thu được ${totalValue} Vàng` });
    } catch (error: any) {
        console.error("Sell Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const craftItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId } = req.body; // itemId is target item to craft (e.g., pill_truc_co)

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef) return res.status(400).json({ error: "Vật phẩm không tồn tại" });

        // Parse Recipe
        let ingredients: { itemId: string, quantity: number }[] = [];
        try {
            ingredients = itemDef.ingredients ? JSON.parse(itemDef.ingredients) : [];
        } catch (e) { }

        if (ingredients.length === 0) return res.status(400).json({ error: "Vật phẩm này không thể luyện" });

        const craftCost = 100; // Fixed cost for now

        // Check Gold
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < craftCost) {
            return res.status(400).json({ error: `Cần ${craftCost} vàng để luyện` });
        }

        // Check Ingredients
        const userInventory = await db.query.inventory.findMany({
            where: eq(inventory.userId, userId)
        });

        for (const ing of ingredients) {
            const hasItem = userInventory.find(i => i.itemId === ing.itemId);
            if (!hasItem || hasItem.quantity < ing.quantity) {
                const ingDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, ing.itemId) });
                return res.status(400).json({ error: `Thiếu nguyên liệu: ${ingDef?.name || ing.itemId}` });
            }
        }

        // Transaction
        await db.transaction(async (tx) => {
            // Deduct Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - craftCost })
                .where(eq(users.id, userId));

            // Deduct Ingredients
            for (const ing of ingredients) {
                const itemDb = userInventory.find(i => i.itemId === ing.itemId)!;
                if (itemDb.quantity === ing.quantity) {
                    await tx.delete(inventory).where(eq(inventory.id, itemDb.id));
                } else {
                    await tx.update(inventory)
                        .set({ quantity: itemDb.quantity - ing.quantity })
                        .where(eq(inventory.id, itemDb.id));
                }
            }

            // Add Result
            const existingResult = await tx.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
            });

            if (existingResult) {
                await tx.update(inventory)
                    .set({ quantity: existingResult.quantity + 1 })
                    .where(eq(inventory.id, existingResult.id));
            } else {
                await tx.insert(inventory).values({
                    userId,
                    itemId,
                    quantity: 1,
                    type: itemDef.type
                });
            }
        });

        res.json({ message: `Luyện thành công ${itemDef.name}!` });

    } catch (error: any) {
        console.error("Craft Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const useItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId } = req.body;

        const itemDef = await db.query.gameItems.findFirst({ where: eq(gameItems.id, itemId) });
        if (!itemDef || !itemDef.exp) return res.status(400).json({ error: "Vật phẩm không thể sử dụng để tu luyện" });

        const invItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, itemId))
        });

        if (!invItem || invItem.quantity < 1) return res.status(400).json({ error: "Bạn không có vật phẩm này" });

        // Transaction
        await db.transaction(async (tx) => {
            // Deduct Item
            if (invItem.quantity === 1) {
                await tx.delete(inventory).where(eq(inventory.id, invItem.id));
            } else {
                await tx.update(inventory)
                    .set({ quantity: invItem.quantity - 1 })
                    .where(eq(inventory.id, invItem.id));
            }

            // Add Exp
            const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
            const currentExp = (user?.cultivationExp || 0) + (itemDef.exp || 0);
            let currentLevel = user?.cultivationLevel || "Phàm Nhân";

            // Check Level Up
            // Find current level index
            const levelIdx = CULTIVATION_LEVELS.findIndex(l => l.name === currentLevel);
            const nextLevel = CULTIVATION_LEVELS[levelIdx + 1];

            if (nextLevel && currentExp >= nextLevel.exp) {
                currentLevel = nextLevel.name;
            }

            await tx.update(users)
                .set({
                    cultivationExp: currentExp,
                    cultivationLevel: currentLevel
                })
                .where(eq(users.id, userId));
        });

        res.json({ message: `Sử dụng ${itemDef.name}, tăng ${itemDef.exp} Đạo Hạnh!` });

    } catch (error: any) {
        console.error("Use Item Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- New Features Phase 1 ---

const getGameLogs = async (userId: string) => {
    // Get logs where user is actor OR target
    return await db.query.gameLogs.findMany({
        where: or(eq(gameLogs.userId, userId), eq(gameLogs.targetUserId, userId)),
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        limit: 20
    });
};

export const getLogs = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query as { userId: string };
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const logs = await getGameLogs(userId);
        res.json(logs);
    } catch (error: any) {
        console.error("Get Logs Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const unlockSlot = async (req: Request, res: Response) => {
    try {
        const { userId, plotIndex } = req.body;

        // Validation
        if (plotIndex < 3 || plotIndex > 8) {
            return res.status(400).json({ error: "Chỉ có thể mở khóa ô đất từ 4 đến 9 (index 3-8)" });
        }

        const cost = PLOT_UNLOCK_COSTS[plotIndex];
        if (!cost) return res.status(400).json({ error: "Không tìm thấy thông tin giá mở khóa" });

        const plot = await db.query.farmPlots.findFirst({
            where: and(eq(farmPlots.userId, userId), eq(farmPlots.plotIndex, plotIndex))
        });

        if (plot && plot.isUnlocked) {
            return res.status(400).json({ error: "Ô đất này đã được mở khóa" });
        }

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < cost) {
            return res.status(400).json({ error: `Bạn cần ${cost} Vàng để mở khóa` });
        }

        await db.transaction(async (tx) => {
            // Deduct Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - cost })
                .where(eq(users.id, userId));

            // Unlock Plot
            if (plot) {
                await tx.update(farmPlots)
                    .set({ isUnlocked: true })
                    .where(eq(farmPlots.id, plot.id));
            } else {
                // If plot row doesn't exist yet (lazy init edge case), insert it
                await tx.insert(farmPlots).values({
                    userId,
                    plotIndex,
                    isUnlocked: true
                });
            }

            // Log
            await tx.insert(gameLogs).values({
                userId,
                action: 'UNLOCK_PLOT',
                description: `Mở khóa ô đất số ${plotIndex + 1} (-${cost} Vàng)`,
                createdAt: new Date()
            });
        });

        res.json({ message: `Mở khóa thành công ô đất số ${plotIndex + 1}!` });
    } catch (error: any) {
        console.error("Unlock Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const waterPlant = async (req: Request, res: Response) => {
    try {
        const { userId, targetPlotId } = req.body;

        const plot = await db.query.farmPlots.findFirst({
            where: eq(farmPlots.id, targetPlotId)
        });

        if (!plot || !plot.seedId || !plot.plantedAt) {
            return res.status(400).json({ error: "Ô đất trống hoặc không tồn tại" });
        }

        if ((plot.waterCount || 0) >= WATER_CONFIG.MAX_WATER_PER_CROP) {
            return res.status(400).json({ error: "Cây này đã đủ nước rồi" });
        }

        // Cooldown check (Simple: 1 min global cooldown for now per plot? Or just strictly count?)
        // Let's implement cooldown: 5 minutes per water action on same plot
        if (plot.lastWateredAt) {
            const diff = Date.now() - new Date(plot.lastWateredAt).getTime();
            if (diff < 5 * 60 * 1000) {
                return res.status(400).json({ error: "Cây vừa được tưới, hãy đợi chút!" });
            }
        }

        // Determine relationship
        const isOwner = plot.userId === userId;

        await db.transaction(async (tx) => {
            // Update Plot
            await tx.update(farmPlots)
                .set({
                    waterCount: (plot.waterCount || 0) + 1,
                    lastWateredAt: new Date()
                })
                .where(eq(farmPlots.id, targetPlotId));

            // Log if social
            if (!isOwner) {
                const actor = await tx.query.users.findFirst({ where: eq(users.id, userId) });
                await tx.insert(gameLogs).values({
                    userId: userId, // Actor
                    targetUserId: plot.userId, // Owner
                    action: 'WATER',
                    description: `${actor?.name || 'Ai đó'} đã tưới nước cho cây của bạn!`,
                    createdAt: new Date()
                });
            }
        });

        res.json({ message: "Tưới nước thành công! Cây sẽ lớn nhanh hơn." });

    } catch (error: any) {
        console.error("Water Error:", error);
        res.status(500).json({ error: error.message });
    }
};
