import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, missions, userMissions, inventory } from "../../../../packages/db/src";

// Get all available missions + user's active missions
export const getMissions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        // Get all missions
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

// Accept a mission
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
                eq(userMissions.status, 'IN_PROGRESS')
            )
        });

        if (!userMission) return res.status(400).json({ error: "Mission not active" });

        // Check requirements (for COLLECT type)
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
