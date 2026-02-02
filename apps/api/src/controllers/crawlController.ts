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
        const { workId, sourceUrl } = req.body;

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
            status: 'initializing'
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
async function processBatchBackground(jobId: number, count: number, workTitle: string) {
    const processedChapters: number[] = [];
    let errorCount = 0;

    try {
        // Get pending chapters
        const pendingChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, jobId),
                eq(crawlChapters.status, 'pending')
            ),
            limit: count,
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

            const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
            const duration = calculateDuration(job?.startedAt, new Date());

            await telegramService.sendAlert('complete',
                telegramService.formatCompleteAlert(workTitle, job?.totalChapters || 0, job?.failedChapters || 0, jobId, duration)
            );

            return;
        }

        // Process each chapter
        for (const chapter of pendingChapters) {
            try {
                console.log(`📖 Processing chapter ${chapter.chapterNumber}...`);

                // Update status: crawling
                await db.update(crawlChapters)
                    .set({ status: 'crawling' })
                    .where(eq(crawlChapters.id, chapter.id));

                // Crawl content
                const content = await crawlService.crawlChapterContent(chapter.sourceUrl);

                await db.update(crawlChapters)
                    .set({
                        rawContent: content,
                        crawledAt: new Date(),
                        status: 'summarizing'
                    })
                    .where(eq(crawlChapters.id, chapter.id));

                // AI Summarize
                const summary = await summarizeChapter(chapter.chapterNumber, chapter.title || '', content);

                await db.update(crawlChapters)
                    .set({
                        summary,
                        summarizedAt: new Date(),
                        status: 'completed'
                    })
                    .where(eq(crawlChapters.id, chapter.id));

                // Save to main chapters table (if workId exists)
                if (chapter.workId) {
                    await db.insert(chapters).values({
                        workId: chapter.workId,
                        chapterNumber: chapter.chapterNumber,
                        title: chapter.title,
                        originalText: content,
                        aiText: summary,
                        summary: summary.substring(0, 200),
                        status: 'PUBLISHED'
                    });
                }

                processedChapters.push(chapter.chapterNumber);
                console.log(`✅ Chapter ${chapter.chapterNumber} completed`);

            } catch (error: any) {
                console.error(`❌ Error processing chapter ${chapter.chapterNumber}:`, error.message);

                // Update chapter status to failed
                await db.update(crawlChapters)
                    .set({
                        status: 'failed',
                        error: error.message,
                        retryCount: (chapter.retryCount || 0) + 1
                    })
                    .where(eq(crawlChapters.id, chapter.id));

                errorCount++;

                // Send Telegram alert for error
                await telegramService.sendAlert('error',
                    telegramService.formatErrorAlert(workTitle, chapter.chapterNumber, error.message, jobId)
                );

                // Stop processing on error
                break;
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
        const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });

        if (summarizedCount % 50 === 0 && summarizedCount > 0) {
            await telegramService.sendAlert('progress',
                telegramService.formatProgressAlert(workTitle, summarizedCount, job?.totalChapters || 0, jobId)
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
