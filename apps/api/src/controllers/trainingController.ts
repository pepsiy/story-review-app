
import { Request, Response } from 'express';
// Fix relative path to local monorepo package
import { db } from "../../../../packages/db/src";
import { users, inventory } from "../../../../packages/db/src";
import { eq, and } from 'drizzle-orm';
import { TRAINING_MAPS, CULTIVATION_LEVELS } from '../data/gameData';

export const getTrainingState = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        let estimatedRewards = null;
        if (user.trainingMapId && user.trainingStartedAt && TRAINING_MAPS[user.trainingMapId]) {
            const map = TRAINING_MAPS[user.trainingMapId];
            const now = new Date();
            const elapsedMinutes = Math.floor((now.getTime() - user.trainingStartedAt.getTime()) / 60000);

            if (elapsedMinutes > 0) {
                estimatedRewards = {
                    exp: elapsedMinutes * map.expPerMin,
                    minutes: elapsedMinutes
                };
            }
        }

        return res.json({
            trainingMapId: user.trainingMapId,
            trainingStartedAt: user.trainingStartedAt,
            estimatedRewards
        });
    } catch (error) {
        console.error('getTrainingState error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const startTraining = async (req: Request, res: Response) => {
    try {
        const { userId, mapId } = req.body;
        if (!userId || !mapId) return res.status(400).json({ error: 'Missing parameters' });

        const map = TRAINING_MAPS[mapId];
        if (!map) return res.status(400).json({ error: 'Map not found' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check level requirement
        const userLevelIndex = CULTIVATION_LEVELS.findIndex(l => l.name === user.cultivationLevel);
        if (userLevelIndex < map.reqLevel) {
            return res.status(400).json({ error: `Cần đạt cảnh giới ${CULTIVATION_LEVELS[map.reqLevel].name} để vào map này.` });
        }

        // Check if already training
        if (user.trainingMapId) {
            return res.status(400).json({ error: 'Đang luyện tập ở nơi khác. Hãy thu hoạch trước.' });
        }

        await db.update(users)
            .set({
                trainingMapId: mapId,
                trainingStartedAt: new Date()
            })
            .where(eq(users.id, userId));

        return res.json({ success: true, message: `Bắt đầu luyện tập tại ${map.name}` });

    } catch (error) {
        console.error('startTraining error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Phase 32: Real-time progress for AFK animation
export const getRealtimeProgress = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user || !user.trainingMapId || !user.trainingStartedAt) {
            return res.json({
                isTraining: false,
                totalKills: 0,
                goldEarned: 0,
                expEarned: 0
            });
        }

        const map = TRAINING_MAPS[user.trainingMapId];
        if (!map) {
            return res.json({ isTraining: false, totalKills: 0, goldEarned: 0, expEarned: 0 });
        }

        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - user.trainingStartedAt.getTime()) / 1000);
        const elapsedMinutes = elapsedSeconds / 60;

        // Calculate progress
        const totalKills = Math.floor(elapsedMinutes * map.killRate);
        const goldEarned = totalKills * map.goldPerKill;
        const expEarned = totalKills * map.expPerKill;

        return res.json({
            isTraining: true,
            mapId: user.trainingMapId,
            mapName: map.name,
            enemyName: map.enemyName,
            enemyIcon: map.enemyIcon,
            totalKills,
            goldEarned,
            expEarned,
            elapsedSeconds,
            killRate: map.killRate,
            goldPerKill: map.goldPerKill,
            expPerKill: map.expPerKill
        });

    } catch (error) {
        console.error('getRealtimeProgress error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const claimTrainingRewards = async (req: Request, res: Response) => {
    try {
        const { userId, stop } = req.body; // stop: boolean (True = Stop training, False = Claim & Continue)
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user || !user.trainingMapId || !user.trainingStartedAt) {
            return res.status(400).json({ error: 'Không có hoạt động luyện tập nào.' });
        }

        const map = TRAINING_MAPS[user.trainingMapId];
        if (!map) {
            // Reset invalid state
            await db.update(users).set({ trainingMapId: null, trainingStartedAt: null }).where(eq(users.id, userId));
            return res.status(400).json({ error: 'Map data error' });
        }

        const now = new Date();
        const elapsedMinutes = Math.floor((now.getTime() - user.trainingStartedAt.getTime()) / 60000);

        if (elapsedMinutes < 1) {
            if (stop) {
                await db.update(users).set({ trainingMapId: null, trainingStartedAt: null }).where(eq(users.id, userId));
                return res.json({ success: true, message: 'Đã dừng luyện tập (Chưa đủ thời gian nhận thưởng)' });
            }
            return res.status(400).json({ error: 'Chưa đủ thời gian để nhận thưởng (Tối thiểu 1 phút)' });
        }

        const limitMinutes = 60 * 24; // Max 24h
        const effectiveMinutes = Math.min(elapsedMinutes, limitMinutes);

        const expGained = effectiveMinutes * map.expPerMin;

        // Item Drops Logic
        const earnedItems: { itemId: string, quantity: number, name: string }[] = [];

        // Loop through minutes to roll for drops (Simplified: Loop effectiveMinutes times is too heavy, roll batch)
        // Better: Roll specific number of times based on minutes.
        // Assume 1 roll per minute.

        // Optimization: Don't loop 1000 times.
        // For each reward type, Poisson distribution or Binomial approximation.
        // E.g. Chance 0.1 per minute. 100 mins -> Expected 10.

        for (const reward of map.rewards) {
            let quantity = 0;
            // Simple Monte Carlo for small minutes, or Expected Value for large?
            // Let's stick to simple prob check per minute for now, capped at reasonable loops.
            // Or just use Expected Value + Variance.

            // Method: Binomial distribution trial
            // n = effectiveMinutes, p = reward.chance
            // Mean = n*p.
            // Javascript doesn't have good stat lib built-in.

            // Simple loop for now (Max 1440 loops is fine for V8)
            for (let i = 0; i < effectiveMinutes; i++) {
                if (Math.random() < reward.chance) {
                    quantity += 1;
                }
            }

            if (quantity > 0) {
                earnedItems.push({ itemId: reward.itemId, quantity, name: reward.itemId }); // Need Item Name mapping
            }
        }

        // Update User
        // 1. Add Exp
        const newExp = (user.cultivationExp || 0) + expGained;

        const updateData: any = {
            cultivationExp: newExp,
            trainingStartedAt: stop ? null : now, // Reset time if continue, or null if stop
            trainingMapId: stop ? null : user.trainingMapId
        };

        await db.update(users)
            .set(updateData)
            .where(eq(users.id, userId));

        // 2. Add Items
        for (const item of earnedItems) {
            // Check existing
            const existing = await db.query.inventory.findFirst({
                where: and(eq(inventory.userId, userId), eq(inventory.itemId, item.itemId))
            });
            if (existing) {
                await db.update(inventory)
                    .set({ quantity: existing.quantity + item.quantity })
                    .where(eq(inventory.id, existing.id));
            } else {
                await db.insert(inventory).values({
                    userId,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    type: 'PRODUCT' // Fallback, should lookup
                });
            }
        }

        return res.json({
            success: true,
            message: `Quy đổi ${effectiveMinutes} phút tu luyện.`,
            rewards: {
                exp: expGained,
                items: earnedItems
            }
        });

    } catch (error) {
        console.error('claimTrainingRewards error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
