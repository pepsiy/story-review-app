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
    console.log(`[AI-Service] Processing Single-Prompt Pipe-Delimited for: ${title}`);
    console.log(`[AI-Service] Input Content Length: ${content.length}`);
    console.log(`[AI-Service] Input Preview: ${content.substring(0, 200)}...`);

    if (content.length < 500) {
        console.warn(`[AI-Service] Content too short (${content.length}), AI might hallucinate.`);
    }

    try {
        const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng. Nhiệm vụ của bạn là LÀM MỚI (REWRITE) nội dung văn bản gốc bên dưới (được gộp từ ${title}) để tạo ra một bản tóm tắt chương hấp dẫn.

---
🛑 **QUY TẮC BẤT KHẢ XÂM PHẠM**:
1. **KHÔNG ĐƯỢC COPY** nguyên văn bản gốc. Phải viết lại 100% bằng giọng văn kể chuyện (Storytelling) lôi cuốn, dồn dập.
2. **CÔ ĐỌNG**: Lược bỏ hội thoại rườm rà, tập trung vào hành động cốt lõi.
3. **ĐỊNH DẠNG**: Trả về 3 phần riêng biệt, ngăn cách nhau bằng dấu "|||".

---
📝 **Nội Dung Gốc**:
${content.substring(0, 100000)}

---
⚠️ **YÊU CẦU ĐẦU RA** (Trả về chính xác theo định dạng bên dưới, không thêm lời dẫn):

[TÊN CHƯƠNG (Ngắn gọn 5-8 từ, không có số thứ tự)]
|||
[TÓM TẮT NGẮN (3-5 câu cảm nhận/phân tích súc tích)]
|||
[NỘI DUNG VIẾT LẠI (Chi tiết, hấp dẫn, tập trung hành động)]

👇 **BẮT ĐẦU**:`;

        console.log("👉 [AI-Service] Generating Pipe-Delimited Output...");
        // Log Input for verification
        console.log("📝 [Input Preview]:", content.substring(0, 500));

        const result = await generateText(prompt);

        // Log Output for verification
        console.log("📄 [Output Preview]:", result.substring(0, 500));
        console.log(`✅ [AI-Service] Done. Length: ${result.length}`);

        return result.trim();

    } catch (error: any) {
        console.error("❌ Error in AI Pipeline:", error);
        throw error;
    }
};

/**
 * Get rate limit stats
 */
export const getRateLimitStats = () => rateLimiter.getStats();
