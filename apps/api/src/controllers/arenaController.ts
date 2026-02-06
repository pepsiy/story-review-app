import { Request, Response } from "express";
import { eq, sql, and, ne } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, arenaBattles, gameLogs } from "../../../../packages/db/src";
import { ARENA_SETTINGS } from "../data/gameData";
import { updateRanking } from "./rankingController";

// Find arena match (opponent with similar level)
export const findArenaMatch = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userExp = user.cultivationExp || 0;

        // Find opponent with similar exp (±2000 exp range)
        const potentialOpponents = await db.select()
            .from(users)
            .where(and(
                ne(users.id, userId),
                sql`ABS(${users.cultivationExp} - ${userExp}) < 2000`
            ))
            .limit(10);

        if (potentialOpponents.length === 0) {
            return res.status(404).json({ error: "No suitable opponents found" });
        }

        // Random opponent
        const opponent = potentialOpponents[Math.floor(Math.random() * potentialOpponents.length)];

        res.json({ opponent: { id: opponent.id, name: opponent.name, cultivationExp: opponent.cultivationExp } });
    } catch (error) {
        console.error("Find Match Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Start arena battle (turn-based simulation)
export const startArenaBattle = async (req: Request, res: Response) => {
    try {
        const { player1Id, player2Id } = req.body;

        if (!player1Id || !player2Id) {
            return res.status(400).json({ error: "player1Id and player2Id required" });
        }

        const player1 = await db.query.users.findFirst({ where: eq(users.id, player1Id) });
        const player2 = await db.query.users.findFirst({ where: eq(users.id, player2Id) });

        if (!player1 || !player2) {
            return res.status(404).json({ error: "Player not found" });
        }

        // Combat simulation
        let p1HP = 100;
        let p2HP = 100;
        const rounds = [];

        for (let turn = 0; turn < ARENA_SETTINGS.MAX_TURNS && p1HP > 0 && p2HP > 0; turn++) {
            const p1Damage = Math.floor((player1.cultivationExp || 0) / 50) + Math.floor(Math.random() * 20) + 20;
            const p2Damage = Math.floor((player2.cultivationExp || 0) / 50) + Math.floor(Math.random() * 20) + 20;

            p2HP -= p1Damage;
            p1HP -= p2Damage;

            rounds.push({ turn: turn + 1, p1Damage, p2Damage, p1HP: Math.max(0, p1HP), p2HP: Math.max(0, p2HP) });
        }

        const winnerId = p1HP > p2HP ? player1Id : player2Id;
        const loserId = winnerId === player1Id ? player2Id : player1Id;

        //  Distribute rewards
        const winnerGold = ARENA_SETTINGS.WINNER_GOLD;
        const loserGold = ARENA_SETTINGS.LOSER_GOLD;
        const winnerExp = ARENA_SETTINGS.WINNER_EXP;
        const loserExp = ARENA_SETTINGS.LOSER_EXP;

        await db.update(users)
            .set({
                gold: sql`${users.gold} + ${winnerGold}`,
                cultivationExp: sql`${users.cultivationExp} + ${winnerExp}`,
                seasonWins: sql`${users.seasonWins} + 1`
            })
            .where(eq(users.id, winnerId));

        await db.update(users)
            .set({
                gold: sql`${users.gold} + ${loserGold}`,
                cultivationExp: sql`${users.cultivationExp} + ${loserExp}`
            })
            .where(eq(users.id, loserId));

        // Update ranking points
        await updateRanking(winnerId, ARENA_SETTINGS.WINNER_POINTS);
        await updateRanking(loserId, ARENA_SETTINGS.LOSER_POINTS);

        // Log battle
        await db.insert(arenaBattles).values({
            player1Id,
            player2Id,
            winnerId,
            battleLog: JSON.stringify(rounds),
            player1Reward: winnerId === player1Id ? winnerGold : loserGold,
            player2Reward: winnerId === player2Id ? winnerGold : loserGold
        });

        await db.insert(gameLogs).values([
            {
                userId: winnerId,
                action: 'ARENA_WIN',
                description: `Thắng trong Arena, nhận ${winnerGold} vàng và ${winnerExp} exp`
            },
            {
                userId: loserId,
                action: 'ARENA_LOSE',
                description: `Thua trong Arena, nhận ${loserGold} vàng và ${loserExp} exp`
            }
        ]);

        res.json({
            winnerId,
            battleLog: rounds,
            rewards: {
                winner: { gold: winnerGold, exp: winnerExp, points: ARENA_SETTINGS.WINNER_POINTS },
                loser: { gold: loserGold, exp: loserExp, points: ARENA_SETTINGS.LOSER_POINTS }
            }
        });
    } catch (error) {
        console.error("Arena Battle Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get arena history
export const getArenaHistory = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const battles = await db.select()
            .from(arenaBattles)
            .where(sql`${arenaBattles.player1Id} = ${userId} OR ${arenaBattles.player2Id} = ${userId}`)
            .limit(50);

        res.json({ battles });
    } catch (error) {
        console.error("Get Arena History Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
