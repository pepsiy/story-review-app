import { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, farmPlots, inventory, friendships, gameItems } from "../../../../packages/db/src";

// Get another user's farm state (public view)
export const getOtherUserFarm = async (req: Request, res: Response) => {
    try {
        const { userId, targetUserId } = req.body;
        if (!userId || !targetUserId) return res.status(400).json({ error: "Missing parameters" });

        // Get target user
        const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        // Get target user's plots
        const plots = await db.select().from(farmPlots).where(eq(farmPlots.userId, targetUserId));

        // Get friendship status
        let friendship = await db.query.friendships.findFirst({
            where: and(
                eq(friendships.userId, userId),
                eq(friendships.targetUserId, targetUserId)
            )
        });

        res.json({
            targetUser: {
                id: targetUser.id,
                name: targetUser.name,
                cultivationLevel: targetUser.cultivationLevel
            },
            plots,
            friendship: friendship || { friendshipLevel: 0, waterCount: 0, stealCount: 0 }
        });
    } catch (error: any) {
        console.error("Error fetching other user farm:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Water plants (increase friendship)
export const waterPlant = async (req: Request, res: Response) => {
    try {
        const { userId, targetUserId, plotId } = req.body;
        if (!userId || !targetUserId || !plotId) return res.status(400).json({ error: "Missing parameters" });

        if (userId === targetUserId) return res.status(400).json({ error: "Không thể tưới vườn của chính mình!" });

        // Get plot
        const plot = await db.query.farmPlots.findFirst({
            where: and(
                eq(farmPlots.id, plotId),
                eq(farmPlots.userId, targetUserId)
            )
        });

        if (!plot || !plot.seedId) return res.status(400).json({ error: "Ô đất trống hoặc không tồn tại" });

        // Check friendship (cooldown - 1 action per user per day)
        let friendship = await db.query.friendships.findFirst({
            where: and(
                eq(friendships.userId, userId),
                eq(friendships.targetUserId, targetUserId)
            )
        });

        const now = new Date();
        if (friendship && friendship.lastInteraction) {
            const hoursSinceLastAction = (now.getTime() - new Date(friendship.lastInteraction).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastAction < 24) {
                return res.status(400).json({ error: "Chỉ được thao tác 1 lần mỗi ngày!" });
            }
        }

        // Update or create friendship
        if (friendship) {
            await db.update(friendships)
                .set({
                    friendshipLevel: (friendship.friendshipLevel || 0) + 5,
                    waterCount: (friendship.waterCount || 0) + 1,
                    lastInteraction: now
                })
                .where(eq(friendships.id, friendship.id));
        } else {
            await db.insert(friendships).values({
                userId,
                targetUserId,
                friendshipLevel: 5,
                waterCount: 1,
                lastInteraction: now
            });
        }

        res.json({ message: "Tưới nước thành công! +5 Hảo Cảm" });
    } catch (error: any) {
        console.error("Error watering plant:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Steal harvest (PK action - decrease friendship, gain items)
export const stealHarvest = async (req: Request, res: Response) => {
    try {
        const { userId, targetUserId, plotId } = req.body;
        if (!userId || !targetUserId || !plotId) return res.status(400).json({ error: "Missing parameters" });

        if (userId === targetUserId) return res.status(400).json({ error: "Không thể trộm vườn của chính mình!" });

        // Get plot
        const plot = await db.query.farmPlots.findFirst({
            where: and(
                eq(farmPlots.id, plotId),
                eq(farmPlots.userId, targetUserId)
            )
        });

        if (!plot || !plot.seedId || !plot.plantedAt) {
            return res.status(400).json({ error: "Ô đất trống hoặc chưa trồng" });
        }

        // Check if plant is ready
        const seedDef = await db.query.gameItems.findFirst({
            where: eq(gameItems.id, plot.seedId)
        });

        if (!seedDef) return res.status(404).json({ error: "Seed not found" });

        const plantedTime = new Date(plot.plantedAt).getTime();
        const now = Date.now();
        const elapsed = (now - plantedTime) / 1000;

        if (elapsed < (seedDef.growTime || 0)) {
            return res.status(400).json({ error: "Cây chưa lớn, chưa thể trộm!" });
        }

        // Check friendship cooldown
        let friendship = await db.query.friendships.findFirst({
            where: and(
                eq(friendships.userId, userId),
                eq(friendships.targetUserId, targetUserId)
            )
        });

        const currentTime = new Date();
        if (friendship && friendship.lastInteraction) {
            const hoursSinceLastAction = (currentTime.getTime() - new Date(friendship.lastInteraction).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastAction < 24) {
                return res.status(400).json({ error: "Chỉ được thao tác 1 lần mỗi ngày!" });
            }
        }

        // Determine product (convert seed to herb)
        const productId = plot.seedId.replace('seed_', 'herb_');
        const productDef = await db.query.gameItems.findFirst({
            where: eq(gameItems.id, productId)
        });

        if (!productDef) return res.status(404).json({ error: "Product not found" });

        // Random quantity (50% of normal yield for stealing)
        const min = Math.max(1, Math.floor((productDef.minYield || 1) / 2));
        const max = Math.max(1, Math.floor((productDef.maxYield || 1) / 2));
        const quantity = max > min ? Math.floor(Math.random() * (max - min + 1)) + min : min;

        // Add to thief's inventory
        const existingItem = await db.query.inventory.findFirst({
            where: and(
                eq(inventory.userId, userId),
                eq(inventory.itemId, productId)
            )
        });

        if (existingItem) {
            await db.update(inventory)
                .set({ quantity: existingItem.quantity + quantity })
                .where(eq(inventory.id, existingItem.id));
        } else {
            await db.insert(inventory).values({
                userId,
                itemId: productId,
                quantity,
                type: 'PRODUCT'
            });
        }

        // Clear the plot (victim loses harvest)
        await db.update(farmPlots)
            .set({ seedId: null, plantedAt: null })
            .where(eq(farmPlots.id, plotId));

        // Update friendship (decrease)
        if (friendship) {
            await db.update(friendships)
                .set({
                    friendshipLevel: (friendship.friendshipLevel || 0) - 10,
                    stealCount: (friendship.stealCount || 0) + 1,
                    lastInteraction: currentTime
                })
                .where(eq(friendships.id, friendship.id));
        } else {
            await db.insert(friendships).values({
                userId,
                targetUserId,
                friendshipLevel: -10,
                stealCount: 1,
                lastInteraction: currentTime
            });
        }

        res.json({
            message: `Hái trộm thành công ${quantity} ${productDef.name}! -10 Hảo Cảm`,
            item: productDef.name,
            quantity
        });
    } catch (error: any) {
        console.error("Error stealing harvest:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
