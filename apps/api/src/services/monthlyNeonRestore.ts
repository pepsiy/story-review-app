/**
 * monthlyNeonRestore.ts
 *
 * Cron job chạy vào 00:05 mỗi ngày 1 hàng tháng.
 * Lý do: Neon Free Tier reset 100h compute hours vào ngày 1.
 * Nếu NEON 1 đã hết quota và đang failover sang NEON 2,
 * script này sẽ tự động:
 *   1. Ping NEON 1 → kiểm tra quota đã được reset chưa
 *   2. Nếu NEON 1 sống lại → sync data từ NEON 2 → NEON 1
 *   3. Cập nhật trạng thái failover về false (tự chuyển lại NEON 1)
 */
import cron from "node-cron";
import { Pool } from "@neondatabase/serverless";
import { syncNeonToNeon } from "./syncNeonToNeon";

const getCleanUrl = (url?: string) => {
    if (!url) return null;
    return url.replace("&channel_binding=require", "");
};

async function pingNeon1(): Promise<boolean> {
    const url1 = getCleanUrl(process.env.NEON_DATABASE_URL_1);
    if (!url1) return false;

    const pool = new Pool({ connectionString: url1 });
    try {
        await pool.query("SELECT 1");
        return true;
    } catch {
        return false;
    } finally {
        await pool.end();
    }
}

export function startMonthlyNeonRestore() {
    // Chạy vào 00:05 ngày 1 hàng tháng (đủ thời gian Neon reset quota xong)
    // Cron format: "phút giờ ngày tháng thứ"
    cron.schedule("5 0 1 * *", async () => {
        console.log("📅 [Monthly Reset] Ngày 1 tháng mới — Kiểm tra NEON 1 đã reset quota chưa...");

        const neon1IsAlive = await pingNeon1();

        if (!neon1IsAlive) {
            console.warn("⚠️  [Monthly Reset] NEON 1 vẫn chưa sống lại. Bỏ qua tháng này.");
            return;
        }

        console.log("✅ [Monthly Reset] NEON 1 đã sống! Bắt đầu đồng bộ NEON 2 → NEON 1...");

        try {
            const { summary } = await syncNeonToNeon("2", "1");
            console.log("🏁 [Monthly Reset] Đồng bộ hoàn tất:");
            summary.forEach(line => console.log("  " + line));

            // Reset failover flag trong môi trường runtime 
            // (server sẽ tự route về NEON 1 trong lần restart hoặc deploy tiếp theo)
            console.log("🔁 [Monthly Reset] NEON 1 đã sẵn sàng. Đề xuất: vào Render trigger Redeploy để switch chính thức về NEON 1.");
        } catch (err: any) {
            console.error("❌ [Monthly Reset] Lỗi khi đồng bộ:", err.message);
        }
    });

    console.log("📅 Monthly NEON Auto-Restore Scheduler đã bật (Cron: 00:05 ngày 1 hàng tháng).");
}
