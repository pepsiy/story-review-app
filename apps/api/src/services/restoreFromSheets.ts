import { db } from "@repo/db";
import { sql } from "drizzle-orm";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

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

export async function restoreFromSheets() {
    try {
        console.log("🔄 Bắt đầu tiến trình Khôi phục/Đồng bộ UPSERT từ Google Sheets sang NEON (Standby)...");

        if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            console.error("❌ Lỗi: Thiếu chứng chỉ Google Service Account (.env)");
            return;
        }

        await doc.loadInfo();

        // Khôi phục theo thứ tự bảng để tránh xung đột khóa ngoại (Foreign Keys)
        // Parent first, child later
        const tablesToSync = [
            { name: "Users", tableName: "user" },
            { name: "Works", tableName: "works" },
            { name: "Chapters", tableName: "chapters" },
            { name: "Reviews", tableName: "reviews" }
        ];

        for (const table of tablesToSync) {
            const sheet = doc.sheetsByTitle[table.name];
            if (!sheet) {
                console.log(`⚠️ Bảng [${table.name}] chưa có trong Sheet, bỏ qua.`);
                continue;
            }

            console.log(`📥 Đang khôi phục bảng [${table.name}]...`);
            const rows = await sheet.getRows();

            let successCount = 0;
            let failCount = 0;

            for (const row of rows) {
                try {
                    const id = row.get('id');
                    const dataJson = row.get('data_json');
                    if (!dataJson) continue;

                    const data = JSON.parse(dataJson);

                    // Convert object into Dynamic Row
                    const columns = Object.keys(data);
                    const values = Object.values(data);

                    // Build standard Postgres UPSERT
                    const colString = columns.map(c => `"${c}"`).join(', ');
                    const setString = columns.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

                    // Chạy query Postgres trần (Raw Query Bypass Drizzle types for dynamic inject)
                    // Do Drizzle không truyền động mảng params dễ dàng trong db.execute string literal
                    // Ta escape Injection cơ bản bằng SQL template:

                    // Lấy pool client nguyên bản để chạy trực tiếp raw query (vì dynamic array values)
                    const client = (db as any).session.client;

                    // Tạo mảng params $1, $2, $3...
                    const valIndices = values.map((_, i) => `$${i + 1}`).join(', ');
                    const query = `
             INSERT INTO "${table.tableName}" (${colString})
             VALUES (${valIndices})
             ON CONFLICT (id) DO UPDATE SET ${setString}
           `;

                    await client.query(query, values);
                    successCount++;
                } catch (e: any) {
                    failCount++;
                    // console.error(`- Lỗi chèn id phụ:`, e.message);
                }
            }
            console.log(`✅ [${table.name}]: Đã khôi phục ${successCount} dòng (Lỗi: ${failCount})`);
        }

        console.log("🏁 Quá trình khôi phục Hoàn tất!");
    } catch (error) {
        console.error("❌ Lỗi Restore Critical:", error);
    }
}
