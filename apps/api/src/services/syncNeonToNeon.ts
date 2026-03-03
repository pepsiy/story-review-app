/**
 * syncNeonToNeon.ts
 * Script đồng bộ trực tiếp dữ liệu từ NEON 2 → NEON 1 (hoặc ngược lại).
 * Dùng khi một NEON instance đã offline và cần catch-up lại data đầy đủ.
 *
 * Cách dùng:
 * - Gọi API: POST /admin/sync-neon  { "from": "2", "to": "1" }
 * - Hoặc import và gọi hàm syncNeonToNeon("2", "1") từ code
 */

import { Pool } from "@neondatabase/serverless";

const getCleanUrl = (url?: string) => {
    if (!url) return null;
    return url.replace("&channel_binding=require", "");
};

const ALL_TABLES = [
    // Core (theo thứ tự foreign key - parent trước)
    "user",
    "works",
    "chapters",
    "reviews",
    "comments",
    "favorites",
    "seo_meta",

    // Auth
    "account",
    "session",
    "verificationToken",

    // Social
    "genres",
    "friendships",
    "chat_messages",
    "system_settings",

    // Game - Farm & Items
    "game_items",
    "inventory",
    "farm_plots",
    "game_logs",

    // Game - Missions
    "missions",
    "user_missions",

    // Game - PVE / PVP
    "beasts",
    "user_beast_encounters",
    "raid_logs",
    "raid_protection",
    "arena_battles",
    "ranking_rewards",
    "sects",

    // Game - Turn Based Combat
    "skills",
    "user_skills",
    "skill_books",
    "combat_sessions",
    "enemy_skills",

    // Auto-Crawl
    "crawl_jobs",
    "crawl_chapters",
];

export async function syncNeonToNeon(from: "1" | "2", to: "1" | "2"): Promise<{ success: boolean; summary: string[] }> {
    const url1 = getCleanUrl(process.env.NEON_DATABASE_URL_1);
    const url2 = getCleanUrl(process.env.NEON_DATABASE_URL_2);

    const sourceUrl = from === "1" ? url1 : url2;
    const targetUrl = to === "1" ? url1 : url2;

    if (!sourceUrl || !targetUrl) {
        throw new Error(`Missing connection string for NEON ${!sourceUrl ? from : to}`);
    }
    if (sourceUrl === targetUrl) {
        throw new Error("Source and target are the same instance. Aborting.");
    }

    console.log(`🔄 [NEON Sync] Bắt đầu đồng bộ NEON ${from} → NEON ${to}...`);

    const sourcePool = new Pool({ connectionString: sourceUrl });
    const targetPool = new Pool({ connectionString: targetUrl });
    const summary: string[] = [];

    try {
        for (const tableName of ALL_TABLES) {
            try {
                // 1. Lấy toàn bộ rows từ source
                const result = await sourcePool.query(
                    `SELECT * FROM "${tableName}" ORDER BY id ASC`
                );
                const rows = result.rows;

                if (rows.length === 0) {
                    summary.push(`⏭️  [${tableName}]: Trống, bỏ qua.`);
                    continue;
                }

                // 2. UPSERT từng row sang target (batch 50 rows)
                let upserted = 0;
                let failed = 0;
                const batchSize = 50;

                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    for (const row of batch) {
                        try {
                            const columns = Object.keys(row);
                            const values = Object.values(row);
                            const colString = columns.map(c => `"${c}"`).join(", ");
                            const valPlaceholders = values.map((_, idx) => `$${idx + 1}`).join(", ");
                            const conflictSet = columns
                                .filter(c => c !== "id" && c !== "sessionToken" && c !== "identifier")
                                .map(c => `"${c}" = EXCLUDED."${c}"`)
                                .join(", ");

                            // Detect PK column (id, sessionToken, or identifier+token composite)
                            let conflictTarget = "id";
                            if (tableName === "session") conflictTarget = "sessionToken";
                            if (tableName === "verificationToken") conflictTarget = `"identifier", "token"`;
                            if (tableName === "account") conflictTarget = `"provider", "providerAccountId"`;

                            const query = conflictSet
                                ? `INSERT INTO "${tableName}" (${colString}) VALUES (${valPlaceholders})
                                   ON CONFLICT (${conflictTarget}) DO UPDATE SET ${conflictSet}`
                                : `INSERT INTO "${tableName}" (${colString}) VALUES (${valPlaceholders})
                                   ON CONFLICT DO NOTHING`;

                            await targetPool.query(query, values);
                            upserted++;
                        } catch (e: any) {
                            failed++;
                        }
                    }
                }

                const msg = `✅ [${tableName}]: ${upserted}/${rows.length} rows (lỗi: ${failed})`;
                summary.push(msg);
                console.log(`   ${msg}`);
            } catch (tableErr: any) {
                const msg = `❌ [${tableName}]: Bỏ qua - ${tableErr.message?.slice(0, 80)}`;
                summary.push(msg);
                console.warn(`   ${msg}`);
            }
        }

        console.log(`🏁 [NEON Sync] Hoàn tất đồng bộ NEON ${from} → NEON ${to}!`);
        return { success: true, summary };
    } finally {
        await sourcePool.end();
        await targetPool.end();
    }
}
