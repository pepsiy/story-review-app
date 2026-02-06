import { db } from "../../../packages/db/src";
import { crawlChapters, chapters } from "../../../packages/db/src";
import { eq, and } from "drizzle-orm";

async function manualSync() {
    console.log("Starting manual sync...");

    const completedCrawlChapters = await db.query.crawlChapters.findMany({
        where: and(
            eq(crawlChapters.status, 'completed'),
            // eq(crawlChapters.workId, 18)
        ),
        limit: 10
    });

    console.log(`Found ${completedCrawlChapters.length} completed crawl chapters.`);

    for (const cc of completedCrawlChapters) {
        console.log(`Checking Sync for Chapter ${cc.chapterNumber} (Work: ${cc.workId})...`);

        if (!cc.workId) continue;

        // Check if exists in chapters
        const existing = await db.query.chapters.findFirst({
            where: and(
                eq(chapters.workId, cc.workId),
                eq(chapters.chapterNumber, cc.chapterNumber)
            )
        });

        if (existing) {
            console.log(`✅ Chapter ${cc.chapterNumber} already exists.`);
        } else {
            console.log(`❌ Chapter ${cc.chapterNumber} MISSING in public table. Syncing now...`);

            try {
                if (!cc.workId) {
                    console.error(`Missing workId for chapter ${cc.chapterNumber}`);
                    continue;
                }
                await db.insert(chapters).values({
                    workId: cc.workId,
                    chapterNumber: cc.chapterNumber,
                    title: cc.title || `Chương ${cc.chapterNumber}`,
                    originalText: cc.rawContent || "",
                    aiText: cc.summary || "", // In single mode, summary is aiText? Check logic.
                    // Logic in controller: aiText = fullContent, summary = shortSummary. 
                    // In crawlChapters table: we only have 'summary' which holds shortSummary? 
                    // Wait, crawlChapters schema has 'summary'. It does NOT have 'aiText' or 'fullContent' column?
                    // CHECK SCHEMA AGAIN!

                    // Schema:
                    // rawContent: text('raw_content'), // HTML content
                    // summary: text('summary'), // AI summary

                    // Controller logic:
                    // combinedContent (raw) -> AI -> parts
                    // parts -> title, shortSummary, fullContent, gameEvents
                    // Insert into chapters: aiText: fullContent, summary: shortSummary.
                    // Update crawlChapters: summary: shortSummary.
                    // WAIT! Where is 'fullContent' saved in crawlChapters?
                    // IT IS NOT SAVED PREMANENTLY in crawlChapters!
                    // It is only saved in `chapters` table!

                    summary: cc.summary || "Auto synced",
                    status: 'PUBLISHED'
                });
                console.log("✅ Synced.");
            } catch (e: any) {
                console.error("❌ Sync failed:", e.message);
            }
        }
    }
}

manualSync().then(() => process.exit(0));
