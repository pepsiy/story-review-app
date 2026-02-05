
import { Request, Response } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { chapters, crawlJobs, works, crawlChapters } from "../../../../packages/db/src";
// Removed unused imports


export const scanAndFixGaps = async (req: Request, res: Response) => {
    try {
        const { workId } = req.body;
        if (!workId) return res.status(400).json({ error: "Work ID required" });

        // 1. Get all existing published chapters to find gaps
        const existingChapters = await db.query.chapters.findMany({
            where: eq(chapters.workId, workId),
            orderBy: [asc(chapters.chapterNumber)],
            columns: { chapterNumber: true }
        });

        if (existingChapters.length === 0) {
            return res.json({ message: "No chapters found to scan gaps for." });
        }

        const maxChapter = existingChapters[existingChapters.length - 1].chapterNumber;
        const existingSet = new Set(existingChapters.map(c => c.chapterNumber));
        const missingChapters = [];

        for (let i = 1; i <= maxChapter; i++) {
            if (!existingSet.has(i)) {
                missingChapters.push(i);
            }
        }

        console.log(`[Gap Scan] Work ${workId}: Found ${missingChapters.length} missing chapters: ${missingChapters.join(', ')}`);

        if (missingChapters.length === 0) {
            return res.json({ success: true, message: "No gaps found.", gaps: [] });
        }

        // 2. Get Job Config to calculate source range
        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.workId, workId),
            orderBy: [desc(crawlJobs.id)]
        });

        if (!job) return res.status(400).json({ error: "No crawl job found for this work" });

        const batchSize = job.batchSize || 5;
        const triggeredFixes = [];

        // 3. Trigger fix for each missing chapter
        for (const missingChapNum of missingChapters) {
            // Calculate source range
            // Example: Batch 5. Missing Chap 1 -> Source 1-5. Missing Chap 2 -> Source 6-10.
            const startSource = (missingChapNum - 1) * batchSize + 1;
            const endSource = missingChapNum * batchSize;

            console.log(`[Gap Fix] Fixing Chapter ${missingChapNum} (Source: ${startSource}-${endSource})...`);

            // Re-trigger crawl/summarize logic
            // We need to verify if source crawl chapters exist, if not, create 'pending'

            // Loop through source range to ensure crawl_chapters exist
            for (let sourceChap = startSource; sourceChap <= endSource; sourceChap++) {
                // Check if exists
                const existingSource = await db.query.crawlChapters.findFirst({
                    where: and(
                        eq(crawlChapters.jobId, job.id),
                        eq(crawlChapters.chapterNumber, sourceChap)
                    )
                });

                if (!existingSource) {
                    // Create if missing entirely
                    await db.insert(crawlChapters).values({
                        jobId: job.id,
                        workId: workId,
                        chapterNumber: sourceChap,
                        sourceUrl: `${job.sourceUrl}/chuong-${sourceChap}`, // Approximation, real url might need fetch
                        status: 'pending'
                    });
                } else {
                    // Reset to pending if failed or stuck
                    await db.update(crawlChapters)
                        .set({ status: 'pending', error: null, retryCount: 0 })
                        .where(eq(crawlChapters.id, existingSource.id));
                }
            }

            triggeredFixes.push({
                chapter: missingChapNum,
                sourceRange: `${startSource}-${endSource}`
            });
        }

        res.json({
            success: true,
            message: `Found ${missingChapters.length} gaps. Triggered fix for all.`,
            gaps: missingChapters,
            fixes: triggeredFixes
        });

    } catch (e) {
        console.error("Scan Gaps Error", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
