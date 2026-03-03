import { GoogleGenAI } from "@google/genai";
import { db, systemSettings } from "../../../../packages/db/src";
import { eq } from "drizzle-orm";
import { emitLog } from "./socketService";

// --- SMART KEY MANAGER ---

interface KeyUsage {
    key: string;
    cooldownUntil: number; // Timestamp when key is ready again
    totalRequestsToday: number;
    lastDailyReset: number;
    isDead: boolean; // If key is permanently invalid (400/403)
    failedAttempts: number; // Track consecutive failures
}

class KeyManager {
    private keys: Map<string, KeyUsage> = new Map();
    private keyList: string[] = []; // To support Round Robin by index
    private lastUsedIndex = -1; // Pointer for Round Robin

    private readonly RATE_LIMIT_RPD = 40; // Strict limit: 40 requests per day per key
    private initialized = false;

    constructor() { }

    /**
     * Get the timestamp for the most recent 15:00 UTC+7 (08:00 UTC)
     */
    private getLastResetTime(now: number): number {
        const d = new Date(now);
        // We want the most recent 08:00 UTC
        const resetToday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0, 0));
        if (now < resetToday.getTime()) {
            // It hasn't reached 15:00 today yet, so the last reset was yesterday at 15:00
            resetToday.setUTCDate(resetToday.getUTCDate() - 1);
        }
        return resetToday.getTime();
    }

    /**
     * Get the next reset time (Next 15:00 UTC+7)
     */
    private getNextResetTime(now: number): number {
        const lastReset = this.getLastResetTime(now);
        return lastReset + 24 * 60 * 60 * 1000;
    }

    /**
     * Load keys from DB and Env, initializing the manager
     */
    async initialize() {
        if (this.initialized && this.keys.size > 0) return;

        // 1. Try DB (Free/Standard Keys)
        let dbFreeKeys: string[] = [];
        try {
            const dbKey = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, "GEMINI_API_KEY")
            });
            if (dbKey && dbKey.value) {
                dbFreeKeys = dbKey.value.split(/[,\n]+/).map((k: string) => k.trim()).filter((k: string) => k.length > 0);
            }
        } catch (e) {
            console.warn("⚠️ Failed to fetch keys from DB:", e);
        }

        // 2. Try DB (Paid Keys)
        let dbPaidKeys: string[] = [];
        try {
            const dbPaid = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, "GEMINI_PAID_KEYS")
            });
            if (dbPaid && dbPaid.value) {
                dbPaidKeys = dbPaid.value.split(/[,\n]+/).map((k: string) => k.trim()).filter((k: string) => k.length > 0);
            }
        } catch (e) {
            console.warn("⚠️ Failed to fetch paid keys from DB", e);
        }

        // 3. Env Keys
        const envFreeKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
            .split(/[,\n]+/)
            .map(k => k.trim().replace(/^['"]|['"]$/g, ''))
            .filter(k => k.length > 0 && !k.startsWith("#"));

        const envPaidKeys = (process.env.GEMINI_PAID_KEYS || "")
            .split(/[,\n]+/)
            .map(k => k.trim().replace(/^['"]|['"]$/g, ''))
            .filter(k => k.length > 0);

        // 4. Merge ALL unique keys into one generic pool (All have standard 40/day limit now)
        const allKeys = Array.from(new Set([...dbFreeKeys, ...envFreeKeys, ...dbPaidKeys, ...envPaidKeys]));

        const now = Date.now();
        const lastReset = this.getLastResetTime(now);

        allKeys.forEach(k => {
            if (!this.keys.has(k)) {
                this.keys.set(k, {
                    key: k,
                    cooldownUntil: 0,
                    totalRequestsToday: 0,
                    lastDailyReset: lastReset,
                    isDead: false,
                    failedAttempts: 0
                });
            }
        });

        // Re-build keyList for Round Robin
        this.keyList = Array.from(this.keys.keys());

        console.log(`🔐 KeyManager Initialized with ${this.keys.size} keys.`);
        console.log(`💎 Limit Rule: Strict ${this.RATE_LIMIT_RPD} requests/day for all keys. Resets at 15:00 UTC+7.`);
        this.initialized = true;
    }

    /**
     * Get the best available key using Round Robin
     */
    async getAvailableKey(): Promise<string> {
        await this.initialize();
        if (this.keys.size === 0) {
            throw new Error("No GEMINI_API_KEYS configured.");
        }

        // --- ROUND ROBIN SELECTION ---
        const totalKeys = this.keyList.length;
        let minWaitTime = Infinity;

        // Try to find a key starting from the NEXT index after the last used one.
        for (let i = 0; i < totalKeys; i++) {
            const targetIndex = (this.lastUsedIndex + 1 + i) % totalKeys;
            const keyStr = this.keyList[targetIndex];
            const usage = this.keys.get(keyStr);

            if (!usage || usage.isDead) continue;

            const now = Date.now();

            // Check Cooldown
            if (usage.cooldownUntil > now) {
                minWaitTime = Math.min(minWaitTime, usage.cooldownUntil - now);
                continue;
            }

            // Check Daily Limit (Reset exactly at 15:00 UTC+7)
            const currentPeriodReset = this.getLastResetTime(now);
            if (usage.lastDailyReset < currentPeriodReset) {
                usage.totalRequestsToday = 0;
                usage.lastDailyReset = currentPeriodReset;
            }

            if (usage.totalRequestsToday >= this.RATE_LIMIT_RPD) {
                // STRICT DAILY RESET: Sleep until next 15:00 limit
                const nextReset = this.getNextResetTime(now);
                const cooldown = nextReset - now;
                const safeCooldown = cooldown > 0 ? cooldown : 60000;

                console.warn(`⏳ Key ...${keyStr.slice(-5)} Hit Daily Limit (${usage.totalRequestsToday}/${this.RATE_LIMIT_RPD}). Resets at 15:00: ${(safeCooldown / 1000 / 3600).toFixed(1)}h left.`);
                usage.cooldownUntil = now + safeCooldown;

                minWaitTime = Math.min(minWaitTime, safeCooldown);
                continue;
            }

            // FOUND VALID KEY!
            this.lastUsedIndex = targetIndex;

            // Record Usage
            usage.totalRequestsToday++;

            return keyStr;
        }

        // If loop finishes without returning, no key is available.
        if (minWaitTime === Infinity) {
            console.warn("⚠️ All API Keys seem dead or exhausted daily limit.");
            minWaitTime = 60000;
        }

        if (minWaitTime < 100) minWaitTime = 1000;

        const coolingCount = Array.from(this.keys.values()).filter(k => k.cooldownUntil > Date.now()).length;
        console.log(`⏳ All ${this.keys.size} keys unavailable. Waiting ${(minWaitTime / 1000).toFixed(1)}s... (Cooling: ${coolingCount})`);

        // Let's cap wait time to max 5 seconds if we're in an interactive loop just to avoid app deadlocks
        // but throw an error instead so process goes to catch.
        if (minWaitTime > 10000) {
            throw new Error(`All keys exhausted. Wait time: ${(minWaitTime / 1000 / 3600).toFixed(1)}h. Stopping to avoid deadlock.`);
        }

        await new Promise(r => setTimeout(r, minWaitTime + 100));

        // Recursively try again after wait
        return this.getAvailableKey();
    }

    /**
     * Report usage result to optimize state
     */
    public reportResult(key: string, success: boolean, statusCode?: number, forcedRetryMs?: number, isQuotaExhausted?: boolean) {
        const usage = this.keys.get(key);
        if (!usage) return;

        if (success) {
            usage.failedAttempts = 0; // Reset on success
            return;
        }

        usage.failedAttempts = (usage.failedAttempts || 0) + 1;

        if (isQuotaExhausted) {
            const now = Date.now();
            const nextReset = this.getNextResetTime(now);
            const msUntilTomorrow = nextReset - now;

            console.warn(`🛑 Key ...${key.slice(-5)} EXHAUSTED DAILY QUOTA EARLY (Status 429). Muting for ${(msUntilTomorrow / 1000 / 3600).toFixed(1)}h (until 15:00).`);
            usage.cooldownUntil = nextReset;
            // Force total to 40 so it stays capped
            usage.totalRequestsToday = this.RATE_LIMIT_RPD;
            return;
        }

        if (forcedRetryMs && forcedRetryMs > 0) {
            console.warn(`⏳ Key ...${key.slice(-5)} Explicit Retry-After: ${(forcedRetryMs / 1000).toFixed(2)}s from Google.`);
            usage.cooldownUntil = Date.now() + forcedRetryMs + 1000; // Add 1s safety buffer
            return;
        }

        if (statusCode === 429) {
            // Cool down for a long time on general 429 to avoid complete ban
            const backoffMsValues = [15000, 60000, 300000, 900000];
            const index = Math.min(usage.failedAttempts - 1, 3);
            const backoffMs = backoffMsValues[index];

            console.warn(`⚠️ Key ...${key.slice(-5)} hit Rate Limit (429). Fail #${usage.failedAttempts}. Cooling for ${backoffMs / 1000}s.`);
            usage.cooldownUntil = Date.now() + backoffMs;
        }
        else if (statusCode === 400 || statusCode === 403 || statusCode === 500 || statusCode === 404) {
            // 400 could mean invalid prompt, 403 invalid key
            if (statusCode === 403 || statusCode === 400) {
                console.warn(`💀 Key ...${key.slice(-5)} Error ${statusCode} (Dead Key). Marking Dead.`);
                usage.isDead = true;
            } else {
                console.warn(`⚠️ Key ...${key.slice(-5)} Error ${statusCode}. Cooling for 5m.`);
                usage.cooldownUntil = Date.now() + 5 * 60 * 1000;
            }
        }
    }

    getStats() {
        const now = Date.now();
        // Sort by index in keyList to show rotation order
        return this.keyList.map(k => {
            const usage = this.keys.get(k)!;

            // Revalidate period before showing stats
            const currentPeriodReset = this.getLastResetTime(now);
            if (usage.lastDailyReset < currentPeriodReset) {
                usage.totalRequestsToday = 0;
            }

            return {
                key: usage.key.slice(0, 5) + "...",
                today: `${usage.totalRequestsToday}/${this.RATE_LIMIT_RPD}`,
                status: usage.isDead ? "DEAD 💀" : (usage.cooldownUntil > now ? `COOLING (${Math.ceil((usage.cooldownUntil - now) / 1000)}s)` : "READY")
            };
        });
    }

    public reset() {
        this.initialized = false;
        this.keys.clear();
        console.log("♻️ KeyManager reset via Admin Settings. Will reload keys on next request.");
    }
}

export const keyManager = new KeyManager();

export const reloadKeys = () => {
    keyManager.reset();
};

// --- AI SERVICE IMPL ---

export const generateText = async (prompt: string): Promise<string> => {
    let attempts = 0;

    // Ensure initialized to get correct count
    await keyManager.initialize();

    // Explicitly check key count
    const stats = keyManager.getStats();
    const keyCount = stats.length;
    // Allow up to 3 full rotations
    const MAX_ATTEMPTS = Math.max(10, keyCount * 3);

    console.log(`[AI-Service] Starting generation. Total Keys Available: ${keyCount}. Max Retries: ${MAX_ATTEMPTS}`);
    emitLog(`🤖 Start AI Generation. Available Keys: ${keyCount}. Plan to retry up to ${MAX_ATTEMPTS} times.`);

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        let key = "";
        try {
            key = await keyManager.getAvailableKey();
            const keySuffix = key.slice(-5);

            console.log(`🔑 Using Key: ...${keySuffix} (Attempt ${attempts} / ${MAX_ATTEMPTS})`);
            emitLog(`🔑 Attempt ${attempts}/${MAX_ATTEMPTS}: Using Key ...${keySuffix}`);

            const ai = new GoogleGenAI({ apiKey: key });

            // Force Model 3.0 or 2.5 Flash as requested by guide
            const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

            console.log("----------------------------------------------------------------");
            console.log("🚀 [AI DEBUG] Sending Prompt to", modelName);
            console.log("----------------------------------------------------------------");

            // Timeout wrapper (180s)
            const resultPromise = ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    thinkingConfig: {
                        thinkingLevel: "low" as any
                    }
                }
            });

            const response = await Promise.race([
                resultPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout after 180s")), 180000))
            ]) as any;

            const textResponse = response.text || "";
            // Optionally clean json output if returned as block
            const cleanedText = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

            console.log("----------------------------------------------------------------");
            console.log("📄 [AI DEBUG] RAW AI OUTPUT PREVIEW:\n", cleanedText.substring(0, 200) + "...");
            console.log(`✅ [AI-Service] Done key ...${keySuffix}. Length: ${cleanedText.length}`);
            console.log("----------------------------------------------------------------");

            // success
            emitLog(`✅ AI Success with Key ...${keySuffix}`);
            keyManager.reportResult(key, true);
            return cleanedText;

        } catch (error: any) {
            console.error(`❌ AI Error (Attempt ${attempts}):`, error.message);

            let code = 500;
            if (error.message?.includes("429")) code = 429;
            if (error.status === 403) code = 403;
            if (error.status === 400) code = 400;

            emitLog(`❌ Error with Key ...${key ? key.slice(-5) : 'unknown'}: ${code} (Attempt ${attempts})`, 'error');

            let retryMs = 0;
            const isQuotaExhausted = error.message?.includes("Quota exceeded") ||
                JSON.stringify(error).includes("quotaMetric") || error.message?.includes("429");

            if (key) keyManager.reportResult(key, false, code, retryMs, isQuotaExhausted);

            // Wait a bit to prevent tight loop
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error("Failed to generate text after max retries");
};

/**
 * Tóm tắt 1 chapter bằng AI (Single Pipeline)
 */
export const summarizeChapter = async (
    chapterNumber: number,
    title: string,
    content: string
): Promise<string> => {
    // Check Stats
    const stats = keyManager.getStats();
    console.log("[KeyManager Stats]", JSON.stringify(stats));

    console.log(`[AI-Service] Processing Single-Prompt for: ${title}`);

    // Warning if too short
    if (content.length < 500) {
        console.warn(`[AI-Service] Content too short (${content.length}), AI might hallucinate.`);
    }

    try {
        console.log(`[AI-Service] 🚀 Starting Single-Request Mega-Pipeline for: ${title}`);

        const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng.Nhiệm vụ của bạn là thực hiện 3 yêu cầu xử lý văn bản chuyên sâu cho nội dung bên dưới(được gộp từ ${title}).

---
🛑 ** QUY TẮC CHUNG "BẤT KHẢ XÂM PHẠM" **:
        1. ** KHÔNG ĐƯỢC COPY ** nguyên văn bản gốc.
2. ** SÁNG TẠO **: Phải viết lại bằng giọng văn hoàn toàn mới, sắc sảo và lôi cuốn hơn.
3. ** ĐỊNH DẠNG **: Trả về đúng 4 phần, ngăn cách bởi dấu "|||".
4. ** CẤM **: Không được tự ý thêm các nhãn như "PHẦN 1:", "TÊN CHƯƠNG:", "TÓM TẮT:".Chỉ trả về nội dung của từng phần.

---
📝 ** Nội Dung Gốc **:
${content.substring(0, 100000)}

        ---
⚠️ ** YÊU CẦU ĐẦU RA CHI TIẾT ** (Phải tuân thủ tuyệt đối từng mục):

** PHẦN 1: TÊN CHƯƠNG MỚI **
            - Tiêu chí: Ngắn gọn, súc tích, gợi mở sự tò mò(Tối đa 5 - 8 từ).
- Yêu cầu:
        - Tên chương phải GỢI TỚI nội dung chính của chương
            - Ngắn gọn, dễ nhớ, hấp dẫn
                - KHÔNG dùng số thứ tự(VD: "Chương 1", "Phần 1")
                    - KHÔNG dùng từ "Chương" trong tên
                        - Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa"

                            |||

** PHẦN 4: SỰ KIỆN GAME(GAME TAGS) - CHO HỆ THỐNG GAME TU TIÊN **
            - Phân tích nội dung chương và trả về danh sách các sự kiện(Tags) để kích hoạt buff / debuff / PVE trong game.
- Định dạng: JSON Array các chuỗi(String).
- Danh sách sự kiện hợp lệ(Chỉ chọn nếu có tình tiết tương ứng):
        - "HEAVY_RAIN": Có mưa lớn, bão tố. (Buff: Cây lớn nhanh)
            - "SUNNY_DAY": Trời nắng đẹp, khô ráo. (Buff: Giảm thu hoạch)
                - "BATTLE": Có chiến đấu, đánh nhau kịch liệt. (Buff: Tăng tỷ lệ đột phá)
                    - "AUCTION": Có đấu giá, mua bán trao đổi. (Buff: Giảm giá Shop)
                        - "MEDITATION": Nhân vật bế quan, tu luyện, ngồi thiền. (Buff: Tăng EXP nhận được)
                            - "DANGER": Nhân vật gặp nguy hiểm, bị truy sát. (Debuff: Giảm tỷ lệ đột phá)
                                - "BEAST_WOLF": Xuất hiện quái vật Sói Hoang(cấp độ thấp). (PVE: Spawn Beast)
                                    - "BEAST_TIGER": Xuất hiện quái vật Hổ Núi(cấp độ trung). (PVE: Spawn Beast)
                                        - "BEAST_DRAGON": Xuất hiện quái vật Giao Long(cấp độ cao). (PVE: Spawn Beast)
                                            - Ví dụ: ["HEAVY_RAIN", "BATTLE", "BEAST_WOLF"] hoặc[] nếu không có sự kiện nào nổi bật.
- Chỉ trả về mảng JSON, không thêm text khác.


** PHẦN 2: TÓM TẮT NGẮN(SHORT SUMMARY) **
            - Góc độ: ** PHÂN TÍCH & CẢM NHẬN ** (Review) chứ không chỉ kể lại.
- Yêu cầu:
        - Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
    - Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
            - TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
                - Độ dài: 3 - 5 câu.

|||

** PHẦN 3: NỘI DUNG VIẾT LẠI(REWRITE CONTENT) **
- ** MỤC TIÊU **: Biến chương truyện thành một bài ** REVIEW KỂ CHUYỆN ** (Storytelling Review).
- ** ĐỘ DÀI **: CÔ ĐỌNG, chỉ giữ lại diễn biến cốt lõi(khoảng 40 - 50 % dung lượng gốc).Cắt bỏ hội thoại lôi thôi.
- ** PHONG CÁCH **: Nhịp điệu NHANH, dồn dập.Dùng từ ngữ gợi hình mạnh.
- ** CẤU TRÚC **:
   + ** Mở đầu bắt buộc **: * "Đây là bản tóm tắt và cảm nhận nội dung, không thay thế tác phẩm gốc." *
   + ** Thân bài **: Kể lại các sự kiện chính bằng giọng văn của một người đang kể chuyện say sưa.
   + ** Kết thúc **: Dừng lại ĐỘT NGỘT ngay tại cao trào(Cliffhanger). 🚫 KHÔNG viết đoạn kết luận / nhận xét cuối bài.

👇 ** TRẢ VỀ KẾT QUẢ NGAY BÊN DƯỚI(Chỉ nội dung, không kèm tiêu đề phần) **: `;

        console.log("👉 [AI-Service] Sending Mega-Prompt...");

        // Log Full prompt again here as requested by user in last turn
        console.log("📝 [DEBUG] FULL PROMPT SENT:\n", prompt);

        // Use generic generateText which handles rotation
        return await generateText(prompt);

    } catch (error: any) {
        console.error("❌ Error in AI Pipeline:", error);
        throw error;
    }
};

/**
 * Get rate limit stats
 */
export const getRateLimitStats = () => keyManager.getStats();
