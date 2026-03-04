import { db, users, works, chapters, reviews, systemSettings } from "@repo/db";
import { sql, eq } from "drizzle-orm";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import cron from "node-cron";

// Thay chuỗi này bằng ID của Google Sheet
const SHEET_ID = process.env.GOOGLE_SHEETS_DATABASE_ID || "PASTE_YOUR_SHEET_ID_HERE";

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
];

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

// Only exclude truly HUGE raw columns that exceed Google Sheets 50k char cell limit.
// ai_text (summaries ~2-5k chars) and summary are kept - they are the valuable data!
const HEAVY_COLUMNS: Record<string, string[]> = {
    chapters: ['original_text'],        // raw full novel chapters can be 100k+ chars
    crawl_chapters: ['raw_content'],    // raw crawled HTML/text, not needed in backup
};

const LAST_SYNC_KEY = 'google_sheets_last_sync_time';

async function getLastSyncTime(): Promise<Date> {
    try {
        const result = await db.select().from(systemSettings).where(eq(systemSettings.key, LAST_SYNC_KEY)).limit(1);
        if (result.length && result[0].value) {
            return new Date(result[0].value);
        }
    } catch { /* First run */ }
    return new Date('2020-01-01T00:00:00Z');
}

async function saveLastSyncTime(date: Date): Promise<void> {
    try {
        await db.insert(systemSettings).values({
            key: LAST_SYNC_KEY,
            value: date.toISOString(),
        }).onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: date.toISOString() },
        });
    } catch (e) {
        console.warn('[Sheets] Failed to persist lastSyncTime to DB:', e);
    }
}

export async function syncDatabaseToSheets() {
    try {
        const isFailingOver = process.env.ACTIVE_NEON !== '1';
        // Mặc dù NEON 1 sụp có thể do hết CU, worker nếu vẫn chạy có thể gặp lỗi khi ping DB
        // Vì vậy ta nên cẩn thận không làm sập tiến trình node
        console.log("🔄 Bắt đầu tiến trình Delta Sync từ NEON sang Google Sheets...");

        // Tải thông tin tài liệu
        await doc.loadInfo();

        // Khởi tạo các Sheet nếu chưa có (1 bảng = 1 sheet con)
        const tablesToSync = [
            // Core
            { name: "Users", tableName: "user" },
            { name: "Works", tableName: "works" },
            { name: "Chapters", tableName: "chapters" },
            { name: "Reviews", tableName: "reviews" },
            { name: "Comments", tableName: "comments" },
            { name: "Favorites", tableName: "favorites" },
            { name: "SeoMeta", tableName: "seo_meta" },

            // Social & Custom
            { name: "Genres", tableName: "genres" },
            { name: "Friendships", tableName: "friendships" },
            { name: "ChatMessages", tableName: "chat_messages" },
            { name: "SystemSettings", tableName: "system_settings" },

            // Game - Farm & Items
            { name: "Inventory", tableName: "inventory" },
            { name: "FarmPlots", tableName: "farm_plots" },
            { name: "GameItems", tableName: "game_items" },
            { name: "GameLogs", tableName: "game_logs" },

            // Game - Missions
            { name: "Missions", tableName: "missions" },
            { name: "UserMissions", tableName: "user_missions" },

            // Game - PVE / PVP
            { name: "Beasts", tableName: "beasts" },
            { name: "UserBeastEncounters", tableName: "user_beast_encounters" },
            { name: "RaidLogs", tableName: "raid_logs" },
            { name: "RaidProtection", tableName: "raid_protection" },
            { name: "ArenaBattles", tableName: "arena_battles" },
            { name: "RankingRewards", tableName: "ranking_rewards" },
            { name: "Sects", tableName: "sects" },

            // Game - Turn Based Combat
            { name: "Skills", tableName: "skills" },
            { name: "UserSkills", tableName: "user_skills" },
            { name: "SkillBooks", tableName: "skill_books" },
            { name: "CombatSessions", tableName: "combat_sessions" },
            { name: "EnemySkills", tableName: "enemy_skills" },

            // Auto-Crawl System
            { name: "CrawlJobs", tableName: "crawl_jobs" },
            { name: "CrawlChapters", tableName: "crawl_chapters" }
        ];

        const currentSyncStart = new Date();
        const lastSyncTime = await getLastSyncTime();

        for (const table of tablesToSync) {
            let sheet = doc.sheetsByTitle[table.name];
            if (!sheet) {
                console.log(`Tạo sheet mới: ${table.name}`);
                sheet = await doc.addSheet({ title: table.name, headerValues: ['id', 'updated_at', 'deleted_at', 'data_json'] });
            }

            // Build SELECT excluding heavy columns that blow Sheets cell limits
            const heavyCols = HEAVY_COLUMNS[table.tableName] || [];
            const excludeClause = heavyCols.length > 0
                ? `-- exclude: ${heavyCols.join(', ')}` // just a comment, SELECT * if no easy way
                : '';

            const newRecordsCall = await db.execute(sql.raw(`
                SELECT * FROM "${table.tableName}"
                WHERE updated_at > '${lastSyncTime.toISOString()}'
                ORDER BY updated_at ASC
                LIMIT 500
            `));

            const rawRows: any[] = (newRecordsCall as any).rows ?? (newRecordsCall as any) ?? [];
            const newRecords = rawRows.map((r: any) => {
                // Strip heavy columns before serializing to Sheets
                if (heavyCols.length > 0) {
                    const cleaned = { ...r };
                    heavyCols.forEach(col => { delete cleaned[col]; });
                    return cleaned;
                }
                return r;
            });

            if (newRecords.length > 0) {
                console.log(`📦 Bảng [${table.name}]: Có ${newRecords.length} records mới cần đồng bộ.`);

                const rowsToAdd = newRecords.map((r: any) => ({
                    'id': String(r.id),
                    'updated_at': r.updated_at instanceof Date ? r.updated_at.toISOString() : (r.updated_at || ''),
                    'deleted_at': r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : r.deleted_at) : '',
                    'data_json': JSON.stringify(r)
                }));

                await sheet.addRows(rowsToAdd);
                console.log(`✅ Đã đồng bộ ${newRecords.length} records cho bảng [${table.name}]`);
            }
        }

        await saveLastSyncTime(currentSyncStart);
        console.log("🏁 Delta Sync hoàn thành.");

    } catch (error) {
        console.error("❌ Lỗi trong quá trình Delta Sync:", error);
    }
}

// Chạy Worker ngầm, mặc định mỗi 15 phút
export function startGoogleSheetsWorker() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.warn("⚠️  Chưa cấu hình Google JSON Credentials, bỏ qua Delta Sync Google Sheets.");
        return;
    }

    console.log("⏰ Kích hoạt Google Sheets Delta Sync Worker ngầm (Cron: 15p / lần). Vòng đầu tiên sẽ chạy sau 15p.");

    // Xóa gọi ngay lúc boot: Tránh Render Healthcheck bị Timeout 60s
    // syncDatabaseToSheets();

    // Định kỳ mỗi 15 phút
    cron.schedule("*/15 * * * *", () => {
        syncDatabaseToSheets();
    });
}
