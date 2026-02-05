import cron from 'node-cron';
import { db } from '../../../../packages/db/src';
import { crawlJobs, crawlChapters, systemSettings, works } from '../../../../packages/db/src';
import { and, eq, sql } from 'drizzle-orm';
import { crawlService } from '../services/crawlService';
import { summarizeChapter } from '../services/aiService';
import { processBatchBackground } from '../controllers/crawlController';
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

            // Find jobs with autoMode = true and status = ready/processing
            // Note: We include 'processing' if stuck? No, processBatchBackground checks stuck jobs.
            // But cron typically looks for 'ready'.
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
                    // Get work info for title
                    const work = await db.query.works.findFirst({
                        where: eq(works.id, job.workId!)
                    });

                    if (work) {
                        // UNIFIED LOGIC: Use the Controller's logic
                        // Pass count=1 so it processes ONE Batch (e.g. 5 chapters) per tick.
                        // This prevents rate limit issues while maintaining progress.
                        console.log(`🤖 Cron triggering batch for Job ${job.id} (Work: ${work.title})`);
                        await processBatchBackground(job.id, 1, work.title);
                    } else {
                        console.warn(`Work not found for Job ${job.id}`);
                    }

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

