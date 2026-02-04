import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, systemSettings } from "../../../../packages/db/src";
import { eq } from "drizzle-orm";

// Load keys from DB or Env
const getApiKeys = async (): Promise<string[]> => {
    try {
        // Try DB first
        const dbKey = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, "GEMINI_API_KEY")
        });

        if (dbKey && dbKey.value) {
            console.log("🔑 Using GEMINI_API_KEY from Database");
            return dbKey.value.split(",").map(k => k.trim()).filter(k => k.length > 0);
        }
    } catch (e) {
        console.warn("⚠️ Failed to fetch key from DB, falling back to Env:", e);
    }

    // Fallback to Env
    const keys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
    return keys.split(",").map(k => k.trim()).filter(k => k.length > 0);
};

let currentKeyIndex = 0;

export const generateText = async (prompt: string): Promise<string> => {
    const keys = await getApiKeys();

    if (keys.length === 0) {
        throw new Error("No GEMINI_API_KEYS found in Database or Environment variables.");
    }

    const maxRetries = keys.length;
    let attempt = 0;

    // Reset index if out of bounds (keys changed)
    if (currentKeyIndex >= keys.length) currentKeyIndex = 0;

    // Helper: Timeout wrapper
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
        ]);
    };

    while (attempt < maxRetries) {
        try {
            const key = keys[currentKeyIndex];
            console.log(`🔑 Using Gemini Key [${currentKeyIndex + 1}/${keys.length}]: ${key.slice(0, 4)}...`);

            const genAI = new GoogleGenerativeAI(key);

            // User requested "Gemini 2.5 Flash"
            // User requested "Gemini 2.5 Flash"
            const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.9, // Creative High to ensuring rewriting
                    topP: 0.95,
                    topK: 40,
                }
            });

            console.log("----------------------------------------------------------------");
            console.log("🚀 [AI DEBUG] Sending Prompt to", modelName);
            console.log("📝 [AI DEBUG] Prompt Preview:", prompt.substring(0, 500) + "\n...\n" + prompt.slice(-500));
            console.log("----------------------------------------------------------------");

            // Set timeout to 180s (3 minutes) for large context
            const result = await withTimeout(model.generateContent(prompt), 180000);
            const response = await result.response;
            const textResponse = response.text();

            console.log("----------------------------------------------------------------");
            console.log("📥 [AI DEBUG] Received Response Length:", textResponse.length);
            console.log("📄 [AI DEBUG] Response Preview:", textResponse.substring(0, 500) + "...");
            console.log("----------------------------------------------------------------");

            return textResponse;
        } catch (error: any) {
            console.error(`❌ AI Generation Error (Attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Check for quota/rate limit errors (429 usually) or Timeout
            if (error.message?.includes("429") || error.status === 429 || error.message?.includes("quota") || error.message?.includes("Timeout")) {
                console.warn("⚠️ Quota exceeded or Timeout. Switching key/Retrying...");
                currentKeyIndex = (currentKeyIndex + 1) % keys.length; // Rotate
                attempt++;
            } else {
                throw error;
            }
        }
    }

    throw new Error("All API keys exhausted or failed.");
};

// ==================== AUTO-CRAWL SPECIFIC FUNCTIONS ====================

class RateLimiter {
    private lastRequestTime = 0;
    private requestCount = 0;
    private readonly RATE_LIMIT_RPM = 10; // Free tier safe limit
    private readonly MIN_DELAY_MS = (60 / this.RATE_LIMIT_RPM) * 1000; // 6000ms

    async enforceRateLimit() {
        const now = Date.now();
        const elapsedSinceLastRequest = now - this.lastRequestTime;

        // Reset counter every minute
        if (elapsedSinceLastRequest > 60000) {
            this.requestCount = 0;
        }

        // If we've hit limit, wait
        if (this.requestCount >= this.RATE_LIMIT_RPM) {
            const waitTime = 60000 - elapsedSinceLastRequest;
            console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
            await this.delay(waitTime);
            this.requestCount = 0;
        }

        // Ensure minimum delay between requests
        if (elapsedSinceLastRequest < this.MIN_DELAY_MS) {
            const waitTime = this.MIN_DELAY_MS - elapsedSinceLastRequest;
            await this.delay(waitTime);
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            rpm: this.RATE_LIMIT_RPM,
            requestCount: this.requestCount,
            lastRequestTime: this.lastRequestTime
        };
    }
}

const rateLimiter = new RateLimiter();

/**
 * Tóm tắt 1 chapter bằng AI (3-Step Pipeline - Matches Manual Mode)
 */
export const summarizeChapter = async (
    chapterNumber: number,
    title: string,
    content: string
): Promise<string> => {
    // 1. Check Limits & Logs
    await rateLimiter.enforceRateLimit();
    console.log(`[AI-Service] Processing 3-Step Pipeline for: ${title}`);
    console.log(`[AI-Service] Input Content Length: ${content.length}`);
    console.log(`[AI-Service] Input Preview: ${content.substring(0, 200)}...`);

    if (content.length < 500) {
        console.warn(`[AI-Service] Content too short (${content.length}), AI might hallucinate.`);
    }

    try {
        // --- STEP 1: REWRITE CONTENT (The big one) ---
        // EXACT PROMPT FROM page.tsx
        const rewritePrompt = `Bạn là một tiểu thuyết gia. Hãy TÓM LƯỢC & VIẾT LẠI nội dung này thành một bài Review cuốn hút.

**⚠️ MỤC TIÊU QUAN TRỌNG:**
- **ĐỘ DÀI:** Chỉ giữ lại khoảng **40-50%** dung lượng so với bản gốc. CÔ ĐỌNG, không lan man.
- **BỎ QUA:** Các hội thoại rườm rà, chi tiết mô tả không cần thiết.
- **TẬP TRUNG:** Chỉ kể lại các sự kiện chính (Key Events) và cao trào.

**⚠️ TUÂN THỦ PHÁP LÝ:**
1. **KHÔNG COPY** nguyên văn bản gốc.
2. Viết lại 100% bằng giọng văn mới.
3. BẮT BUỘC mở đầu bằng: *"Đây là bài tóm tắt và cảm nhận nội dung, không thay thế tác phẩm gốc."*

**PHONG CÁCH VIẾT:**
- Nhịp điệu NHANH, lôi cuốn.
- Dùng từ ngữ gợi hình để thay thế cho các đoạn tả dài dòng.
- Kết thúc: Dừng lại ĐỘT NGỘT ngay tại hành động/câu thoại cao trào nhất.
- 🚫 **CẤM TUYỆT ĐỐI**: Không viết đoạn kết luận/nhận xét cuối bài.

Nội dung gốc:
${content.substring(0, 100000)}

Bắt đầu viết (Ngắn gọn, súc tích):`;

        console.log("👉 [Step 1/3] Generating Rewrite...");
        // Log Input for verification
        console.log("📝 [Step 1 Input Preview]:", content.substring(0, 500));

        const rewriteText = await generateText(rewritePrompt);

        // Log Output for verification
        console.log("📄 [Step 1 Output Preview]:", rewriteText.substring(0, 500));
        console.log(`✅ [Step 1/3] Rewrite Done. Length: ${rewriteText.length}`);

        // --- STEP 2: GENERATE SHORT SUMMARY ---
        // EXACT PROMPT FROM page.tsx
        const summaryPrompt = `Hãy viết một đoạn TÓM TẮT NGẮN (Short Summary) dưới góc độ PHÂN TÍCH/CẢM NHẬN cho nội dung sau:

${rewriteText.substring(0, 50000)}

Yêu cầu:
- Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
- Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
- TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
- Độ dài: 3-5 câu.`;

        console.log("👉 [Step 2/3] Generating Short Summary...");
        const shortSummary = await generateText(summaryPrompt);
        console.log(`✅ [Step 2/3] Summary Done.`);

        // --- STEP 3: GENERATE TITLE ---
        // EXACT PROMPT FROM page.tsx
        const titlePrompt = `Dựa vào nội dung tóm tắt sau, hãy tạo một TÊN CHƯƠNG ngắn gọn, súc tích (tối đa 5-8 từ).

Tóm tắt:
${shortSummary}

Yêu cầu:
- Tên chương phải GỢI TỚI nội dung chính của chương
- Ngắn gọn, dễ nhớ, hấp dẫn
- KHÔNG dùng số thứ tự (VD: "Chương 1", "Phần 1")
- KHÔNG dùng từ "Chương" trong tên
- Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa"

Chỉ trả về TÊN CHƯƠNG, không giải thích:`;

        console.log("👉 [Step 3/3] Generating Title...");
        const generatedTitle = (await generateText(titlePrompt)).replace(/^["']|["']$/g, '').trim();
        console.log(`✅ [Step 3/3] Title Done: ${generatedTitle}`);

        // --- COMBINE RESULTS INTO COMPATIBLE XML FOR CONTROLLER ---
        const finalOutput = `
<d_title>
${generatedTitle}
</d_title>

<d_summary>
${shortSummary}
</d_summary>

<d_content>
${rewriteText}
</d_content>
`;
        return finalOutput;

    } catch (error: any) {
        console.error("❌ Error in 3-Step AI Pipeline:", error);
        throw error;
    }
};

/**
 * Get rate limit stats
 */
export const getRateLimitStats = () => rateLimiter.getStats();
