import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';

// Try to load .env from current directory
if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
    console.log("Loaded .env from current directory");
} else if (fs.existsSync('../../.env')) {
    dotenv.config({ path: '../../.env' });
    console.log("Loaded .env from root directory");
} else {
    console.warn("⚠️ No .env file found!");
}

const CHAPTER_URLS = [
    "https://truyenfull.vision/truyen-dau-pha-thuong-khung/chuong-1/",
    "https://truyenfull.vision/truyen-dau-pha-thuong-khung/chuong-2/",
    "https://truyenfull.vision/truyen-dau-pha-thuong-khung/chuong-3/",
    "https://truyenfull.vision/truyen-dau-pha-thuong-khung/chuong-4/",
    "https://truyenfull.vision/truyen-dau-pha-thuong-khung/chuong-5/"
];

async function crawlChapterContent(url: string) {
    console.log(`Crawling ${url}...`);
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(data);
    let content = $('#chapter-c').text().replace(/\s+/g, ' ').trim();
    if (!content) content = $('.chapter-content').text().trim();
    return content;
}

async function runDebug() {
    try {
        // 1. Crawl Content
        console.log("--- 1. CRAWLING CONTENT (Simulation) ---");
        const contents = [];
        for (const url of CHAPTER_URLS) {
            try {
                const c = await crawlChapterContent(url);
                contents.push(c);
                await new Promise(r => setTimeout(r, 1000));
            } catch (e: any) {
                console.error(`Failed to crawl ${url}:`, e.message);
            }
        }

        const combinedContent = contents.map((c, i) => `### Chương ${i + 1}:\n\n${c}`).join('\n\n---\n\n');
        console.log(`Total Content Length: ${combinedContent.length} chars`);

        // 2. Prepare Prompt (Exact Match with aiService.ts)
        console.log("--- 2. PREPARING PROMPT ---");
        const title = "Đấu Phá Thương Khung (Chương 1-5)";

        const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng. Nhiệm vụ của bạn là thực hiện 3 yêu cầu xử lý văn bản chuyên sâu cho nội dung bên dưới (được gộp từ ${title}).

---
🛑 **QUY TẮC CHUNG "BẤT KHẢ XÂM PHẠM"**:
1. **KHÔNG ĐƯỢC COPY** nguyên văn bản gốc.
2. **SÁNG TẠO**: Phải viết lại bằng giọng văn hoàn toàn mới, sắc sảo và lôi cuốn hơn.
3. **ĐỊNH DẠNG**: Trả về đúng 3 phần, ngăn cách bởi dấu "|||".
4. **CẤM**: Không được tự ý thêm các nhãn như "PHẦN 1:", "TÊN CHƯƠNG:", "TÓM TẮT:". Chỉ trả về nội dung của từng phần.

---
📝 **Nội Dung Gốc**:
${combinedContent.substring(0, 100000)}

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

        console.log("\nPROMPT PREVIEW (First 500 chars):");
        console.log(prompt.substring(0, 500));
        console.log("...\nPROMPT END (Last 500 chars):");
        console.log(prompt.substring(prompt.length - 500));

        // 3. Call AI
        console.log("\n--- 3. CALLING AI ---");
        // Try multiple env vars
        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS || "YOUR_KEY_HERE";

        if (apiKey === "YOUR_KEY_HERE" || !apiKey) {
            console.error("❌ Missing GEMINI_API_KEY / GEMINI_API_KEYS in .env");
            return;
        }

        const validKey = apiKey.split(',')[0].trim(); // Take first key if comma separated
        console.log(`Using Key: ${validKey.slice(0, 4)}...`);

        const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // Or 1.5-flash
        console.log(`Using Model: ${modelName}`);

        const genAI = new GoogleGenerativeAI(validKey);
        const model = genAI.getGenerativeModel({
            model: modelName, // Revert to known model if 2.5 fails, or try both
            generationConfig: { temperature: 0.9, topP: 0.95, topK: 40 }
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        console.log("\n--- 4. AI RESPONSE ---");
        console.log(responseText);

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

runDebug();
