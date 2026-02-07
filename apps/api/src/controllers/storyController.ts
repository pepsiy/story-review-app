import { Request, Response } from 'express';
import { db } from "../../../../packages/db/src";
import { users, inventory } from "../../../../packages/db/src";
import { eq, and } from 'drizzle-orm';
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

        let rewardsReceived = null;

        if (currentStep.rewards) {
            const { gold, exp, items } = currentStep.rewards;
            let updateData: any = {};
            if (gold) updateData.gold = (user.gold || 0) + gold;
            if (exp) updateData.cultivationExp = (user.cultivationExp || 0) + exp;

            if (Object.keys(updateData).length > 0) {
                await db.update(users).set(updateData).where(eq(users.id, userId));
            }

            if (items) {
                for (const item of items) {
                    const existingItem = await db.query.inventory.findFirst({
                        where: and(eq(inventory.userId, userId), eq(inventory.itemId, item.itemId))
                    });

                    if (existingItem) {
                        await db.update(inventory)
                            .set({ quantity: existingItem.quantity + item.quantity })
                            .where(eq(inventory.id, existingItem.id));
                    } else {
                        await db.insert(inventory).values({
                            userId,
                            itemId: item.itemId,
                            quantity: item.quantity,
                            type: 'ITEM'
                        });
                    }
                }
            }
            rewardsReceived = currentStep.rewards;
        }

        const nextStepIndex = stepIndex + 1;

        await db.update(users)
            .set({ storyStep: nextStepIndex } as any)
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
