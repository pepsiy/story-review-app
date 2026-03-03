/**
 * run-sync.mjs - Chạy đồng bộ trực tiếp NEON 2 → NEON 1 hoặc ngược lại
 * Cách chạy: node run-sync.mjs
 */
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';
config(); // Load .env từ thư mục hiện tại

const getCleanUrl = (url) => {
    if (!url) return null;
    return url.replace('&channel_binding=require', '');
};

const ALL_TABLES = [
    "user", "works", "chapters", "reviews", "comments", "favorites", "seo_meta",
    "genres", "friendships", "chat_messages", "system_settings",
    "game_items", "inventory", "farm_plots", "game_logs",
    "missions", "user_missions",
    "beasts", "user_beast_encounters", "raid_logs", "raid_protection",
    "arena_battles", "ranking_rewards", "sects",
    "skills", "user_skills", "skill_books", "combat_sessions", "enemy_skills",
    "crawl_jobs", "crawl_chapters"
];

async function sync(from, to) {
    const url1 = getCleanUrl(process.env.NEON_DATABASE_URL_1);
    const url2 = getCleanUrl(process.env.NEON_DATABASE_URL_2);
    const sourceUrl = from === '1' ? url1 : url2;
    const targetUrl = to === '1' ? url1 : url2;

    console.log(`\n🔄 Bắt đầu đồng bộ NEON ${from} → NEON ${to}...\n`);

    const sourcePool = new Pool({ connectionString: sourceUrl });
    const targetPool = new Pool({ connectionString: targetUrl });

    for (const tableName of ALL_TABLES) {
        try {
            const result = await sourcePool.query(`SELECT * FROM "${tableName}" ORDER BY id ASC`);
            const rows = result.rows;
            if (rows.length === 0) { console.log(`⏭️  [${tableName}]: Trống`); continue; }

            let ok = 0, fail = 0;
            for (const row of rows) {
                try {
                    const columns = Object.keys(row);
                    const values = Object.values(row);
                    const colStr = columns.map(c => `"${c}"`).join(', ');
                    const valStr = values.map((_, i) => `$${i + 1}`).join(', ');
                    const setStr = columns.filter(c => !['id', 'sessionToken', 'identifier', 'token', 'key'].includes(c))
                        .map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

                    // Detect PK column (id, sessionToken, or identifier+token composite)
                    let conflictTarget = '"id"';
                    if (tableName === 'session') conflictTarget = '"sessionToken"';
                    if (tableName === 'account') conflictTarget = '"provider", "providerAccountId"';
                    if (tableName === 'verificationToken') conflictTarget = '"identifier", "token"';
                    if (tableName === 'system_settings') conflictTarget = '"key"';

                    const q = setStr
                        ? `INSERT INTO "${tableName}" (${colStr}) VALUES (${valStr}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setStr}`
                        : `INSERT INTO "${tableName}" (${colStr}) VALUES (${valStr}) ON CONFLICT DO NOTHING`;

                    await targetPool.query(q, values);
                    ok++;
                } catch (e) {
                    fail++;
                    if (fail === 1) console.log(`[${tableName}] Lỗi mẫu: ${e.message}`);
                }
            }
            console.log(`✅ [${tableName}]: ${ok}/${rows.length} rows (lỗi: ${fail})`);
        } catch (e) {
            console.log(`❌ [${tableName}]: Bỏ qua bảng - ${e.message}`);
        }
    }

    await sourcePool.end();
    await targetPool.end();
    console.log('\n🏁 Đồng bộ hoàn tất!');
}

// Sync NEON 1 → NEON 2 (NEON 1 có toàn bộ data thực)
sync('1', '2');
