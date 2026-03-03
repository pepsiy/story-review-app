import { GoogleGenAI } from "@google/genai";
import { db, systemSettings } from "../../../../packages/db/src";
import { eq } from "drizzle-orm";
import { emitLog } from "./socketService";

// --- SMART KEY MANAGER (Dual-Model Slots) ---

// 2 models per key – each model slot gets its own quota bucket
const GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"] as const;
const MODEL_RPD_LIMIT = 20;          // requests per day per model per key
const TOTAL_RPD_PER_KEY = MODEL_RPD_LIMIT * GEMINI_MODELS.length; // 40

interface SlotUsage {
    key: string;
    model: string;
    requestsToday: number;
    lastDailyReset: number;
    cooldownUntil: number;
    isDead: boolean;
    failedAttempts: number;
}

class KeyManager {
    // slotId = `${apiKey}::${model}`
    private slots: Map<string, SlotUsage> = new Map();
    private slotList: string[] = [];
    private lastUsedIndex = -1;
    private initialized = false;

    private getLastResetTime(now: number): number {
        const d = new Date(now);
        // 15:00 UTC+7 = 08:00 UTC
        const resetToday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0, 0));
        if (now < resetToday.getTime()) resetToday.setUTCDate(resetToday.getUTCDate() - 1);
        return resetToday.getTime();
    }

    private getNextResetTime(now: number): number {
        return this.getLastResetTime(now) + 24 * 60 * 60 * 1000;
    }

    async initialize() {
        if (this.initialized && this.slots.size > 0) return;

        let dbFreeKeys: string[] = [];
        try {
            const dbKey = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, "GEMINI_API_KEY") });
            if (dbKey?.value) dbFreeKeys = dbKey.value.split(/[,\n]+/).map((k: string) => k.trim()).filter((k: string) => k);
        } catch (e) { console.warn("⚠️ DB free keys error:", e); }

        let dbPaidKeys: string[] = [];
        try {
            const dbPaid = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, "GEMINI_PAID_KEYS") });
            if (dbPaid?.value) dbPaidKeys = dbPaid.value.split(/[,\n]+/).map((k: string) => k.trim()).filter((k: string) => k);
        } catch (e) { console.warn("⚠️ DB paid keys error:", e); }

        const envFreeKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
            .split(/[,\n]+/).map(k => k.trim().replace(/^['"]|['"]$/g, '')).filter(k => k && !k.startsWith("#"));
        const envPaidKeys = (process.env.GEMINI_PAID_KEYS || "")
            .split(/[,\n]+/).map(k => k.trim().replace(/^['"]|['"]$/g, '')).filter(k => k);

        const allKeys = Array.from(new Set([...dbFreeKeys, ...envFreeKeys, ...dbPaidKeys, ...envPaidKeys]));
        const now = Date.now();
        const lastReset = this.getLastResetTime(now);

        // Create one slot per (apiKey × model) combination
        allKeys.forEach(k => {
            GEMINI_MODELS.forEach(model => {
                const slotId = `${k}::${model}`;
                if (!this.slots.has(slotId)) {
                    this.slots.set(slotId, { key: k, model, requestsToday: 0, lastDailyReset: lastReset, cooldownUntil: 0, isDead: false, failedAttempts: 0 });
                }
            });
        });

        this.slotList = Array.from(this.slots.keys());
        console.log(`🔐 KeyManager: ${allKeys.length} keys × ${GEMINI_MODELS.length} models = ${this.slots.size} slots. Limit: ${MODEL_RPD_LIMIT}/slot/day (${TOTAL_RPD_PER_KEY}/key/day). Reset at 15:00 UTC+7.`);
        this.initialized = true;
    }

    /**
     * Round-robin through all key+model slots to find an available one
     */
    async getAvailableKeyAndModel(): Promise<{ key: string; model: string }> {
        await this.initialize();
        if (this.slots.size === 0) throw new Error("No GEMINI_API_KEYS configured.");

        const total = this.slotList.length;
        let minWaitTime = Infinity;

        for (let i = 0; i < total; i++) {
            const idx = (this.lastUsedIndex + 1 + i) % total;
            const slotId = this.slotList[idx];
            const slot = this.slots.get(slotId);
            if (!slot || slot.isDead) continue;

            const now = Date.now();
            if (slot.cooldownUntil > now) { minWaitTime = Math.min(minWaitTime, slot.cooldownUntil - now); continue; }

            // Auto-reset after 15:00
            const periodReset = this.getLastResetTime(now);
            if (slot.lastDailyReset < periodReset) { slot.requestsToday = 0; slot.lastDailyReset = periodReset; }

            if (slot.requestsToday >= MODEL_RPD_LIMIT) {
                const nextReset = this.getNextResetTime(now);
                const wait = Math.max(nextReset - now, 60000);
                slot.cooldownUntil = now + wait;
                console.warn(`⏳ [${slot.model} | ...${slot.key.slice(-5)}] exhausted ${slot.requestsToday}/${MODEL_RPD_LIMIT}. Cooling ${(wait / 3600000).toFixed(1)}h until 15:00.`);
                minWaitTime = Math.min(minWaitTime, wait);
                continue;
            }

            // FOUND!
            this.lastUsedIndex = idx;
            slot.requestsToday++;
            console.log(`🔑 Slot: ${slot.model} | ...${slot.key.slice(-5)} | ${slot.requestsToday}/${MODEL_RPD_LIMIT}`);
            return { key: slot.key, model: slot.model };
        }

        if (minWaitTime === Infinity) minWaitTime = 60000;
        if (minWaitTime < 100) minWaitTime = 1000;
        const coolingCount = Array.from(this.slots.values()).filter(s => s.cooldownUntil > Date.now()).length;
        console.log(`⏳ All ${this.slots.size} slots busy (cooling: ${coolingCount}).`);

        if (minWaitTime > 10000) {
            throw new Error(`All slots exhausted. Resumes in ~${(minWaitTime / 3600000).toFixed(1)}h at 15:00.`);
        }
        await new Promise(r => setTimeout(r, minWaitTime + 100));
        return this.getAvailableKeyAndModel();
    }

    public reportResult(key: string, model: string, success: boolean, statusCode?: number, isQuotaExhausted?: boolean) {
        const slot = this.slots.get(`${key}::${model}`);
        if (!slot) return;

        if (success) { slot.failedAttempts = 0; return; }
        slot.failedAttempts++;

        if (isQuotaExhausted) {
            const nextReset = this.getNextResetTime(Date.now());
            console.warn(`🛑 [${model} | ...${key.slice(-5)}] Quota exceeded. Cooling until 15:00.`);
            slot.cooldownUntil = nextReset;
            slot.requestsToday = MODEL_RPD_LIMIT;
            return;
        }

        if (statusCode === 429) {
            const backoff = [15000, 60000, 300000, 900000][Math.min(slot.failedAttempts - 1, 3)];
            console.warn(`⚠️ [${model} | ...${key.slice(-5)}] 429. Cooling ${backoff / 1000}s.`);
            slot.cooldownUntil = Date.now() + backoff;
        } else if (statusCode === 403) {
            // Entire key is invalid – kill all model slots for this key
            GEMINI_MODELS.forEach(m => { const s = this.slots.get(`${key}::${m}`); if (s) s.isDead = true; });
            console.warn(`💀 Key ...${key.slice(-5)} is dead (403). All slots marked.`);
        } else if (statusCode === 400 || statusCode === 500 || statusCode === 404) {
            console.warn(`⚠️ [${model} | ...${key.slice(-5)}] Error ${statusCode}. Cooling 5m.`);
            slot.cooldownUntil = Date.now() + 5 * 60 * 1000;
        }
    }

    getStats() {
        const now = Date.now();
        const stats: { key: string; today: string; status: string }[] = [];

        // Group slots by API key
        const keyMap = new Map<string, SlotUsage[]>();
        this.slotList.forEach(slotId => {
            const slot = this.slots.get(slotId)!;
            if (!keyMap.has(slot.key)) keyMap.set(slot.key, []);
            keyMap.get(slot.key)!.push(slot);
        });

        keyMap.forEach((modelSlots, apiKey) => {
            const periodReset = this.getLastResetTime(now);
            const totalUsed = modelSlots.reduce((sum, s) => sum + (s.lastDailyReset < periodReset ? 0 : s.requestsToday), 0);
            const anyDead = modelSlots.some(s => s.isDead);
            const allReady = modelSlots.every(s => !s.isDead && s.cooldownUntil <= now);
            const summaryStatus = anyDead ? "DEAD 💀" : allReady ? "READY" : (modelSlots.find(s => s.cooldownUntil > now)?.cooldownUntil
                ? `COOLING (${Math.ceil(((modelSlots.find(s => s.cooldownUntil > now)?.cooldownUntil ?? now) - now) / 1000)}s)` : "READY");

            stats.push({ key: `${apiKey.slice(0, 5)}...${apiKey.slice(-4)}`, today: `${totalUsed}/${TOTAL_RPD_PER_KEY}`, status: summaryStatus });

            modelSlots.forEach(s => {
                const used = s.lastDailyReset < periodReset ? 0 : s.requestsToday;
                const status = s.isDead ? "DEAD 💀" : s.cooldownUntil > now ? `COOLING (${Math.ceil((s.cooldownUntil - now) / 1000)}s)` : "READY";
                stats.push({ key: `  ↳ ${s.model}`, today: `${used}/${MODEL_RPD_LIMIT}`, status });
            });
        });

        return stats;
    }

    public reset() {
        this.initialized = false;
        this.slots.clear();
        this.slotList = [];
        console.log("♻️ KeyManager reset. Will reload on next request.");
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
        let model = "";
        try {
            const slot = await keyManager.getAvailableKeyAndModel();
            key = slot.key;
            model = slot.model;
            const keySuffix = key.slice(-5);

            console.log(`🔑 Using Key/Model: ...${keySuffix} / ${model}  (Attempt ${attempts} / ${MAX_ATTEMPTS})`);
            emitLog(`🔑 Attempt ${attempts}/${MAX_ATTEMPTS}: Using Key ...${keySuffix} / ${model}`);

            const ai = new GoogleGenAI({ apiKey: key });

            // Allow environment override, otherwise use the slot's specific model
            const modelName = process.env.GEMINI_MODEL || model;

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
            emitLog(`✅ AI Success with Key ...${keySuffix} / ${model}`);
            keyManager.reportResult(key, model, true);
            return cleanedText;

        } catch (error: any) {
            console.error(`❌ AI Error (Attempt ${attempts}):`, error.message);

            let code = 500;
            if (error.message?.includes("429")) code = 429;
            if (error.status === 403) code = 403;
            if (error.status === 400) code = 400;

            emitLog(`❌ Error with Key ...${key ? key.slice(-5) : 'unknown'} / ${model || 'unknown'}: ${code} (Attempt ${attempts})`, 'error');

            const isQuotaExhausted = error.message?.includes("Quota exceeded") ||
                JSON.stringify(error).includes("quotaMetric") || error.message?.includes("429");

            if (key && model) keyManager.reportResult(key, model, false, code, isQuotaExhausted);

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
