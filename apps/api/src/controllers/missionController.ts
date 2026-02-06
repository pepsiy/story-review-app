import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, missions, userMissions, inventory } from "../../../../packages/db/src";

// Helper: Check Daily Reset
export const checkDailyReset = async (userId: string) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return;

    const now = new Date();
    const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);

    // Simple Day Comparison (UTC) - better to use locale or fixed offset for consistency
    const isSameDay = now.toISOString().split('T')[0] === lastReset.toISOString().split('T')[0];

    if (!isSameDay) {
        // Reset: Delete all user missions to allow re-doing them (Or just DAILY ones if we had a type filter)
        // For Phase 1, all missions are Daily.
        await db.delete(userMissions).where(eq(userMissions.userId, userId));

        // Auto-Assign Daily Missions
        // Fetch all DAILY missions (Currently all seeded missions)
        const dailyMissions = await db.query.missions.findMany(); // In future filter by type='DAILY' or metadata

        for (const mission of dailyMissions) {
            await db.insert(userMissions).values({
                userId,
                missionId: mission.id,
                status: 'IN_PROGRESS',
                progress: 0
            }).onConflictDoNothing();
        }

        // Update Reset Time
        await db.update(users).set({ lastDailyReset: now }).where(eq(users.id, userId));
    }
}

// Get all available missions + user's active missions
export const getMissions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        // Check Daily Reset
        await checkDailyReset(userId);

        // Get all missions definition
        const allMissions = await db.select().from(missions);

        // Get user's active/completed missions
        const userMissionsList = await db.select()
            .from(userMissions)
            .where(eq(userMissions.userId, userId));

        res.json({
            missions: allMissions,
            userMissions: userMissionsList
        });
    } catch (error: any) {
        console.error("Error fetching missions:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Accept a mission (Optional now since we auto-assign daily, but good for specific quests)
export const acceptMission = async (req: Request, res: Response) => {
    try {
        const { userId, missionId } = req.body;
        if (!userId || !missionId) return res.status(400).json({ error: "Missing parameters" });

        // Check if mission exists
        const mission = await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
        if (!mission) return res.status(404).json({ error: "Mission not found" });

        // Check if already accepted
        const existing = await db.query.userMissions.findFirst({
            where: and(
                eq(userMissions.userId, userId),
                eq(userMissions.missionId, missionId)
            )
        });

        if (existing) return res.status(400).json({ error: "Mission already accepted" });

        // Create user mission
        const newUserMission = await db.insert(userMissions).values({
            userId,
            missionId,
            status: 'IN_PROGRESS',
            progress: 0
        }).returning();

        res.json({ message: "Mission accepted!", userMission: newUserMission[0] });
    } catch (error: any) {
        console.error("Error accepting mission:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Complete a mission (submit items + claim rewards)
export const completeMission = async (req: Request, res: Response) => {
    try {
        const { userId, missionId } = req.body;
        if (!userId || !missionId) return res.status(400).json({ error: "Missing parameters" });

        // Get mission
        const mission = await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
        if (!mission) return res.status(404).json({ error: "Mission not found" });

        // Get user mission
        const userMission = await db.query.userMissions.findFirst({
            where: and(
                eq(userMissions.userId, userId),
                eq(userMissions.missionId, missionId),
                eq(userMissions.status, 'IN_PROGRESS') // Must be In Progress to Claim? Or 'COMPLETED' status means claimed?
                // Logic: 
                // 1. Progress < Required -> Return Error
                // 2. Progress >= Required -> Claim -> Set Status COMPLETED -> Give Rewards
            )
        });

        // Search if already completed
        const completedMission = await db.query.userMissions.findFirst({
            where: and(
                eq(userMissions.userId, userId),
                eq(userMissions.missionId, missionId),
                eq(userMissions.status, 'COMPLETED')
            )
        });
        if (completedMission) return res.status(400).json({ error: "Mission already claimed today" });

        if (!userMission) return res.status(400).json({ error: "Mission not active or not started" });

        // Check Requirements
        // Type: COLLECT (Item)
        if (mission.type === 'COLLECT' && mission.requiredItemId) {
            const userItem = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.userId, userId),
                    eq(inventory.itemId, mission.requiredItemId)
                )
            });

            if (!userItem || userItem.quantity < (mission.requiredQuantity || 1)) {
                return res.status(400).json({ error: `Không đủ ${mission.requiredQuantity} ${mission.requiredItemId}` });
            }

            // Deduct items
            await db.update(inventory)
                .set({ quantity: userItem.quantity - (mission.requiredQuantity || 1) })
                .where(eq(inventory.id, userItem.id));
        }

        // Type: PROGRESS (Water/Harvest)
        else if (mission.type === 'PROGRESS') {
            const reqCount = mission.requiredQuantity || 1; // Default 1 
            // Note: Schema uses requiredQuantity for both Item Count and Action Count
            if ((userMission.progress || 0) < reqCount) {
                return res.status(400).json({ error: `Chưa hoàn thành tiến độ (${userMission.progress}/${reqCount})` });
            }
        }

        // Get user
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Give rewards
        const newGold = (user.gold || 0) + (mission.rewardGold || 0);
        const newExp = (user.cultivationExp || 0) + (mission.rewardExp || 0);

        await db.update(users)
            .set({ gold: newGold, cultivationExp: newExp })
            .where(eq(users.id, userId));

        // Mark mission as completed
        await db.update(userMissions)
            .set({ status: 'COMPLETED', completedAt: new Date() })
            .where(eq(userMissions.id, userMission.id));

        res.json({
            success: true,
            message: `Hoàn thành nhiệm vụ! Nhận ${mission.rewardGold} Vàng + ${mission.rewardExp} Exp`,
            rewards: {
                gold: mission.rewardGold,
                exp: mission.rewardExp
            }
        });
    } catch (error: any) {
        console.error("Error completing mission:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// ==================== ADMIN MISSION MANAGEMENT ====================

// Get All Missions (Admin)
export const getAllMissionsAdmin = async (req: Request, res: Response) => {
    try {
        const allMissions = await db.select().from(missions);
        res.json({ missions: allMissions });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch missions" });
    }
};

// Create Mission (Admin)
export const createMission = async (req: Request, res: Response) => {
    try {
        const {
            id,
            title,
            description,
            type,
            requiredAction,
            requiredItemId,
            requiredQuantity,
            rewardGold,
            rewardExp,
            rewardItems
        } = req.body;

        if (!id || !title || !type) {
            return res.status(400).json({ error: "Missing required fields: id, title, type" });
        }

        await db.insert(missions).values({
            id,
            title,
            description: description || null,
            type,
            requiredAction: requiredAction || null,
            requiredItemId: requiredItemId || null,
            requiredQuantity: requiredQuantity || 1,
            rewardGold: rewardGold || 0,
            rewardExp: rewardExp || 0,
            rewardItems: rewardItems || null
        });

        res.json({ success: true, message: "Mission created successfully" });
    } catch (e: any) {
        console.error(e);
        if (e.code === '23505') { // Duplicate key error
            return res.status(400).json({ error: "Mission ID already exists" });
        }
        res.status(500).json({ error: "Failed to create mission" });
    }
};

// Update Mission (Admin)
export const updateMission = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            type,
            requiredAction,
            requiredItemId,
            requiredQuantity,
            rewardGold,
            rewardExp,
            rewardItems
        } = req.body;

        if (!id) {
            return res.status(400).json({ error: "Mission ID required" });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (requiredAction !== undefined) updateData.requiredAction = requiredAction;
        if (requiredItemId !== undefined) updateData.requiredItemId = requiredItemId;
        if (requiredQuantity !== undefined) updateData.requiredQuantity = requiredQuantity;
        if (rewardGold !== undefined) updateData.rewardGold = rewardGold;
        if (rewardExp !== undefined) updateData.rewardExp = rewardExp;
        if (rewardItems !== undefined) updateData.rewardItems = rewardItems;

        await db.update(missions)
            .set(updateData)
            .where(eq(missions.id, id));

        res.json({ success: true, message: "Mission updated successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to update mission" });
    }
};

// Delete Mission (Admin)
export const deleteMission = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "Mission ID required" });
        }

        // Delete associated user missions first (cascade should handle this, but being explicit)
        await db.delete(userMissions).where(eq(userMissions.missionId, id));

        // Delete the mission
        await db.delete(missions).where(eq(missions.id, id));

        res.json({ success: true, message: "Mission deleted successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to delete mission" });
    }
};
