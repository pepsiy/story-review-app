import { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, raidLogs, gameLogs } from "../../../../packages/db/src";
import { RAID_SETTINGS } from "../data/gameData";

// Helper: Reset daily raids if needed
async function checkAndResetDailyRaids(userId: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) return;

    const now = new Date();
    const lastReset = user.lastRaidReset ? new Date(user.lastRaidReset) : new Date(0);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
        await db.update(users)
            .set({
                raidsToday: 0,
                lastRaidReset: now
            })
            .where(eq(users.id, userId));
    }
}

// Initiate raid on another player
export const initiateRaid = async (req: Request, res: Response) => {
    try {
        const { attackerId, victimId } = req.body;

        if (!attackerId || !victimId) {
            return res.status(400).json({ error: "attackerId and victimId required" });
        }

        if (attackerId === victimId) {
            return res.status(400).json({ error: "Cannot raid yourself" });
        }

        // Check daily raid reset
        await checkAndResetDailyRaids(attackerId);

        // Get attacker data
        const attacker = await db.query.users.findFirst({
            where: eq(users.id, attackerId)
        });

        if (!attacker) {
            return res.status(404).json({ error: "Attacker not found" });
        }

        // Check daily limit
        if ((attacker.raidsToday || 0) >= RAID_SETTINGS.DAILY_LIMIT) {
            return res.status(400).json({
                error: `Daily raid limit reached (${RAID_SETTINGS.DAILY_LIMIT}/day)`
            });
        }

        // Check gold cost
        if ((attacker.gold || 0) < RAID_SETTINGS.GOLD_COST) {
            return res.status(400).json({
                error: `Insufficient gold. Raid costs ${RAID_SETTINGS.GOLD_COST} gold`
            });
        }

        // Get victim data
        const victim = await db.query.users.findFirst({
            where: eq(users.id, victimId)
        });

        if (!victim) {
            return res.status(404).json({ error: "Victim not found" });
        }

        // Check protection status
        if (victim.protectionUntil) {
            const now = new Date();
            const protectionEnd = new Date(victim.protectionUntil);
            if (now < protectionEnd) {
                const minutesLeft = Math.ceil((protectionEnd.getTime() - now.getTime()) / (1000 * 60));
                return res.status(400).json({
                    error: `Target is protected for ${minutesLeft} more minutes`
                });
            }
        }

        // Deduct raid cost from attacker
        await db.update(users)
            .set({
                gold: (attacker.gold || 0) - RAID_SETTINGS.GOLD_COST,
                raidsToday: (attacker.raidsToday || 0) + 1
            })
            .where(eq(users.id, attackerId));

        // Calculate success chance
        const attackerExp = attacker.cultivationExp || 0;
        const victimExp = victim.cultivationExp || 0;
        const levelDifference = Math.floor((attackerExp - victimExp) / 1000); // Rough level difference

        const successChance = Math.min(
            0.9, // Max 90%
            Math.max(
                0.1, // Min 10%
                RAID_SETTINGS.SUCCESS_CHANCE_BASE + (levelDifference * RAID_SETTINGS.LEVEL_ADVANTAGE_BONUS)
            )
        );

        const roll = Math.random();
        const success = roll < successChance;

        let goldStolen = 0;

        if (success) {
            // Calculate stolen gold
            goldStolen = Math.floor((victim.gold || 0) * RAID_SETTINGS.STEAL_PERCENTAGE);

            if (goldStolen > 0) {
                // Transfer gold
                await db.update(users)
                    .set({ gold: (victim.gold || 0) - goldStolen })
                    .where(eq(users.id, victimId));

                await db.update(users)
                    .set({ gold: sql`${users.gold} + ${goldStolen}` })
                    .where(eq(users.id, attackerId));

                // Set protection for victim
                const protectionUntil = new Date();
                protectionUntil.setHours(protectionUntil.getHours() + RAID_SETTINGS.PROTECTION_COOLDOWN_HOURS);

                await db.update(users)
                    .set({ protectionUntil })
                    .where(eq(users.id, victimId));
            }
        }

        // Log raid
        await db.insert(raidLogs).values({
            attackerId,
            victimId,
            success,
            goldStolen
        });

        // Game logs
        await db.insert(gameLogs).values({
            userId: attackerId,
            action: success ? 'RAID_SUCCESS' : 'RAID_FAILED',
            description: success
                ? `Đánh cướp thành công ${goldStolen} vàng từ ${victim.name}`
                : `Đánh cướp thất bại vào ${victim.name}`
        });

        await db.insert(gameLogs).values({
            userId: victimId,
            action: 'RAIDED',
            description: success
                ? `Bị ${attacker.name} đánh cướp ${goldStolen} vàng`
                : `${attacker.name} đã cố gắng đánh cướp nhưng thất bại`
        });

        res.json({
            success,
            goldStolen,
            successChance: Math.round(successChance * 100),
            raidsRemaining: RAID_SETTINGS.DAILY_LIMIT - ((attacker.raidsToday || 0) + 1),
            message: success
                ? `Đánh cướp thành công! Nhận được ${goldStolen} vàng`
                : `Đánh cướp thất bại! Mất ${RAID_SETTINGS.GOLD_COST} vàng`
        });
    } catch (error) {
        console.error("Raid Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get raid history for a user
export const getRaidHistory = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        // Get raids where user was attacker or victim
        const raids = await db.select({
            raid: raidLogs,
            attacker: users,
            victim: users
        })
            .from(raidLogs)
            .leftJoin(users, eq(raidLogs.attackerId, users.id))
            .where(
                sql`${raidLogs.attackerId} = ${userId} OR ${raidLogs.victimId} = ${userId}`
            )
            .orderBy(desc(raidLogs.createdAt))
            .limit(50);

        res.json({ raids });
    } catch (error) {
        console.error("Get Raid History Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get protection status
export const getProtectionStatus = async (req: Request, res: Response) => {
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

        // Check daily reset
        await checkAndResetDailyRaids(String(userId));

        const now = new Date();
        const isProtected = user.protectionUntil && new Date(user.protectionUntil) > now;

        let minutesRemaining = 0;
        if (isProtected && user.protectionUntil) {
            minutesRemaining = Math.ceil(
                (new Date(user.protectionUntil).getTime() - now.getTime()) / (1000 * 60)
            );
        }

        res.json({
            isProtected,
            protectionUntil: user.protectionUntil,
            minutesRemaining,
            raidsToday: user.raidsToday || 0,
            raidsRemaining: RAID_SETTINGS.DAILY_LIMIT - (user.raidsToday || 0)
        });
    } catch (error) {
        console.error("Get Protection Status Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
