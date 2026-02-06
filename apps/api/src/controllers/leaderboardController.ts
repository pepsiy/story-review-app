import { Request, Response } from "express";
import { desc, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users } from "../../../../packages/db/src";

// Leaderboard Settings
const LEADERBOARD_SETTINGS = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
};

// Get Leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
    try {
        const { type = 'cultivation', limit = LEADERBOARD_SETTINGS.DEFAULT_LIMIT } = req.query;

        const requestedLimit = Math.min(
            parseInt(limit as string) || LEADERBOARD_SETTINGS.DEFAULT_LIMIT,
            LEADERBOARD_SETTINGS.MAX_LIMIT
        );

        let leaderboardData: any[] = [];

        switch (type) {
            case 'cultivation':
                // Top players by cultivation exp
                leaderboardData = await db
                    .select({
                        userId: users.id,
                        name: users.name,
                        image: users.image,
                        cultivationLevel: users.cultivationLevel,
                        cultivationExp: users.cultivationExp,
                        gold: users.gold
                    })
                    .from(users)
                    .orderBy(desc(users.cultivationExp), desc(users.gold))
                    .limit(requestedLimit);
                break;

            case 'gold':
                // Top richest players
                leaderboardData = await db
                    .select({
                        userId: users.id,
                        name: users.name,
                        image: users.image,
                        cultivationLevel: users.cultivationLevel,
                        cultivationExp: users.cultivationExp,
                        gold: users.gold
                    })
                    .from(users)
                    .orderBy(desc(users.gold), desc(users.cultivationExp))
                    .limit(requestedLimit);
                break;

            case 'arena':
                // Top arena players by points and season wins
                leaderboardData = await db
                    .select({
                        userId: users.id,
                        name: users.name,
                        image: users.image,
                        cultivationLevel: users.cultivationLevel,
                        rankingPoints: users.rankingPoints,
                        seasonWins: users.seasonWins,
                        cultivationExp: users.cultivationExp
                    })
                    .from(users)
                    .orderBy(desc(users.rankingPoints), desc(users.seasonWins), desc(users.cultivationExp))
                    .limit(requestedLimit);
                break;

            default:
                return res.status(400).json({ error: "Invalid leaderboard type. Use: cultivation, gold, or arena" });
        }

        // Add ranking
        const rankedData = leaderboardData.map((player, index) => ({
            rank: index + 1,
            ...player
        }));

        res.json({
            type,
            totalPlayers: rankedData.length,
            data: rankedData
        });
    } catch (error: any) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get User Rank (check user's position in leaderboard)
export const getUserRank = async (req: Request, res: Response) => {
    try {
        const { userId, type = 'cultivation' } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await db.query.users.findFirst({
            where: sql`${users.id} = ${userId}`
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let rank = 0;
        let total = 0;

        switch (type) {
            case 'cultivation':
                // Count how many users have higher cultivation exp
                const cultivationResult = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users)
                    .where(sql`${users.cultivationExp} > ${user.cultivationExp}`);
                rank = (cultivationResult[0]?.count || 0) + 1;

                const cultivationTotal = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users);
                total = cultivationTotal[0]?.count || 0;
                break;

            case 'gold':
                // Count how many users have more gold
                const goldResult = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users)
                    .where(sql`${users.gold} > ${user.gold}`);
                rank = (goldResult[0]?.count || 0) + 1;

                const goldTotal = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users);
                total = goldTotal[0]?.count || 0;
                break;

            case 'arena':
                // Count how many users have higher arena points
                const arenaResult = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users)
                    .where(sql`${users.rankingPoints} > ${user.rankingPoints || 0}`);
                rank = (arenaResult[0]?.count || 0) + 1;

                const arenaTotal = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(users);
                total = arenaTotal[0]?.count || 0;
                break;

            default:
                return res.status(400).json({ error: "Invalid type" });
        }

        res.json({
            userId: user.id,
            name: user.name,
            type,
            rank,
            total,
            percentile: total > 0 ? Math.round((1 - rank / total) * 100) : 0
        });
    } catch (error) {
        console.error("Get User Rank Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
