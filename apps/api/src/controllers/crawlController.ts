import { Request, Response } from "express";
import { db } from "../../../../packages/db/src";
import { crawlJobs, crawlChapters, works, chapters } from "../../../../packages/db/src";
import { eq, and, sql } from "drizzle-orm";
import { crawlService } from "../services/crawlService";
import { telegramService } from "../services/telegramService";
import { summarizeChapter } from "../services/aiService";
import { emitLog } from "../services/socketService";

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
        const { count = 5, batchSize, chaptersPerSummary } = req.body;

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.id, parseInt(jobId))
        });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        // AUTO-UPDATE CONFIG IF PROVIDED (Sync UI with Backend)
        if (batchSize !== undefined || chaptersPerSummary !== undefined) {
            const updateData: any = {};
            if (batchSize !== undefined) updateData.batchSize = batchSize;
            if (chaptersPerSummary !== undefined) updateData.chaptersPerSummary = chaptersPerSummary;

            await db.update(crawlJobs)
                .set(updateData)
                .where(eq(crawlJobs.id, parseInt(jobId)));

            // Update local job object for immediate use check (though we fetch again inside BG it's safer)
            if (batchSize) job.batchSize = batchSize;
            if (chaptersPerSummary) job.chaptersPerSummary = chaptersPerSummary;
            console.log(`[Batch] Config auto-updated from UI request: BatchSize=${batchSize}`);
        }

        if (job.status === 'completed') {
            return res.status(400).json({ error: "Job already completed" });
        }

        if (job.status === 'processing') {
            // Check if stuck (last processed > 5 minutes ago)
            const lastProcessed = job.lastProcessedAt ? new Date(job.lastProcessedAt).getTime() : 0;
            const now = Date.now();
            if (now - lastProcessed < 5 * 60 * 1000) {
                return res.status(400).json({ error: "Job is already processing (and active)" });
            }
            console.warn(`Job ${jobId} appears stuck. Resuming...`);
        }

        // Update status to processing
        await db.update(crawlJobs)
            .set({ status: 'processing', lastProcessedAt: new Date() })
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
export async function processBatchBackground(jobId: number, count: number, workTitle: string) {
    let errorCount = 0;

    try {
        // Get job settings
        const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
        if (!job) return;

        // Prevent concurrent overlaps if called from cron while already running
        if (job.status === 'processing') {
            const lastProcessed = job.lastProcessedAt ? new Date(job.lastProcessedAt).getTime() : 0;
            // If it's been processing for less than 15 minutes, assume it's still alive and skip overlap.
            if (Date.now() - lastProcessed < 15 * 60 * 1000) {
                console.log(`[Batch Debug] Job ${jobId} is currently processing (locked). Skipping overlap.`);
                return;
            }
            console.log(`[Batch Debug] Job ${jobId} was stuck in processing. Resuming.`);
        }

        // Lock the job immediately
        await db.update(crawlJobs)
            .set({ status: 'processing', lastProcessedAt: new Date() })
            .where(eq(crawlJobs.id, jobId));

        console.log(`[Batch Debug] Job Data:`, JSON.stringify(job, null, 2));

        // UNIFIED LOGIC: "Batch Size" in UI = "Merge Size" (chaptersPerSummary)
        // We ensure we use the larger of chaptersPerSummary OR batchSize to be safe
        const mergeSize = Math.max(job.chaptersPerSummary || 1, job.batchSize || 1);

        // Count in AutoMode is usually 1 (meaning 1 merged block). 
        // So we fetch 'count * mergeSize' source chapters.
        const fetchLimit = count * mergeSize;

        emitLog(`🚀 Start Batch Job #${jobId}. Merging ${mergeSize} chaps/summary.`, 'info', jobId);
        console.log(`[Batch Debug] Job ${jobId}: Config Merge Size = ${mergeSize}, Fetching ${fetchLimit} pending chapters...`);

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
            // CHECK STATUS: If user paused or job failed externally, STOP.
            const currentJob = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, jobId) });
            if (!currentJob || currentJob.status === 'paused' || currentJob.status === 'failed') {
                console.log(`Job ${jobId} is ${currentJob?.status}. Stopping batch.`);
                break;
            }

            const startChap = chunk[0].chapterNumber;
            const endChap = chunk[chunk.length - 1].chapterNumber;
            const chunkTitle = chunk.length === 1
                ? `Chương ${startChap}`
                : `Chương ${startChap} - ${endChap}`;

            // Update lastProcessedAt heartbeat
            await db.update(crawlJobs)
                .set({ lastProcessedAt: new Date() })
                .where(eq(crawlJobs.id, jobId));

            try {
                console.log(`📖 Processing chunk ${chunkTitle}...`);
                emitLog(`🔄 Processing ${chunkTitle}...`, 'info', jobId);

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

                // 4. Summarize Combined Content (Returns Pipe-Delimited Text)
                const aiResponseText = await summarizeChapter(startChap, chunkTitle, combinedContent);

                const newChapterNumber = Math.floor((startChap - 1) / mergeSize) + 1;

                console.log(`[Crawl Debug] Chunk ${chunkTitle}: Input Length=${combinedContent.length}, AI Output Length=${aiResponseText.length}`);
                if (aiResponseText.length > combinedContent.length * 0.9) {
                    console.warn(`[Crawl Debug] ⚠️ WARN: Output size is very close to input size. Possible copy detected?`);
                }



                // --- IMPROVED PARSING LOGIC ---
                // Split by ||| but handle potential newlines/spaces around it
                const parts = aiResponseText.split(/\|\|\|/g).map(p => p.trim());

                // Initialize variables
                let title = chunkTitle;
                let shortSummary = "";
                let fullContent = "";
                let gameEvents: any[] = []; // Explicit type

                if (parts.length >= 3) {
                    // Part 0: Title (Ensure it's not empty)
                    if (parts[0].length > 0) title = parts[0].replace(/^\[+|\]+$/g, '').trim();

                    // Part 1: Short Summary
                    shortSummary = parts[1].replace(/^\[+|\]+$/g, '').trim();

                    // Part 2: Content (and potentially events if merged)
                    // Check if Part 2 contains Game Events JSON-like structure or if there is a Part 3
                    if (parts.length >= 4) {
                        fullContent = parts[2].replace(/^\[+|\]+$/g, '').trim();
                        // Part 3: Game Events
                        const eventRaw = parts[3];
                        try {
                            const cleanJson = eventRaw.replace(/```json/g, '').replace(/```/g, '').trim();
                            const parsed = JSON.parse(cleanJson);
                            if (Array.isArray(parsed)) gameEvents = parsed;
                        } catch (e) {
                            console.warn("⚠️ Failed to parse Game Events JSON", e);
                        }
                    } else {
                        // Only 3 parts found, so Part 2 is content. 
                        fullContent = parts[2].replace(/^\[+|\]+$/g, '').trim();
                    }
                } else {
                    console.warn(`[Crawl Warning] Could not split based on '|||'. Using raw text fallback.`);
                    // If split failed but text is long, maybe try newline splitting?
                    // For now, fallback to raw but try to avoid setting summary to huge text
                    shortSummary = aiResponseText.substring(0, 500) + "...";
                    fullContent = aiResponseText;
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

                    // Check overlap
                    const existingChap = await db.query.chapters.findFirst({
                        where: and(
                            eq(chapters.workId, chunk[0].workId),
                            eq(chapters.chapterNumber, newChapterNumber)
                        )
                    });

                    if (existingChap) {
                        console.log(`⚠️ Chapter ${newChapterNumber} in Work ${chunk[0].workId} already exists. Updating content...`);
                        await db.update(chapters)
                            .set({
                                title: title,
                                originalText: combinedContent,
                                aiText: fullContent,
                                summary: shortSummary,
                                sourceChapterRange: sourceRange,
                                status: 'PUBLISHED',
                                createdAt: new Date() // Bump timestamp to show update
                            })
                            .where(eq(chapters.id, existingChap.id));
                    } else {
                        await db.insert(chapters).values({
                            workId: chunk[0].workId,
                            chapterNumber: newChapterNumber,
                            title: title,
                            originalText: combinedContent,
                            aiText: fullContent,
                            summary: shortSummary,
                            sourceChapterRange: sourceRange,
                            status: 'PUBLISHED'
                        });
                        console.log(`✅ Inserted Chapter ${newChapterNumber} to public table.`);
                    }
                } else {
                    console.error("❌ CRITICAL: workId missing in chunk[0]", chunk[0]);
                    throw new Error("Missing workId in chunk processing");
                }

                // Mark source crawling chapters as completed
                await db.update(crawlChapters)
                    .set({
                        summary: shortSummary, // Use shortSummary
                        summarizedAt: new Date(),
                        status: 'completed'
                    })
                    .where(sql`${crawlChapters.id} IN ${chunk.map(c => c.id)}`);

                console.log(`✅ Chunk ${chunkTitle} completed & Saved to Chapters`);
                emitLog(`✅ Chunk ${chunkTitle} Summarized & Saved!`, 'success', jobId);

                // --- PVE BEAST SPAWNING FROM GAME TAGS ---
                if (gameEvents && Array.isArray(gameEvents) && gameEvents.length > 0) {
                    console.log(`🎮 [Beast Spawn] Detected game events:`, gameEvents);

                    // Check for BEAST_* tags
                    for (const tag of gameEvents) {
                        let beastId: string | null = null;

                        if (tag === 'BEAST_WOLF') beastId = 'beast_wolf';
                        else if (tag === 'BEAST_TIGER') beastId = 'beast_tiger';
                        else if (tag === 'BEAST_DRAGON') beastId = 'beast_dragon';

                        if (beastId) {
                            console.log(`🐉 [Beast Spawn] Triggering spawn for: ${beastId}`);

                            // Spawn beast for all active users (or just users who are reading this work)
                            // For now, we'll spawn for all users who have game state
                            try {
                                const { spawnBeast } = await import('./beastController');
                                const { users } = await import('../../../../packages/db/src');

                                // Get all users with gold > 0 (indication they've started playing)
                                const activeUsers = await db.select({ id: users.id })
                                    .from(users)
                                    .where(sql`${users.gold} > 0`)
                                    .limit(100); // Limit to prevent mass spawning

                                for (const user of activeUsers) {
                                    const result = await spawnBeast(user.id, beastId);
                                    if (result.success) {
                                        console.log(`✅ Spawned ${beastId} for user ${user.id}`);
                                    }
                                }

                                emitLog(`🐉 Spawned ${beastId} for ${activeUsers.length} users!`, 'success', jobId);
                            } catch (error: any) {
                                console.error(`❌ Error spawning beast ${beastId}:`, error.message);
                            }
                        }
                    }
                }

            } catch (error: any) {
                console.error(`❌ Error processing chunk ${chunkTitle}:`, error.message);
                emitLog(`❌ Failed Chunk ${chunkTitle}: ${error.message}`, 'error', jobId);

                const currentRetryCount = chunk[0].retryCount || 0;
                const isTimeout = error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('browser');

                if (isTimeout && currentRetryCount < 3) {
                    console.log(`⏳ Auto-retry triggered for chunk ${chunkTitle} (Attempt ${currentRetryCount + 1}/3)`);
                    emitLog(`⏳ Timeout detected. Retrying later (Attempt ${currentRetryCount + 1}/3)...`, 'warning', jobId);

                    // Revert chunk to pending for next cron pass
                    await db.update(crawlChapters)
                        .set({
                            status: 'pending',
                            error: `Timeout: auto-retrying (${currentRetryCount + 1}/3)`,
                            retryCount: sql`${crawlChapters.retryCount} + 1`
                        })
                        .where(sql`${crawlChapters.id} IN ${chunk.map(c => c.id)}`);

                    // We don't increment errorCount so the job remains 'ready' and autoMode stays enabled.
                    // But we break the loop to allow the system to rest before next cron tick.
                    break;
                } else {
                    // Mark all in chunk as totally failed
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

                    break; // Stop batch on fatal error
                }
            }
        }

        // Update job progress
        const stats = await db.select({
            summarized: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
            failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
            crawled: sql<number>`COUNT(*) FILTER (WHERE status = 'completed' OR status = 'summarizing' OR raw_content IS NOT NULL)`
        })
            .from(crawlChapters)
            .where(eq(crawlChapters.jobId, jobId));

        const updateData: any = {
            summarizedChapters: Number(stats[0]?.summarized || 0),
            crawledChapters: Number(stats[0]?.crawled || 0),
            failedChapters: Number(stats[0]?.failed || 0),
            lastProcessedAt: new Date(),
            status: errorCount > 0 ? 'paused' : 'ready'
        };

        // Disable Auto Mode if we paused due to error
        if (errorCount > 0) {
            updateData.autoMode = false;
        }

        await db.update(crawlJobs)
            .set(updateData)
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
                lastError: error.message,
                autoMode: false
            })
            .where(eq(crawlJobs.id, jobId));
    }
}

/**
 * Repair Job: Reset 'completed' crawl_chapters that are missing in 'chapters' table
 */
export const repairJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const id = parseInt(jobId);

        // Get job
        const job = await db.query.crawlJobs.findFirst({ where: eq(crawlJobs.id, id) });
        if (!job) return res.status(404).json({ error: "Job not found" });

        // Get all completed crawl_chapters
        const completed = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, id),
                eq(crawlChapters.status, 'completed')
            )
        });

        let resetCount = 0;
        const resetIds = [];

        for (const cc of completed) {
            // Check if exists in public chapters
            const exists = await db.query.chapters.findFirst({
                where: and(
                    eq(chapters.workId, job.workId!),
                    eq(chapters.chapterNumber, cc.chapterNumber)
                )
            });

            if (!exists) {
                resetIds.push(cc.id);
                resetCount++;
            }
        }

        if (resetIds.length > 0) {
            await db.update(crawlChapters)
                .set({ status: 'pending', summary: null, rawContent: null, summarizedAt: null })
                .where(sql`${crawlChapters.id} IN ${resetIds}`);
        }

        res.json({
            message: `Repair completed. Reset ${resetCount} chapters to 'pending'.`,
            resetCount,
            resetIds
        });

    } catch (error: any) {
        console.error("Repair Job Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update Job Configuration (Batch Size, Merge Ratio)
 */
export const updateJobConfig = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const { batchSize, chaptersPerSummary } = req.body;

        const updateData: any = {};
        if (batchSize !== undefined) updateData.batchSize = batchSize;
        if (chaptersPerSummary !== undefined) updateData.chaptersPerSummary = chaptersPerSummary;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No config provided" });
        }

        await db.update(crawlJobs)
            .set(updateData)
            .where(eq(crawlJobs.id, parseInt(jobId)));

        res.json({ message: "Job config updated", config: updateData });
    } catch (error: any) {
        console.error("Job Config Update Error:", error);
        res.status(500).json({ error: error.message });
    }
};

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
 * Get latest job for a work (regardless of status)
 */
export const getLatestJobForWork = async (req: Request, res: Response) => {
    try {
        const { workId } = req.params;

        const job = await db.query.crawlJobs.findFirst({
            where: eq(crawlJobs.workId, parseInt(workId)),
            orderBy: (crawlJobs, { desc }) => [desc(crawlJobs.createdAt)]
        });

        if (!job) {
            return res.status(404).json({ error: "No job found for this work" });
        }

        // Get failed chapters statistics
        const failedCount = await db.select({ count: sql<number>`count(*)` })
            .from(crawlChapters)
            .where(and(
                eq(crawlChapters.jobId, job.id),
                eq(crawlChapters.status, 'failed')
            ));

        // Get job detailed info to return
        const failedChaptersList = await db.query.crawlChapters.findMany({
            where: and(
                eq(crawlChapters.jobId, job.id),
                eq(crawlChapters.status, 'failed')
            ),
            limit: 50 // Limit to avoid huge payload
        });

        res.json({
            job: {
                ...job,
                failedChapters: Number(failedCount[0]?.count || 0)
            },
            failedChapters: failedChaptersList
        });

    } catch (error: any) {
        console.error("Error getting latest job:", error);
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
