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

    while (attempt < maxRetries) {
        try {
            const key = keys[currentKeyIndex];
            console.log(`🔑 Using Gemini Key [${currentKeyIndex + 1}/${keys.length}]: ${key.slice(0, 4)}...`);

            const genAI = new GoogleGenerativeAI(key);

            // User requested "Gemini 2.5 Flash"
            const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error(`❌ AI Generation Error (Attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Check for quota/rate limit errors (429 usually)
            if (error.message?.includes("429") || error.status === 429 || error.message?.includes("quota")) {
                console.warn("⚠️ Quota exceeded for current key. Switching key...");
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
 * Tóm tắt 1 chapter bằng AI (with rate limiting)
 */
export const summarizeChapter = async (
    chapterNumber: number,
    title: string,
    content: string
): Promise<string> => {
    // Rate limiting
    await rateLimiter.enforceRateLimit();

    const prompt = `Bạn là một chuyên gia tóm tắt tiểu thuyết. Hãy tóm tắt nội dung chương sau đây một cách súc tích nhưng đầy đủ ý chính (tối đa 300 từ):

Chương ${chapterNumber}: ${title}

Nội dung:
${content.substring(0, 8000)} 

Yêu cầu:
- Tóm tắt theo thứ tự diễn biến sự kiện
- Nêu rõ nhân vật chính và hành động của họ
- Giữ nguyên tên riêng, thuật ngữ đặc biệt
- Ngôn ngữ tự nhiên, dễ hiểu
- Không thêm ý kiến cá nhân hoặc phán xét

Tóm tắt:`;

    try {
        const summary = await generateText(prompt);
        console.log(`✅ AI summarized chapter ${chapterNumber}`);
        return summary.trim();
    } catch (error: any) {
        console.error(`❌ AI summarization failed for chapter ${chapterNumber}:`, error.message);
        throw new Error(`AI summarization failed: ${error.message}`);
    }
};

/**
 * Get rate limit stats
 */
export const getRateLimitStats = () => rateLimiter.getStats();
