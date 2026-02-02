import { Request, Response } from "express";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { works, chapters, genres, systemSettings } from "../../../../packages/db/src";

// --- Works ---

export const createWork = async (req: Request, res: Response) => {
    try {
        const { title, author, coverImage, status, slug, genre, description, isHot } = req.body;

        // Basic validation
        if (!title || !slug) {
            return res.status(400).json({ error: "Title and Slug are required" });
        }

        const newWork = await db.insert(works).values({
            title,
            slug,
            author,
            coverImage,
            genre,
            description,
            isHot: isHot || false,
            status: status || "ONGOING",
        }).returning();

        res.status(201).json(newWork[0]);
    } catch (error: any) {
        console.error("Error creating work:", error);
        if (error.code === "23505") { // Postgres unique constraint violation
            return res.status(409).json({ error: "Slug already exists" });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getWorks = async (req: Request, res: Response) => {
    try {
        const allWorks = await db.select().from(works).orderBy(desc(works.updatedAt));
        res.json(allWorks);
    } catch (error) {
        console.error("Error fetching works:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getWorkById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`[API] getWorkById called for ID: ${id}`);
        const work = await db.query.works.findFirst({
            where: eq(works.id, parseInt(id)),
            with: {
                chapters: {
                    orderBy: [asc(chapters.chapterNumber)]
                }
            }
        });

        if (!work) return res.status(404).json({ error: "Work not found" });

        res.json(work);
    } catch (error) {
        console.error("Error fetching work:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


export const updateWork = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, slug, author, coverImage, genre, description, isHot, status } = req.body;

        const updatedWork = await db.update(works)
            .set({
                title,
                slug,
                author,
                coverImage,
                genre,
                description,
                isHot,
                status,
                updatedAt: new Date()
            })
            .where(eq(works.id, parseInt(id)))
            .returning();

        if (updatedWork.length === 0) {
            return res.status(404).json({ error: "Work not found" });
        }

        res.json(updatedWork[0]);
    } catch (error: any) {
        console.error("Error updating work:", error);
        if (error.code === "23505") {
            return res.status(409).json({ error: "Slug already exists" });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteWork = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // First delete related chapters (cascade manually if not set in DB)
        await db.delete(chapters).where(eq(chapters.workId, parseInt(id)));

        // Then delete the work
        const deletedWork = await db.delete(works)
            .where(eq(works.id, parseInt(id)))
            .returning();

        if (deletedWork.length === 0) {
            return res.status(404).json({ error: "Work not found" });
        }

        res.json({ message: "Work deleted successfully" });
    } catch (error) {
        console.error("Error deleting work:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const incrementWorkView = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await db.update(works)
            .set({ views: sql`${works.views} + 1` })
            .where(eq(works.id, parseInt(id)));

        res.status(200).json({ message: "View incremented" });
    } catch (error) {
        console.error("Error incrementing view:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// --- Chapters ---

export const createChapter = async (req: Request, res: Response) => {
    try {
        const { workId, chapterNumber, title, originalText, summary, youtubeId, sourceChapterRange } = req.body;

        if (!workId || !chapterNumber) {
            return res.status(400).json({ error: "workId and chapterNumber are required" });
        }

        // Check if work exists
        const workExists = await db.query.works.findFirst({
            where: eq(works.id, workId)
        });
        if (!workExists) {
            return res.status(404).json({ error: "Work not found" });
        }

        // Insert Chapter
        const newChapter = await db.insert(chapters).values({
            workId,
            chapterNumber,
            title,
            originalText, // Private
            aiText: "", // Placeholder for AI
            summary,
            youtubeId,
            sourceChapterRange,
            status: "DRAFT"
        }).returning();

        // TODO: Trigger AI Service here (Future)

        res.status(201).json(newChapter[0]);
    } catch (error) {
        console.error("Error creating chapter:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const updateChapter = async (req: Request, res: Response) => {
    console.log("updateChapter called with ID:", req.params.id);
    console.log("Request Body:", req.body);
    try {
        const { id } = req.params;
        const { chapterNumber, title, originalText, summary, youtubeId, sourceChapterRange, status } = req.body;

        console.log("Attempting DB update for chapter ID:", id);

        const updateData: any = {
            chapterNumber,
            title,
            originalText,
            summary,
            youtubeId,
            status,
        };

        if (sourceChapterRange !== undefined) {
            updateData.sourceChapterRange = sourceChapterRange;
        }

        console.log("Update Data:", updateData);

        const updatedChapter = await db.update(chapters)
            .set(updateData)
            .where(eq(chapters.id, parseInt(id)))
            .returning();

        console.log("DB Update Result:", updatedChapter);

        if (updatedChapter.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        res.json(updatedChapter[0]);
    } catch (error: any) {
        console.error("Error updating chapter (FULL):", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: "Internal Server Error: " + error.message });
    }
};

export const deleteChapter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const deletedChapter = await db.delete(chapters)
            .where(eq(chapters.id, parseInt(id)))
            .returning();

        if (deletedChapter.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        res.json({ message: "Chapter deleted successfully" });
    } catch (error) {
        console.error("Error deleting chapter:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// --- AI Service ---

import { generateText } from "../services/aiService";

export const generateAIContent = async (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        const text = await generateText(prompt);
        res.json({ text });
    } catch (error: any) {
        console.error("AI Gen Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });


    }
};

// --- Genres ---

export const getGenres = async (req: Request, res: Response) => {
    try {
        const allGenres = await db.select().from(genres).orderBy(desc(genres.createdAt));
        res.json(allGenres);
    } catch (error) {
        console.error("Error fetching genres:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const createGenre = async (req: Request, res: Response) => {
    try {
        const { name, slug, description } = req.body;
        if (!name || !slug) return res.status(400).json({ error: "Name and Slug are required" });

        const newGenre = await db.insert(genres).values({
            name,
            slug,
            description
        }).returning();

        res.status(201).json(newGenre[0]);
    } catch (error: any) {
        console.error("Error creating genre:", error);
        if (error.code === '23505') {
            return res.status(409).json({ error: "Genre already exists" });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteGenre = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await db.delete(genres).where(eq(genres.id, parseInt(id)));
        res.json({ message: "Genre deleted successfully" });
    } catch (error) {
        console.error("Error deleting genre:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// --- Settings ---

export const getSettings = async (req: Request, res: Response) => {
    try {
        const settings = await db.select().from(systemSettings);
        res.json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    try {
        const settingsToUpdate = req.body; // Expect { "GEMINI_API_KEY": "value" }

        for (const [key, value] of Object.entries(settingsToUpdate)) {
            if (typeof value === 'string') {
                await db.insert(systemSettings)
                    .values({ key, value })
                    .onConflictDoUpdate({
                        target: systemSettings.key,
                        set: { value, updatedAt: new Date() }
                    });
            }
        }

        res.json({ message: "Settings updated successfully" });
    } catch (error: any) {
        console.error("Error updating settings:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
};
