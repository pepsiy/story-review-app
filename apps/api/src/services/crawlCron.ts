import cron from 'node-cron';
import { db } from '../../../../packages/db/src';
import { crawlJobs, crawlChapters, systemSettings, works } from '../../../../packages/db/src';
import { and, eq, sql, desc } from 'drizzle-orm';
import { crawlService } from '../services/crawlService';
import { summarizeChapter } from '../services/aiService';
import { processBatchBackground } from '../controllers/crawlController';
import { telegramService } from '../services/telegramService';

let idleQueryCount = 0;
let sleepCyclesRemaining = 0;

/**
 * Wake up the cron job immediately (reset backoff)
 */
export function wakeupCron() {
    idleQueryCount = 0;
    sleepCyclesRemaining = 0;
    console.log('⏰ [Neon Sleep Mode] Auto-crawl cron awakened by user action!');
}

/**
 * Cron job: Tự động xử lý các job có autoMode = true
 * Chạy mỗi 2 phút
 */
export function startCrawlCron() {
    // Chạy mỗi 2 phút
    cron.schedule('*/2 * * * *', async () => {
        try {
            // Neon DB Scale-to-Zero Optimization
            if (sleepCyclesRemaining > 0) {
                sleepCyclesRemaining--;
                console.log(`💤 [Neon Sleep Mode] Crawl cron sleeping... (${sleepCyclesRemaining} cycles left)`);
                return;
            }

            // Check global auto mode setting
            const globalAutoSetting = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, 'crawl_auto_mode_enabled')
            });

            const globalAutoEnabled = globalAutoSetting?.value === 'true';

            if (!globalAutoEnabled) {
                return; // Auto mode disabled globally
            }

            // Find jobs with autoMode = true and status = ready/processing
            const jobs = await db.query.crawlJobs.findMany({
                where: and(
                    eq(crawlJobs.autoMode, true),
                    eq(crawlJobs.status, 'ready')
                ),
                limit: 3 // Max 3 jobs parallel
            });

            if (jobs.length === 0) {
                idleQueryCount++;
                if (idleQueryCount >= 5) {
                    // Start sleep mode for 30 mins (15 cycles * 2 mins = 30 mins, minus the current one = 14)
                    sleepCyclesRemaining = 14;
                    console.log('🌙 [Neon Sleep Mode] No active jobs for 10 mins. Cron entering 30-minute deep sleep to save DB compute.');
                }
                return;
            }

            // Reset backoff since we found jobs
            idleQueryCount = 0;

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
    }); // Close the first 2-minute cron

    // Chạy mỗi 60 phút để kiểm tra truyện ONGOING
    cron.schedule('0 * * * *', async () => {
        try {
            await checkOngoingStoriesUpdates();
        } catch (error: any) {
            console.error('❌ Cron check updates error:', error.message);
        }
    });

    console.log('✅ Crawl cron job started (runs every 2 minutes)');
    console.log('✅ Story update checker started (runs every hour)');
}

async function checkOngoingStoriesUpdates() {
    // Only check if global auto mode is enabled (optional, assuming we only want auto-updates if system is tracking automatically)
    const globalAutoSetting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'crawl_auto_mode_enabled')
    });
    if (globalAutoSetting?.value !== 'true') return;

    console.log('🔍 Checking for updates on ONGOING stories...');

    const ongoingWorks = await db.query.works.findMany({
        where: eq(works.status, 'ONGOING')
    });

    for (const work of ongoingWorks) {
        try {
            // Find latest job for this work
            const jobList = await db.select()
                .from(crawlJobs)
                .where(eq(crawlJobs.workId, work.id))
                .orderBy(desc(crawlJobs.id))
                .limit(1);

            const job = jobList[0];
            if (!job || !job.sourceUrl) continue;

            const currentTotalChapters = job.totalChapters || 0;
            const chapterList = await crawlService.crawlChapterList(job.sourceUrl);
            const newTotalChapters = chapterList.length;

            if (newTotalChapters > currentTotalChapters) {
                const newChaptersCount = newTotalChapters - currentTotalChapters;
                console.log(`🆕 Found ${newChaptersCount} new chapters for "${work.title}"`);

                const newChapters = chapterList.slice(currentTotalChapters);
                const finalRecords = newChapters.map(ch => ({
                    jobId: job.id,
                    workId: work.id,
                    chapterNumber: ch.number,
                    title: ch.title,
                    sourceUrl: ch.url,
                    status: 'pending' as const
                }));

                await db.insert(crawlChapters).values(finalRecords);

                await db.update(crawlJobs)
                    .set({
                        totalChapters: newTotalChapters,
                        status: 'ready' // Allow auto-crawl to pick it up if there's enough pending
                    })
                    .where(eq(crawlJobs.id, job.id));

                const mergeSize = Math.max(job.chaptersPerSummary || 1, job.batchSize || 1);

                // Get pending count
                const pendingCountInfo = await db.select({ count: sql<number>`count(*)` })
                    .from(crawlChapters)
                    .where(and(eq(crawlChapters.jobId, job.id), eq(crawlChapters.status, 'pending')));

                const pendingCount = Number(pendingCountInfo[0]?.count || 0);
                const remainder = pendingCount % mergeSize;
                const fullBatches = Math.floor(pendingCount / mergeSize);
                const missingForFullBatch = remainder === 0 ? 0 : mergeSize - remainder;

                // Send Telegram logic
                let telegramMsg = `🆕 **Cập Nhật Truyện**: ${work.title}\n` +
                    `⚡ Vừa ra thêm ${newChaptersCount} chương mới (đến chương ${newTotalChapters})!\n`;

                if (fullBatches > 0) {
                    telegramMsg += `✅ Hệ thống đã gom đủ ${fullBatches} cục tóm tắt (${mergeSize} chương/cục) và đang tự động xử lý.\n`;
                }

                if (remainder > 0) {
                    telegramMsg += `⏳ Đang đợi thêm ${missingForFullBatch} chương nữa để gộp thành cục tiếp theo. Hiện dư ${remainder}/${mergeSize}.`;
                }

                await telegramService.sendInfoAlert(telegramMsg.trim());
            }
        } catch (e: any) {
            console.error(`❌ Error checking updates for ${work.title}:`, e.message);
        }
    }
}

