
import { Request, Response } from "express";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { chapters, crawlJobs, works, crawlChapters } from "../../../../packages/db/src";
// Removed unused imports


import { processBatchBackground } from "./crawlController";

export const scanAndFixGaps = async (req: Request, res: Response) => {
    try {
        const { workId } = req.body;
        if (!workId) return res.status(400).json({ error: "Work ID required" });

        // 1. Get latest job
        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.workId, workId),
            orderBy: [desc(crawlJobs.id)]
        });

        if (!job) return res.status(400).json({ error: "No crawl job found" });

        console.log(`[Gap Scan] Scanning job ${job.id} for work ${workId}...`);

        // 2. Find failed chapters in crawl_chapters
        const failedChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, job.id),
                eq(crawlChapters.status, 'failed')
            )
        });

        // 3. Find "stuck" chapters (summarizing/crawling for too long > 10 mins)
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const stuckChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, job.id),
                sql`(${crawlChapters.status} = 'crawling' OR ${crawlChapters.status} = 'summarizing')`,
                sql`${crawlChapters.createdAt} < ${tenMinsAgo}` // approximate check
            )
        });

        // 4. Find completely missing chapters (User deleted from UI, but marked as completed here)
        const completedChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, job.id),
                eq(crawlChapters.status, 'completed')
            )
        });

        // Get all public chapters for this work
        const publicChapters = await db.query.chapters.findMany({
            where: eq(chapters.workId, workId),
            columns: { chapterNumber: true }
        });
        const existingPublicChapterNumbers = new Set(publicChapters.map(c => c.chapterNumber));

        const chaptersPerSummary = job.chaptersPerSummary || 1;

        const updates = [];
        const fixedIds = [];

        // Fix Failed
        for (const ch of failedChapters) {
            updates.push(ch.id);
        }

        // Fix Stuck
        for (const ch of stuckChapters) {
            updates.push(ch.id);
        }

        // Fix Missing Summaries
        let missingSummaryCount = 0;
        for (const ch of completedChapters) {
            const expectedSummaryChapNum = Math.floor((ch.chapterNumber - 1) / chaptersPerSummary) + 1;
            if (!existingPublicChapterNumbers.has(expectedSummaryChapNum)) {
                updates.push(ch.id);
                missingSummaryCount++;
            }
        }

        if (updates.length > 0) {
            // Reset to pending
            await db.update(crawlChapters)
                .set({
                    status: 'pending',
                    error: null,
                    retryCount: 0,
                    summarizedAt: null,
                    summary: null
                })
                .where(sql`${crawlChapters.id} IN ${updates}`);

            fixedIds.push(...updates);
        }

        // AUTO-TRIGGER processing if we fixed something
        if (fixedIds.length > 0) {
            console.log(`[Gap Fix] Reset ${fixedIds.length} chapters. Triggering batch processing...`);

            // Should verify if job is not completed, if so, set to ready
            if (job.status === 'completed' || job.status === 'failed') {
                await db.update(crawlJobs)
                    .set({ status: 'ready' })
                    .where(eq(crawlJobs.id, job.id));
            }

            // Trigger background process (fire and forget)
            processBatchBackground(job.id, 5, 'Auto-Fix Trigger');
        }

        res.json({
            success: true,
            message: `Scanned. Reset ${fixedIds.length} chapters (Failed: ${failedChapters.length}, Stuck: ${stuckChapters.length}, Missing Summary: ${missingSummaryCount}). Processing triggered.`,
            fixedCount: fixedIds.length,
            gaps: [] // TODO: Implement sequence gap detection if needed
        });

    } catch (e: any) {
        console.error("Scan Gaps Error", e);
        res.status(500).json({ error: e.message });
    }
};

export const fixRange = async (req: Request, res: Response) => {
    try {
        const { workId, start, end } = req.body;
        if (!workId || !start || !end) return res.status(400).json({ error: "Missing parameters" });

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.workId, workId),
            orderBy: [desc(crawlJobs.id)]
        });

        if (!job) return res.status(404).json({ error: "Job not found" });

        // Reset range
        const result = await db.update(crawlChapters)
            .set({
                status: 'pending',
                error: null,
                retryCount: 0,
                summary: null
            })
            .where(and(
                eq(crawlChapters.jobId, job.id),
                sql`${crawlChapters.chapterNumber} >= ${start}`,
                sql`${crawlChapters.chapterNumber} <= ${end}`
            ));

        // Resume job if needed
        await db.update(crawlJobs)
            .set({ status: 'ready' })
            .where(eq(crawlJobs.id, job.id));

        // Trigger
        processBatchBackground(job.id, 5, 'Manual Range Fix');

        res.json({ message: `Triggered fix for range ${start}-${end}` });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const retryChapter = async (req: Request, res: Response) => {
    try {
        const { workId, chapterNumber } = req.body;

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.workId, workId),
            orderBy: [desc(crawlJobs.id)]
        });

        if (!job) return res.status(404).json({ error: "Job not found" });

        await db.update(crawlChapters)
            .set({ status: 'pending', error: null, retryCount: 0 })
            .where(and(
                eq(crawlChapters.jobId, job.id),
                eq(crawlChapters.chapterNumber, chapterNumber)
            ));

        // Resume job
        await db.update(crawlJobs).set({ status: 'ready' }).where(eq(crawlJobs.id, job.id));

        processBatchBackground(job.id, 1, 'Manual Retry');

        res.json({ message: `Retrying chapter ${chapterNumber}` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
