import { Request, Response } from "express";
import { db } from "../../../../packages/db/src";
import { crawlJobs, crawlChapters, works, chapters } from "../../../../packages/db/src";
import { eq, and, sql } from "drizzle-orm";
import { crawlService } from "../services/crawlService";
import { telegramService } from "../services/telegramService";
import { summarizeChapter } from "../services/aiService";

/**
 * Initialize crawl job - Crawl all chapter URLs
 */
export const initCrawl = async (req: Request, res: Response) => {
    try {
        const { workId, sourceUrl, chaptersPerSummary, targetStartChapter, targetEndChapter } = req.body;

        if (!workId || !sourceUrl) {
            return res.status(400).json({ error: "workId and sourceUrl are required" });
        }

        // Check if work exists
        const work = await db.query.works.findFirst({
            where: eq(works.id, workId)
        });

        if (!work) {
            return res.status(404).json({ error: "Work not found" });
        }

        // Check if crawl job already exists for this work
        const existingJob = await db.query.crawlJobs.findFirst({
            where: and(
                eq(crawlJobs.workId, workId),
                sql`${crawlJobs.status} != 'completed' AND ${crawlJobs.status} != 'failed'`
            )
        });

        if (existingJob) {
            return res.status(400).json({
                error: "An active crawl job already exists for this work",
                jobId: existingJob.id
            });
        }

        // Create crawl job (status: initializing)
        const [job] = await db.insert(crawlJobs).values({
            workId,
            sourceUrl,
            status: 'initializing',
            chaptersPerSummary: chaptersPerSummary || 1,
            targetStartChapter: targetStartChapter || null,
            targetEndChapter: targetEndChapter || null
        }).returning();

        // Start crawling chapter list (async)
        console.log(`🚀 Starting crawl for work ${workId}: ${sourceUrl}`);

        // This runs in background
        crawlChapterListBackground(job.id, sourceUrl, work.title);

        res.json({
            message: "Crawl job initialized",
            jobId: job.id,
            status: 'initializing'
        });
    } catch (error: any) {
        console.error("Error initializing crawl:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Background function to crawl chapter list
 */
async function crawlChapterListBackground(jobId: number, sourceUrl: string, workTitle: string) {
    try {
        // Update status to crawling
        await db.update(crawlJobs)
            .set({ status: 'crawling', startedAt: new Date() })
            .where(eq(crawlJobs.id, jobId));

        // Crawl chapter list
        const chaptersList = await crawlService.crawlChapterList(sourceUrl);

        // Insert chapters
        const chapterRecords = chaptersList.map(ch => ({
            jobId,
            workId: (async () => {
                const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
                return job?.workId || 0;
            })(),
            chapterNumber: ch.number,
            title: ch.title,
            sourceUrl: ch.url,
            status: 'pending' as const
        }));

        // Resolve workId
        const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
        const finalRecords = chaptersList.map(ch => ({
            jobId,
            workId: job?.workId || 0,
            chapterNumber: ch.number,
            title: ch.title,
            sourceUrl: ch.url,
            status: 'pending' as const
        }));

        await db.insert(crawlChapters).values(finalRecords);

        // Update job: status = ready, totalChapters = count
        await db.update(crawlJobs)
            .set({
                status: 'ready',
                totalChapters: chaptersList.length
            })
            .where(eq(crawlJobs.id, jobId));

        console.log(`✅ Crawl initialized: ${chaptersList.length} chapters found`);
    } catch (error: any) {
        console.error("Error crawling chapter list:", error);

        // Update job status to failed
        await db.update(crawlJobs)
            .set({
                status: 'failed',
                lastError: error.message
            })
            .where(eq(crawlJobs.id, jobId));

        // Send Telegram alert
        await telegramService.sendAlert('error', telegramService.formatErrorAlert(
            workTitle, 0, error.message, jobId
        ));
    }
}

/**
 * Process batch of chapters
 */
export const processBatch = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const { count = 5 } = req.body;

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.id, parseInt(jobId))
        });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        if (job.status === 'completed') {
            return res.status(400).json({ error: "Job already completed" });
        }

        if (job.status === 'processing') {
            return res.status(400).json({ error: "Job is already processing" });
        }

        // Update status to processing
        await db.update(crawlJobs)
            .set({ status: 'processing' })
            .where(eq(crawlJobs.id, parseInt(jobId)));

        // Get work info
        const work = await db.query.works.findFirst({
            where: eq(works.id, job.workId!)
        });

        // Process in background
        processBatchBackground(parseInt(jobId), count, work?.title || 'Unknown');

        res.json({ message: `Processing ${count} chapters...`, jobId });
    } catch (error: any) {
        console.error("Error processing batch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Background batch processing
 */
/**
 * Background batch processing with Merge Support
 */
async function processBatchBackground(jobId: number, count: number, workTitle: string) {
    let errorCount = 0;

    try {
        // Get job settings
        const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
        if (!job) return;

        const mergeSize = job.chaptersPerSummary || 1;
        // Adjust limit based on merge size to ensure we get enough chapters for at least one batch
        // e.g. if mergeSize=5, and we want to process 2 batches (count=2), we need 10 chapters.
        // But 'count' usually comes from 'batchSize' which implies Number of Summaries to produce?
        // Or Number of source chapters?
        // Let's assume 'count' is Number of Parallel Processings we want to do.
        // If mergeSize > 1, strictly speaking we should process serially or carefully to maintain order.
        // For safety in Merge Mode, let's process 1 merged-block at a time to avoid chaos, or just fetch 'count * mergeSize' chapters.

        // Let's interpret 'count' as 'number of source chapters to attempt' roughly, but aligned to mergeSize.
        // Actually, it's safer to just fetch a larger chunk of pending chapters and group them.

        const fetchLimit = count * mergeSize;

        // Get pending chapters
        const pendingChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, jobId),
                eq(crawlChapters.status, 'pending')
            ),
            limit: fetchLimit,
            orderBy: (crawlChapters, { asc }) => [asc(crawlChapters.chapterNumber)]
        });

        if (pendingChapters.length === 0) {
            // No more pending chapters - mark job as completed
            await db.update(crawlJobs)
                .set({
                    status: 'completed',
                    completedAt: new Date()
                })
                .where(eq(crawlJobs.id, jobId));

            const duration = calculateDuration(job?.startedAt, new Date());

            await telegramService.sendAlert('complete',
                telegramService.formatCompleteAlert(workTitle, job?.totalChapters || 0, job?.failedChapters || 0, jobId, duration)
            );

            return;
        }

        // Group chapters into chunks
        const chunks = [];
        for (let i = 0; i < pendingChapters.length; i += mergeSize) {
            chunks.push(pendingChapters.slice(i, i + mergeSize));
        }

        console.log(`📦 Processing ${chunks.length} chunks (Merge Size: ${mergeSize})...`);

        // Process each chunk
        for (const chunk of chunks) {
            // Verify chunk completeness? 
            // If mergeSize=5 but we only have 3 chapters left at the very end -> Process them as one chunk.

            const startChap = chunk[0].chapterNumber;
            const endChap = chunk[chunk.length - 1].chapterNumber;
            const chunkTitle = chunk.length === 1
                ? `Chương ${startChap}`
                : `Chương ${startChap} - ${endChap}`;

            try {
                console.log(`📖 Processing chunk ${chunkTitle}...`);

                // 1. Mark all as crawling
                await db.update(crawlChapters)
                    .set({ status: 'crawling' })
                    .where(sql`${crawlChapters.id} IN ${chunk.map(c => c.id)}`);

                // 2. Crawl content for all chapters in chunk
                const crawledContents = [];
                for (const ch of chunk) {
                    const content = await crawlService.crawlChapterContent(ch.sourceUrl);

                    // Update individual crawl record
                    await db.update(crawlChapters)
                        .set({
                            rawContent: content,
                            crawledAt: new Date(),
                            status: 'summarizing' // Temporary status before final merge
                        })
                        .where(eq(crawlChapters.id, ch.id));

                    crawledContents.push({
                        ...ch,
                        content
                    });

                    // Small delay between chapters in chunk
                    if (chunk.length > 1) await new Promise(r => setTimeout(r, 500));
                }

                // 3. Merge Content
                const combinedContent = crawledContents
                    .map(c => `### Chương ${c.chapterNumber}: ${c.title || ''}\n\n${c.content}`)
                    .join('\n\n---\n\n');

                // 4. Summarize Combined Content (Returns JSON String)
                const aiResponseText = await summarizeChapter(startChap, chunkTitle, combinedContent);

                let title = chunkTitle;
                let shortSummary = "";
                let fullContent = aiResponseText;

                // Try parse JSON
                try {
                    // Start from first '{' and end at last '}'
                    const jsonStart = aiResponseText.indexOf('{');
                    const jsonEnd = aiResponseText.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = aiResponseText.substring(jsonStart, jsonEnd + 1);
                        const data = JSON.parse(jsonStr);
                        if (data.title) title = data.title;
                        if (data.short_summary) shortSummary = data.short_summary;
                        if (data.content) fullContent = data.content;
                    }
                } catch (e) {
                    console.warn(`Could not parse JSON from AI response for chunk ${chunkTitle}. Using raw text.`);
                    shortSummary = aiResponseText.substring(0, 300) + "...";
                }

                // Fallback for short summary if empty
                if (!shortSummary) {
                    shortSummary = fullContent.substring(0, 300) + "...";
                }

                // 5. Update Status & Save Chapter
                if (chunk[0]?.workId) {
                    const sourceRange = startChap === endChap
                        ? String(startChap)
                        : `${startChap},${endChap}`;

                    await db.insert(chapters).values({
                        workId: chunk[0].workId,
                        chapterNumber: startChap,
                        title: title,
                        originalText: combinedContent,
                        aiText: fullContent,
                        summary: shortSummary,
                        sourceChapterRange: sourceRange,
                        status: 'PUBLISHED'
                    });
                }

                // Mark source crawling chapters as completed
                await db.update(crawlChapters)
                    .set({
                        summary: shortSummary, // Use shortSummary
                        summarizedAt: new Date(),
                        status: 'completed'
                    })

                    .where(sql`${crawlChapters.id} IN ${chunk.map(c => c.id)}`);



                console.log(`✅ Chunk ${chunkTitle} completed`);

            } catch (error: any) {
                console.error(`❌ Error processing chunk ${chunkTitle}:`, error.message);

                // Mark all in chunk as failed
                await db.update(crawlChapters)
                    .set({
                        status: 'failed',
                        error: error.message,
                        retryCount: sql`${crawlChapters.retryCount} + 1`
                    })
                    .where(sql`${crawlChapters.id} IN ${chunk.map(c => c.id)}`);

                errorCount++;

                // Send Alert
                await telegramService.sendAlert('error',
                    telegramService.formatErrorAlert(workTitle, startChap, error.message, jobId)
                );

                break; // Stop batch on error
            }
        }

        // Update job progress
        const stats = await db.select({
            summarized: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
            failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`
        })
            .from(crawlChapters)
            .where(eq(crawlChapters.jobId, jobId));

        await db.update(crawlJobs)
            .set({
                summarizedChapters: Number(stats[0]?.summarized || 0),
                failedChapters: Number(stats[0]?.failed || 0),
                lastProcessedAt: new Date(),
                status: errorCount > 0 ? 'paused' : 'ready' // Pause on error, ready otherwise
            })
            .where(eq(crawlJobs.id, jobId));

        // Send progress alert (every 50 chapters)
        const summarizedCount = Number(stats[0]?.summarized || 0);
        const currentJob = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });

        if (summarizedCount % 50 === 0 && summarizedCount > 0) {
            await telegramService.sendAlert('progress',
                telegramService.formatProgressAlert(workTitle, summarizedCount, currentJob?.totalChapters || 0, jobId)
            );
        }

    } catch (error: any) {
        console.error("Batch processing error:", error);

        await db.update(crawlJobs)
            .set({
                status: 'failed',
                lastError: error.message
            })
            .where(eq(crawlJobs.id, jobId));
    }
}

/**
 * Get crawl job status
 */
export const getCrawlStatus = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.id, parseInt(jobId))
        });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        // Get failed chapters
        const failedChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, parseInt(jobId)),
                eq(crawlChapters.status, 'failed')
            )
        });

        res.json({
            job,
            failedChapters
        });
    } catch (error: any) {
        console.error("Error getting crawl status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Toggle auto mode
 */
export const toggleAutoMode = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const { autoMode } = req.body;

        await db.update(crawlJobs)
            .set({ autoMode })
            .where(eq(crawlJobs.id, parseInt(jobId)));

        res.json({ message: `Auto mode ${autoMode ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
        console.error("Error toggling auto mode:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Pause job
 */
export const pauseJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;

        await db.update(crawlJobs)
            .set({ status: 'paused' })
            .where(eq(crawlJobs.id, parseInt(jobId)));

        res.json({ message: "Job paused" });
    } catch (error: any) {
        console.error("Error pausing job:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Resume job
 */
export const resumeJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;

        await db.update(crawlJobs)
            .set({ status: 'ready' })
            .where(eq(crawlJobs.id, parseInt(jobId)));

        res.json({ message: "Job resumed" });
    } catch (error: any) {
        console.error("Error resuming job:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Get active jobs
 */
export const getActiveJobs = async (req: Request, res: Response) => {
    try {
        const jobs = await db.query.crawlJobs.findMany({
            where: sql`${crawlJobs.status} != 'completed' AND ${crawlJobs.status} != 'failed'`,
            limit: 10,
            orderBy: (crawlJobs, { desc }) => [desc(crawlJobs.createdAt)]
        });

        res.json(jobs);
    } catch (error: any) {
        console.error("Error getting active jobs:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Test Telegram connection
 */
export const testTelegramConnection = async (req: Request, res: Response) => {
    try {
        const { token, chatId } = req.body;

        if (!token || !chatId) {
            return res.status(400).json({ error: "token and chatId are required" });
        }

        const result = await telegramService.testConnection(token, chatId);
        res.json(result);
    } catch (error: any) {
        console.error("Error testing Telegram:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Helper: Calculate duration
function calculateDuration(start: Date | null | undefined, end: Date): string {
    if (!start) return 'N/A';
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Extract work info from URL
 */
export const extractWorkInfo = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL is required" });

        const info = await crawlService.extractWorkInfo(url);
        res.json(info);
    } catch (error: any) {
        console.error("Error extracting info:", error);
        res.status(500).json({ error: error.message });
    }
};
