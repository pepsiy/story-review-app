import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, farmPlots, inventory } from "../../../../packages/db/src";
import { ITEMS, ITEM_TYPES, CULTIVATION_LEVELS } from "../data/gameData";

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

    return { user, plots, inventory: userInventory };
};

// --- Controllers ---

export const getGameState = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body; // In real app, get from Auth Middleware (req.user.id)
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
            return res.status(400).json({ error: "Invalid plot or already planted" });
        }

        // Check inventory
        const seedItem = await db.query.inventory.findFirst({
            where: and(eq(inventory.userId, userId), eq(inventory.itemId, seedId))
        });
        if (!seedItem || seedItem.quantity < 1) {
            return res.status(400).json({ error: "Not enough seeds" });
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

        res.json({ message: "Planted successfully" });
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
            return res.status(400).json({ error: "Plot is empty" });
        }

        const seedDef = ITEMS[plot.seedId];
        if (!seedDef) return res.status(400).json({ error: "Unknown seed" });

        const now = new Date();
        const growTimeMs = (seedDef.growTime || 60) * 1000;
        const elapsed = now.getTime() - new Date(plot.plantedAt).getTime();

        if (elapsed < growTimeMs) {
            return res.status(400).json({ error: "Not ready to harvest" });
        }

        // Determine product ID (simple mapping: seed_X -> herb_X)
        const productId = plot.seedId.replace("seed_", "herb_");

        // Transaction: Clear plot, Add product, Give EXP
        await db.transaction(async (tx) => {
            // Clear plot
            await tx.update(farmPlots)
                .set({ seedId: null, plantedAt: null })
                .where(eq(farmPlots.id, plotId));

            // Add product
            const existingItem = await tx.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, productId))
            });

            if (existingItem) {
                await tx.update(inventory)
                    .set({ quantity: existingItem.quantity + 1 })
                    .where(eq(inventory.id, existingItem.id));
            } else {
                await tx.insert(inventory).values({
                    userId,
                    itemId: productId,
                    quantity: 1,
                    type: ITEM_TYPES.PRODUCT
                });
            }

            // TODO: Give Cultivation EXP here if desired (or save for alchemy)
        });

        res.json({ message: `Harvested ${productId}!` });
    } catch (error: any) {
        console.error("Harvest Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const buyItem = async (req: Request, res: Response) => {
    try {
        const { userId, itemId, quantity } = req.body;
        const qty = quantity || 1;

        const itemDef = ITEMS[itemId];
        if (!itemDef || !itemDef.price) return res.status(400).json({ error: "Item not found or not for sale" });

        const totalCost = itemDef.price * qty;

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || (user.gold || 0) < totalCost) {
            return res.status(400).json({ error: "Not enough gold" });
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

        res.json({ message: `Bought ${qty} ${itemDef.name}` });
    } catch (error: any) {
        console.error("Buy Error:", error);
        res.status(500).json({ error: error.message });
    }
};
