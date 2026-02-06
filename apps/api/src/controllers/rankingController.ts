import { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users } from "../../../../packages/db/src";
import { RANKING_TIERS } from "../data/gameData";

// Update ranking points and tier for a user
export async function updateRanking(userId: string, pointsChange: number) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) return;

    const newPoints = Math.max(0, (user.rankingPoints || 0) + pointsChange);

    // Determine new tier
    let newTier = 'BRONZE';
    for (const tier of [...RANKING_TIERS].reverse()) {
        if (newPoints >= tier.minPoints) {
            newTier = tier.tier;
            break;
        }
    }

    await db.update(users)
        .set({
            rankingPoints: newPoints,
            rankTier: newTier
        })
        .where(eq(users.id, userId));
}

// Get leaderboard (top 100 by ranking points)
export const getLeaderboard = async (req: Request, res: Response) => {
    try {
        const topPlayers = await db.select({
            id: users.id,
            name: users.name,
            rankingPoints: users.rankingPoints,
            rankTier: users.rankTier,
            seasonWins: users.seasonWins
        })
            .from(users)
            .orderBy(desc(users.rankingPoints))
            .limit(100);

        res.json({ leaderboard: topPlayers });
    } catch (error) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get current user's tier info
export const getMyTier = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, String(userId))
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const currentTier = RANKING_TIERS.find(t => t.tier === user.rankTier) || RANKING_TIERS[0];
        const nextTier = RANKING_TIERS.find(t => t.minPoints > (user.rankingPoints || 0));

        res.json({
            currentTier: {
                ...currentTier,
                currentPoints: user.rankingPoints || 0
            },
            nextTier,
            seasonWins: user.seasonWins || 0
        });
    } catch (error) {
        console.error("Get My Tier Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
