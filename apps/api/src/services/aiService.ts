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

    const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng. Nhiệm vụ của bạn là xử lý nội dung văn bản gốc (được gộp từ ${title}) và trả về kết quả JSON gồm 3 phần: Tiêu đề, Tóm tắt ngắn, và Nội dung viết lại. Áp dụng chính xác các quy tắc sau:

---
PHẦN 1: NỘI DUNG VIẾT LẠI (Key: "content")
Hãy TÓM LƯỢC & VIẾT LẠI nội dung gốc thành một bài Review cuốn hút.

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

---
PHẦN 2: TÓM TẮT NGẮN (Key: "short_summary")
Hãy viết một đoạn TÓM TẮT NGẮN dưới góc độ PHÂN TÍCH/CẢM NHẬN (3-5 câu).
- Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
- Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
- TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."

---
PHẦN 3: TIÊU ĐỀ (Key: "title")
Đặt một TÊN CHƯƠNG ngắn gọn, súc tích (tối đa 5-8 từ).
- Tên chương phải GỢI TỚI nội dung chính.
- KHÔNG dùng số thứ tự (VD: "Chương 1", "Phần 1").
- KHÔNG dùng từ "Chương".
- Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa".

---
Đầu vào:
Nguồn: ${title}
Nội dung gốc:
${content.substring(0, 15000)}

YÊU CẦU ĐẦU RA:
Hãy trả về kết quả dưới dạng **JSON Valid** (không kèm markdown \`\`\`json) với cấu trúc sau:
{
  "title": "Tiêu đề bạn đặt",
  "short_summary": "Tóm tắt ngắn...",
  "content": "Nội dung viết lại..."
}`;

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
