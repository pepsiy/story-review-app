import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, systemSettings } from "../../../../packages/db/src";
import { eq } from "drizzle-orm";

// --- SMART KEY MANAGER ---

interface KeyUsage {
    key: string;
    requestsInCurrentWindow: number;
    windowStartTime: number;
    cooldownUntil: number; // Timestamp when key is ready again
    totalRequestsToday: number;
    lastDailyReset: number;
    isDead: boolean; // If key is permanently invalid (400/403)
}

class KeyManager {
    private keys: Map<string, KeyUsage> = new Map();
    private readonly RATE_LIMIT_RPM = 12; // Free Tier is 15. Set 12 to be safe.
    private readonly RATE_LIMIT_RPD = 1400; // Free Tier is 1500. Set 1450 safe.
    private readonly WINDOW_SIZE_MS = 60000; // 1 minute
    private initialized = false;

    constructor() { }

    /**
     * Load keys from DB and Env, initializing the manager
     */
    async initialize() {
        if (this.initialized && this.keys.size > 0) return;

        let keyList: string[] = [];

        // 1. Try DB
        try {
            const dbKey = await db.query.systemSettings.findFirst({
                where: eq(systemSettings.key, "GEMINI_API_KEY")
            });
            if (dbKey && dbKey.value) {
                keyList = dbKey.value.split(",").map(k => k.trim()).filter(k => k.length > 0);
            }
        } catch (e) {
            console.warn("⚠️ Failed to fetch keys from DB:", e);
        }

        // 2. Try Env
        const envKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
            .split(",")
            .map(k => k.trim())
            .filter(k => k.length > 0);

        // Merge unique
        const allKeys = Array.from(new Set([...keyList, ...envKeys]));

        if (allKeys.length === 0) {
            console.error("❌ No GEMINI_API_KEYS found!");
            // Instead of throw, we allow init but getAvailableKey will fail
        }

        // Initialize state for new keys
        allKeys.forEach(k => {
            if (!this.keys.has(k)) {
                this.keys.set(k, {
                    key: k,
                    requestsInCurrentWindow: 0,
                    windowStartTime: Date.now(),
                    cooldownUntil: 0,
                    totalRequestsToday: 0,
                    lastDailyReset: Date.now(),
                    isDead: false
                });
            }
        });

        console.log(`🔐 KeyManager Initialized with ${this.keys.size} keys.`);
        this.initialized = true;
    }

    /**
     * Get the best available key, or wait if necessary.
     */
    async getAvailableKey(): Promise<string> {
        await this.initialize();
        if (this.keys.size === 0) {
            throw new Error("No GEMINI_API_KEYS configured.");
        }

        while (true) {
            const now = Date.now();
            let bestKey: string | null = null;
            let minWaitTime = Infinity;

            // Check each key state
            for (const [keyStr, usage] of this.keys.entries()) {
                if (usage.isDead) continue;

                // Check Cooldown
                if (usage.cooldownUntil > now) {
                    minWaitTime = Math.min(minWaitTime, usage.cooldownUntil - now);
                    continue;
                }

                // Check Daily Limit (Reset if needed)
                if (now - usage.lastDailyReset > 86400000) { // 24h
                    usage.totalRequestsToday = 0;
                    usage.lastDailyReset = now;
                }
                if (usage.totalRequestsToday >= this.RATE_LIMIT_RPD) {
                    // Key exhausted for day - wait for next day? 
                    // Too long to wait, just skip.
                    const cooldown = 86400000 - (now - usage.lastDailyReset);
                    minWaitTime = Math.min(minWaitTime, cooldown);
                    continue;
                }

                // Check RPM Window (Reset if needed)
                if (now - usage.windowStartTime > this.WINDOW_SIZE_MS) {
                    usage.requestsInCurrentWindow = 0;
                    usage.windowStartTime = now;
                }

                if (usage.requestsInCurrentWindow < this.RATE_LIMIT_RPM) {
                    // Valid key found!
                    bestKey = keyStr;
                    break; // Found one, exit loop
                } else {
                    // Key busy, calculate wait time for next window
                    const wait = this.WINDOW_SIZE_MS - (now - usage.windowStartTime);
                    minWaitTime = Math.min(minWaitTime, wait);
                }
            }

            if (bestKey) {
                // Record provisional usage
                const usage = this.keys.get(bestKey)!;
                usage.requestsInCurrentWindow++;
                usage.totalRequestsToday++;
                return bestKey;
            }

            // No key available
            if (minWaitTime === Infinity) {
                console.warn("⚠️ All API Keys seem dead or exhausted daily limit.");
                minWaitTime = 60000; // Default 1m wait
            }

            // Cap minWaitTime to avoid infinite stuck
            if (minWaitTime < 100) minWaitTime = 1000;

            console.log(`⏳ All ${this.keys.size} keys busy/cooling. Waiting ${(minWaitTime / 1000).toFixed(1)}s...`);
            await new Promise(r => setTimeout(r, minWaitTime + 100));
        }
    }

    /**
     * Report usage result to optimize state
     */
    reportResult(key: string, success: boolean, statusCode?: number) {
        const usage = this.keys.get(key);
        if (!usage) return;

        if (!success) {
            if (statusCode === 429) {
                console.warn(`⚠️ Key ${key.slice(0, 4)}... hit Rate Limit (429). Cooling for 60s.`);
                usage.cooldownUntil = Date.now() + 60000;
            }
            if (statusCode === 400 || statusCode === 403) {
                // Potentially mark dead, but safety first - just cool
                usage.cooldownUntil = Date.now() + 60000;
            }
        }
    }

    getStats() {
        return Array.from(this.keys.values()).map(k => ({
            key: k.key.slice(0, 5) + "...",
            rpm: `${k.requestsInCurrentWindow}/${this.RATE_LIMIT_RPM}`,
            today: `${k.totalRequestsToday}/${this.RATE_LIMIT_RPD}`,
            status: k.isDead ? "DEAD" : (k.cooldownUntil > Date.now() ? `COOLING (${Math.ceil((k.cooldownUntil - Date.now()) / 1000)}s)` : "READY")
        }));
    }
}

export const keyManager = new KeyManager();

// --- AI SERVICE IMPL ---

export const generateText = async (prompt: string): Promise<string> => {
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Try up to 5 times (switching keys each time potentially)

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        let key = "";
        try {
            key = await keyManager.getAvailableKey();
            console.log(`🔑 Using Key: ${key.slice(0, 4)}... (Attempt ${attempts})`);

            const genAI = new GoogleGenerativeAI(key);

            // Force Model 2.5 Flash
            const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                }
            });

            console.log("----------------------------------------------------------------");
            console.log("🚀 [AI DEBUG] Sending Prompt to", modelName);
            // Log full prompt for debug
            // console.log("📝 [DEBUG] FULL PROMPT SENT:\n", prompt); 
            // Commented out prompt log to avoid spamming 50k chars in console unless debugging
            console.log("📝 [AI DEBUG] Prompt Preview:", prompt.substring(0, 200) + "..." + prompt.slice(-200));
            console.log("----------------------------------------------------------------");

            // Timeout wrapper (180s)
            const resultPromise = model.generateContent(prompt);
            const result = await Promise.race([
                resultPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout after 180s")), 180000))
            ]) as any;

            const response = await result.response;
            const textResponse = response.text();

            console.log("----------------------------------------------------------------");
            console.log("📄 [AI DEBUG] RAW AI OUTPUT PREVIEW:\n", textResponse.substring(0, 200) + "...");
            console.log(`✅ [AI-Service] Done. Length: ${textResponse.length}`);
            console.log("----------------------------------------------------------------");

            // Report Success (Implicitly, counters already incremented)
            keyManager.reportResult(key, true);
            return textResponse;

        } catch (error: any) {
            console.error(`❌ AI Error (Attempt ${attempts}):`, error.message);

            let code = 500;
            if (error.message?.includes("429")) code = 429;
            else if (error.message?.includes("403")) code = 403;
            else if (error.message?.includes("400")) code = 400;

            if (key) keyManager.reportResult(key, false, code);

            // If it's a safety block or content error (not quota), maybe we shouldn't retry?
            // "Candidate was blocked due to safety" -> usually 400 or specific message.
            // But we will retry with another key just in case it's random.

            if (attempts >= MAX_ATTEMPTS) {
                throw error;
            }
            // Small pause
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

        const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng. Nhiệm vụ của bạn là thực hiện 3 yêu cầu xử lý văn bản chuyên sâu cho nội dung bên dưới (được gộp từ ${title}).

---
🛑 **QUY TẮC CHUNG "BẤT KHẢ XÂM PHẠM"**:
1. **KHÔNG ĐƯỢC COPY** nguyên văn bản gốc.
2. **SÁNG TẠO**: Phải viết lại bằng giọng văn hoàn toàn mới, sắc sảo và lôi cuốn hơn.
3. **ĐỊNH DẠNG**: Trả về đúng 4 phần, ngăn cách bởi dấu "|||".
4. **CẤM**: Không được tự ý thêm các nhãn như "PHẦN 1:", "TÊN CHƯƠNG:", "TÓM TẮT:". Chỉ trả về nội dung của từng phần.

---
📝 **Nội Dung Gốc**:
${content.substring(0, 100000)}

---
⚠️ **YÊU CẦU ĐẦU RA CHI TIẾT** (Phải tuân thủ tuyệt đối từng mục):

**PHẦN 1: TÊN CHƯƠNG MỚI**
- Tiêu chí: Ngắn gọn, súc tích, gợi mở sự tò mò (Tối đa 5-8 từ).
- Yêu cầu:
    - Tên chương phải GỢI TỚI nội dung chính của chương
    - Ngắn gọn, dễ nhớ, hấp dẫn
    - KHÔNG dùng số thứ tự (VD: "Chương 1", "Phần 1")
    - KHÔNG dùng từ "Chương" trong tên
    - Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa"

|||

**PHẦN 4: SỰ KIỆN GAME (GAME TAGS) - CHO HỆ THỐNG GAME TU TIÊN**
- Phân tích nội dung chương và trả về danh sách các sự kiện (Tags) để kích hoạt buff/debuff trong game.
- Định dạng: JSON Array các chuỗi (String).
- Danh sách sự kiện hợp lệ (Chỉ chọn nếu có tình tiết tương ứng):
    - "HEAVY_RAIN": Có mưa lớn, bão tố. (Buff: Cây lớn nhanh)
    - "SUNNY_DAY": Trời nắng đẹp, khô ráo. (Buff: Giảm thu hoạch)
    - "BATTLE": Có chiến đấu, đánh nhau kịch liệt. (Buff: Tăng tỷ lệ đột phá)
    - "AUCTION": Có đấu giá, mua bán trao đổi. (Buff: Giảm giá Shop)
    - "MEDITATION": Nhân vật bế quan, tu luyện, ngồi thiền. (Buff: Tăng EXP nhận được)
    - "DANGER": Nhân vật gặp nguy hiểm, bị truy sát. (Debuff: Giảm tỷ lệ đột phá)
- Ví dụ: ["HEAVY_RAIN", "BATTLE"] hoặc [] nếu không có sự kiện nào nổi bật.
- Chỉ trả về mảng JSON, không thêm text khác.


**PHẦN 2: TÓM TẮT NGẮN (SHORT SUMMARY)**
- Góc độ: **PHÂN TÍCH & CẢM NHẬN** (Review) chứ không chỉ kể lại.
- Yêu cầu:
    - Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
    - Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
    - TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
    - Độ dài: 3-5 câu.

|||

**PHẦN 3: NỘI DUNG VIẾT LẠI (REWRITE CONTENT)**
- **MỤC TIÊU**: Biến chương truyện thành một bài **REVIEW KỂ CHUYỆN** (Storytelling Review).
- **ĐỘ DÀI**: CÔ ĐỌNG, chỉ giữ lại diễn biến cốt lõi (khoảng 40-50% dung lượng gốc). Cắt bỏ hội thoại lôi thôi.
- **PHONG CÁCH**: Nhịp điệu NHANH, dồn dập. Dùng từ ngữ gợi hình mạnh.
- **CẤU TRÚC**:
   + **Mở đầu bắt buộc**: *"Đây là bản tóm tắt và cảm nhận nội dung, không thay thế tác phẩm gốc."*
   + **Thân bài**: Kể lại các sự kiện chính bằng giọng văn của một người đang kể chuyện say sưa.
   + **Kết thúc**: Dừng lại ĐỘT NGỘT ngay tại cao trào (Cliffhanger). 🚫 KHÔNG viết đoạn kết luận/nhận xét cuối bài.

👇 **TRẢ VỀ KẾT QUẢ NGAY BÊN DƯỚI (Chỉ nội dung, không kèm tiêu đề phần)**:`;

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
