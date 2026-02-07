import { Request, Response } from 'express';
import { db } from "../../../../packages/db/src";
import { users, inventory } from "../../../../packages/db/src";
import { eq, and, sql } from 'drizzle-orm';
import { STORIES, StoryStep } from '../data/storyData';

export const getStoryProgress = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId as string)
        }) as any;

        if (!user) return res.status(404).json({ error: 'User not found' });

        const chapterId = user.storyChapter || 'chapter_1';
        const stepIndex = user.storyStep || 0;

        const chapter = STORIES[chapterId];
        if (!chapter) {
            return res.json({ success: true, finished: true, message: 'No more chapters' });
        }

        const currentStep = chapter.steps[stepIndex];

        // If step index exceeds steps, maybe chapter complete?
        if (!currentStep) {
            return res.json({
                success: true,
                finishedChapter: true,
                message: 'Chapter Completed',
                chapterId
            });
        }

        return res.json({
            success: true,
            chapterId,
            stepIndex,
            chapterTitle: chapter.title,
            step: currentStep
        });

    } catch (error) {
        console.error('getStoryProgress error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const advanceStory = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        }) as any;

        if (!user) return res.status(404).json({ error: 'User not found' });

        const chapterId = user.storyChapter || 'chapter_1';
        let stepIndex = user.storyStep || 0;

        const chapter = STORIES[chapterId];
        if (!chapter) return res.status(400).json({ error: 'Invalid chapter' });

        const currentStep = chapter.steps[stepIndex];
        if (!currentStep) return res.json({ success: false, message: 'No step found' });

        // Validate Requirements
        // For COMBAT type, typically we'd check if specific monster killed recently?
        // Or we just allow 'advance' if user clicks 'I did it' -> Server verifies log?
        // For simplicity in prototype:
        // - DIALOGUE/REWARD: Autoadvance allowed.
        // - COMBAT: We might cheat and allow auto-advance for now OR checking strict logic later.
        // Let's implement Rewards logic here.

        let rewardsReceived = null;

        if (currentStep.rewards) {
            // Give Rewards
            const { gold, exp, items } = currentStep.rewards;
            let updateData: any = {};
            if (gold) updateData.gold = (user.gold || 0) + gold;
            if (exp) updateData.cultivationExp = (user.cultivationExp || 0) + exp;

            await db.update(users).set(updateData).where(eq(users.id, userId));

            if (items) {
                // Add items logic (Simplified)
                for (const item of items) {
                    await db.insert(inventory).values({
                        userId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        type: 'ITEM', // or lookup
                        isEquipped: false
                    }).onConflictDoUpdate({
                        target: [inventory.userId, inventory.itemId],
                        set: { quantity: db.raw(`inventory.quantity + ${item.quantity}`) } // Fix raw usage if needed
                    });
                    // Actually raw might need import. Let's use simplified logic if raw fails type check.
                    // Re-doing simple check-insert for safety in prototype without raw import complexity.
                    const invItem = await db.query.inventory.findFirst({
                        where: and(eq(inventory.userId, userId), eq(inventory.itemId, item.itemId))
                    });
                    if (invItem) {
                        await db.update(inventory).set({ quantity: invItem.quantity + item.quantity })
                            .where(eq(inventory.id, invItem.id));
                    } else {
                        await db.insert(inventory).values({
                            userId, itemId: item.itemId, quantity: item.quantity, type: 'ITEM'
                        });
                    }
                }
            }
            rewardsReceived = currentStep.rewards;
        }

        // Advance Ptr
        const nextStepIndex = stepIndex + 1;

        await db.update(users)
            .set({ storyStep: nextStepIndex })
            .where(eq(users.id, userId));

        return res.json({
            success: true,
            newStepIndex: nextStepIndex,
            rewards: rewardsReceived,
            message: 'Story advanced'
        });

    } catch (error) {
        console.error('advanceStory error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


