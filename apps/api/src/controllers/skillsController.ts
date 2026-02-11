// Phase 33: Skills Management Controller
// API endpoints for learning, equipping, and managing user skills

import { Request, Response } from 'express';
import { db } from '@repo/db';
import { users, skills, userSkills, skillBooks } from '@repo/db';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ===================================
// GET /game/skills
// Get user's learned skills and equipped slots
// ===================================
export const getUserSkills = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        // Fetch all learned skills
        const learnedSkills = await db.query.userSkills.findMany({
            where: eq(userSkills.userId, userId as string),
            with: {
                skill: true
            }
        });

        // Extract equipped slots (1-4)
        const equippedSlots: (string | null)[] = [null, null, null, null];
        learnedSkills.forEach(us => {
            if (us.equippedSlot !== null && us.equippedSlot >= 1 && us.equippedSlot <= 4) {
                equippedSlots[us.equippedSlot - 1] = us.skillId;
            }
        });

        return res.json({
            skills: learnedSkills.map(us => ({
                id: us.skill.id,
                name: us.skill.name,
                description: us.skill.description,
                tier: us.skill.tier,
                element: us.skill.element,
                manaCost: us.skill.manaCost,
                cooldown: us.skill.cooldown,
                damageMultiplier: us.skill.damageMultiplier,
                level: us.level,
                timesUsed: us.timesUsed
            })),
            equippedSlots
        });

    } catch (error) {
        console.error('getUserSkills error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ===================================
// POST /game/skills/learn
// Learn a skill from a skill book
// ===================================
export const learnSkill = async (req: Request, res: Response) => {
    try {
        const { userId, skillBookId } = req.body;

        if (!userId || !skillBookId) {
            return res.status(400).json({ error: 'Missing userId or skillBookId' });
        }

        // Fetch skill book
        const book = await db.query.skillBooks.findFirst({
            where: eq(skillBooks.id, skillBookId)
        });

        if (!book) {
            return res.status(404).json({ error: 'Skill book not found' });
        }

        // Check if already learned
        const existing = await db.query.userSkills.findFirst({
            where: and(
                eq(userSkills.userId, userId),
                eq(userSkills.skillId, book.skillId)
            )
        });

        if (existing) {
            return res.status(400).json({ error: 'Bạn đã học kỹ năng này rồi!' });
        }

        // Learn skill
        const userSkillId = randomUUID();
        await db.insert(userSkills).values({
            id: userSkillId,
            userId,
            skillId: book.skillId,
            level: 1,
            timesUsed: 0,
            equippedSlot: null
        });

        // TODO: Remove skill book from inventory (if implemented)

        return res.json({
            message: `Đã học kỹ năng: ${book.name}!`,
            skillId: book.skillId
        });

    } catch (error) {
        console.error('learnSkill error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ===================================
// POST /game/skills/equip
// Equip skill to a slot (1-4)
// ===================================
export const equipSkill = async (req: Request, res: Response) => {
    try {
        const { userId, skillId, slot } = req.body;

        if (!userId || !skillId || slot === undefined) {
            return res.status(400).json({ error: 'Missing userId, skillId, or slot' });
        }

        if (slot < 0 || slot > 3) {
            return res.status(400).json({ error: 'Slot must be 0-3 (representing slots 1-4)' });
        }

        const actualSlot = slot + 1; // Convert 0-3 to 1-4

        // Check if user owns this skill
        const userSkill = await db.query.userSkills.findFirst({
            where: and(
                eq(userSkills.userId, userId),
                eq(userSkills.skillId, skillId)
            )
        });

        if (!userSkill) {
            return res.status(404).json({ error: 'Bạn chưa học kỹ năng này!' });
        }

        // Unequip any skill currently in this slot
        await db.update(userSkills)
            .set({ equippedSlot: null })
            .where(and(
                eq(userSkills.userId, userId),
                eq(userSkills.equippedSlot, actualSlot)
            ));

        // Equip the skill
        await db.update(userSkills)
            .set({ equippedSlot: actualSlot })
            .where(eq(userSkills.id, userSkill.id));

        return res.json({ message: `Đã trang bị skill vào slot ${actualSlot}!` });

    } catch (error) {
        console.error('equipSkill error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ===================================
// POST /game/skills/unequip
// Unequip skill from a slot
// ===================================
export const unequipSkill = async (req: Request, res: Response) => {
    try {
        const { userId, slot } = req.body;

        if (!userId || slot === undefined) {
            return res.status(400).json({ error: 'Missing userId or slot' });
        }

        if (slot < 0 || slot > 3) {
            return res.status(400).json({ error: 'Slot must be 0-3 (representing slots 1-4)' });
        }

        const actualSlot = slot + 1; // Convert 0-3 to 1-4

        // Unequip
        await db.update(userSkills)
            .set({ equippedSlot: null })
            .where(and(
                eq(userSkills.userId, userId),
                eq(userSkills.equippedSlot, actualSlot)
            ));

        return res.json({ message: `Đã gỡ skill khỏi slot ${actualSlot}!` });

    } catch (error) {
        console.error('unequipSkill error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
