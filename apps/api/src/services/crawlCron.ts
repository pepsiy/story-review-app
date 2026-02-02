import cron from 'node-cron';
import { db } from '../../../../packages/db/src';
import { crawlJobs, crawlChapters, systemSettings, works } from '../../../../packages/db/src';
import { and, eq, sql } from 'drizzle-orm';
import { crawlService } from '../services/crawlService';
import { summarizeChapter } from '../services/aiService';
import { telegramService } from '../services/telegramService';

/**
 * Cron job: Tự động xử lý các job có autoMode = true
 * Chạy mỗi 2 phút
 */
export function startCrawlCron() {
    // Chạy mỗi 2 phút
    cron.schedule('*/2 * * * *', async () => {
        try {
            // Check global auto mode setting
            const globalAutoSetting = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, 'crawl_auto_mode_enabled')
            });

            const globalAutoEnabled = globalAutoSetting?.value === 'true';

            if (!globalAutoEnabled) {
                return; // Auto mode disabled globally
            }

            // Find jobs with autoMode = true and status = ready
            const jobs = await db.query.crawlJobs.findMany({
                where: and(
                    eq(crawlJobs.autoMode, true),
                    eq(crawlJobs.status, 'ready')
                ),
                limit: 3 // Max 3 jobs parallel
            });

            if (jobs.length === 0) {
                return;
            }

            console.log(`🤖 Auto-cron: Processing ${jobs.length} jobs...`);

            // Process each job
            for (const job of jobs) {
                try {
                    await processJobBatch(job.id, job.batchSize || 5);
                } catch (error: any) {
                    console.error(`❌ Auto-cron error for job ${job.id}:`, error.message);
                }
            }
        } catch (error: any) {
            console.error('❌ Cron job error:', error.message);
        }
    });

    console.log('✅ Crawl cron job started (runs every 2 minutes)');
}

/**
 * Process a single job's batch
 */
async function processJobBatch(jobId: number, batchSize: number) {
    try {
        // Update status to processing
        await db.update(crawlJobs)
            .set({ status: 'processing' })
            .where(eq(crawlJobs.id, jobId));

        // Get work info
        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.id, jobId)
        });

        const work = await db.query.works.findFirst({
            where: eq(works.id, job?.workId!)
        });

        // Get pending chapters
        const pendingChapters = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, jobId),
                eq(crawlChapters.status, 'pending')
            ),
            limit: batchSize,
            orderBy: (crawlChapters, { asc }) => [asc(crawlChapters.chapterNumber)]
        });

        if (pendingChapters.length === 0) {
            // No more pending chapters - mark as completed
            await db.update(crawlJobs)
                .set({
                    status: 'completed',
                    completedAt: new Date()
                })
                .where(eq(crawlJobs.id, jobId));

            const duration = calculateDuration(job?.startedAt, new Date());
            await telegramService.sendAlert('complete',
                telegramService.formatCompleteAlert(
                    work?.title || 'Unknown',
                    job?.totalChapters || 0,
                    job?.failedChapters || 0,
                    jobId,
                    duration
                )
            );

            return;
        }

        // Process each chapter
        for (const chapter of pendingChapters) {
            try {
                console.log(`[Job ${jobId}] Processing chapter ${chapter.chapterNumber}...`);

                // Crawl content
                await db.update(crawlChapters)
                    .set({ status: 'crawling' })
                    .where(eq(crawlChapters.id, chapter.id));

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

                console.log(`[Job ${jobId}] ✅ Chapter ${chapter.chapterNumber} completed`);

            } catch (error: any) {
                console.error(`[Job ${jobId}] ❌ Chapter ${chapter.chapterNumber} failed:`, error.message);

                await db.update(crawlChapters)
                    .set({
                        status: 'failed',
                        error: error.message,
                        retryCount: (chapter.retryCount || 0) + 1
                    })
                    .where(eq(crawlChapters.id, chapter.id));

                // Send alert
                await telegramService.sendAlert('error',
                    telegramService.formatErrorAlert(
                        work?.title || 'Unknown',
                        chapter.chapterNumber,
                        error.message,
                        jobId
                    )
                );

                // Pause job on error
                await db.update(crawlJobs)
                    .set({ status: 'paused' })
                    .where(eq(crawlJobs.id, jobId));

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
                status: 'ready'
            })
            .where(eq(crawlJobs.id, jobId));

        // Progress alert (every 50 chapters)
        const summarizedCount = Number(stats[0]?.summarized || 0);
        if (summarizedCount % 50 === 0 && summarizedCount > 0) {
            await telegramService.sendAlert('progress',
                telegramService.formatProgressAlert(
                    work?.title || 'Unknown',
                    summarizedCount,
                    job?.totalChapters || 0,
                    jobId
                )
            );
        }

    } catch (error: any) {
        console.error(`[Job ${jobId}] Batch processing error:`, error);

        await db.update(crawlJobs)
            .set({
                status: 'failed',
                lastError: error.message
            })
            .where(eq(crawlJobs.id, jobId));
    }
}

// Helper
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
