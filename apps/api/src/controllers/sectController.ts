import { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, sects } from "../../../../packages/db/src";

// Config
const SECT_CREATE_COST = 50000;
const SECT_MAX_MEMBERS = 20;

export const createSect = async (req: Request, res: Response) => {
    try {
        const { userId, name, description } = req.body;
        if (!userId || !name) return res.status(400).json({ error: "Missing info" });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.sectId) return res.status(400).json({ error: "Already in a sect" });
        if ((user.gold || 0) < SECT_CREATE_COST) return res.status(400).json({ error: `Need ${SECT_CREATE_COST} Gold` });

        // Check name unique
        const existing = await db.query.sects.findFirst({ where: eq(sects.name, name) });
        if (existing) return res.status(400).json({ error: "Sect name taken" });

        await db.transaction(async (tx) => {
            // Deduct Gold
            await tx.update(users)
                .set({ gold: (user.gold || 0) - SECT_CREATE_COST })
                .where(eq(users.id, userId));

            // Create Sect
            const newSect = await tx.insert(sects).values({
                name,
                description,
                leaderId: userId,
                level: 1,
                resources: 0
            }).returning();

            // Update User Role
            await tx.update(users)
                .set({ sectId: newSect[0].id, sectRole: 'LEADER' })
                .where(eq(users.id, userId));
        });

        res.json({ success: true, message: "Sect created successfully!" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Create Sect Failed" });
    }
};

export const joinSect = async (req: Request, res: Response) => {
    try {
        const { userId, sectId } = req.body;

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.sectId) return res.status(400).json({ error: "Already in a sect" });

        const sect = await db.query.sects.findFirst({ where: eq(sects.id, sectId) });
        if (!sect) return res.status(404).json({ error: "Sect not found" });

        // Check member count (approximation)
        // Ideally we count users where sectId = sectId
        // Drizzle count?
        const members = await db.select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.sectId, sectId));

        if (Number(members[0].count) >= SECT_MAX_MEMBERS) {
            return res.status(400).json({ error: "Sect is full" });
        }

        await db.update(users)
            .set({ sectId, sectRole: 'MEMBER' })
            .where(eq(users.id, userId));

        res.json({ success: true, message: `Joined ${sect.name}!` });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Join Failed" });
    }
};

export const leaveSect = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user || !user.sectId) return res.status(400).json({ error: "Not in a sect" });

        if (user.sectRole === 'LEADER') {
            return res.status(400).json({ error: "Leader cannot leave. Transfer leadership first." });
        }

        await db.update(users)
            .set({ sectId: null, sectRole: null }) // Drizzle might complain if null not allowed, but definition allows null
            .where(eq(users.id, userId));

        res.json({ success: true, message: "Left sect." });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Leave Failed" });
    }
};

export const getSects = async (req: Request, res: Response) => {
    try {
        const list = await db.select().from(sects).orderBy(desc(sects.level), desc(sects.resources)).limit(20);
        res.json(list);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Fetch Failed" });
    }
};

export const getSectInfo = async (req: Request, res: Response) => {
    try {
        const { sectId } = req.query as { sectId: string };
        const id = parseInt(sectId);

        if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

        const sect = await db.query.sects.findFirst({ where: eq(sects.id, id) });
        if (!sect) return res.status(404).json({ error: "Not found" });

        const members = await db.select({
            id: users.id,
            name: users.name,
            image: users.image,
            role: users.sectRole,
            cultivationLevel: users.cultivationLevel
        })
            .from(users)
            .where(eq(users.sectId, id));

        res.json({ sect, members });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Fetch Error" });
    }
};
