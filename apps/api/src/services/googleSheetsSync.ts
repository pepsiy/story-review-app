import { db, users, works, chapters, reviews } from "@repo/db";
import { sql } from "drizzle-orm";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import cron from "node-cron";

// Thay chuỗi này bằng ID của Google Sheet
// ID là phần nằm giữa /d/ và /edit trong đường dẫn của sheet
const SHEET_ID = process.env.GOOGLE_SHEETS_DATABASE_ID || "PASTE_YOUR_SHEET_ID_HERE";

// Email & Private Key lấy từ file JSON của Google Service Account
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

// Lưu thời gian đồng bộ cuối cùng trong RAM (hoặc tốt hơn lưu xuống DB/Redis)
let lastSyncTime = new Date('2020-01-01T00:00:00Z'); // Lần đầu tiên sẽ lấy toàn bộ

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

        for (const table of tablesToSync) {
            // Tìm sheet theo tên, nếu không có thì tạo mới
            let sheet = doc.sheetsByTitle[table.name];
            if (!sheet) {
                console.log(`Tạo sheet mới: ${table.name}`);
                // Chú ý: Việc lấy columns động phụ thuộc vào Drizzle schema. Bạn có thể định nghĩa cứng Header ở đây.
                sheet = await doc.addSheet({ title: table.name, headerValues: ['id', 'updated_at', 'deleted_at', 'data_json'] });
            }

            // Lấy data đã cập nhật từ DB (Delta Sync)
            // Chú ý: Vì Drizzle không hỗ trợ cú pháp > động, ta dùng raw SQL
            const newRecordsCall = await db.execute(sql.raw(`
        SELECT * FROM "${table.tableName}"
        WHERE updated_at > '${lastSyncTime.toISOString()}'
        ORDER BY updated_at ASC
        LIMIT 1000
      `));

            const newRecords = newRecordsCall.rows || newRecordsCall;

            if (newRecords.length > 0) {
                console.log(`📦 Bảng [${table.name}]: Có ${newRecords.length} records mới cần đồng bộ.`);

                // Append vào file Sheet (dạng JSON Event Log Mở Rộng)
                const rowsToAdd = newRecords.map((r: any) => ({
                    'id': String(r.id),
                    'updated_at': r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
                    'deleted_at': r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : r.deleted_at) : '',
                    'data_json': JSON.stringify(r)
                }));

                await sheet.addRows(rowsToAdd);
                console.log(`✅ Đã đồng bộ ${newRecords.length} records cho bảng [${table.name}]`);
            } else {
                // console.log(`⏳ Bảng [${table.name}]: Không có data mới.`);
            }
        }

        // Cập nhật thẻ thời gian sync sau khi thành công
        lastSyncTime = currentSyncStart;
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
