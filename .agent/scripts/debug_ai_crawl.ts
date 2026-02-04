
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';
import axios from 'axios';

dotenv.config({ path: '../../.env' }); // Adjust path if needed

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
        console.log("--- 1. CRAWLING CONTENT ---");
        const contents = [];
        for (const url of CHAPTER_URLS) {
            const c = await crawlChapterContent(url);
            contents.push(c);
            await new Promise(r => setTimeout(r, 1000));
        }

        const combinedContent = contents.map((c, i) => `### Chương ${i + 1}:\n\n${c}`).join('\n\n---\n\n');
        console.log(`Total Content Length: ${combinedContent.length} chars`);

        // 2. Prepare Prompt (Single Mega Prompt)
        console.log("--- 2. PREPARING PROMPT ---");
        const title = "Đấu Phá Thương Khung (Chương 1-5)";

        const prompt = `Bạn là một tiểu thuyết gia và biên tập viên tài năng. Nhiệm vụ của bạn là thực hiện 3 yêu cầu xử lý văn bản chuyên sâu cho nội dung bên dưới (được gộp từ ${title}).

---
🛑 **QUY TẮC CHUNG "BẤT KHẢ XÂM PHẠM"**:
1. **KHÔNG ĐƯỢC COPY** nguyên văn bản gốc.
2. **SÁNG TẠO**: Phải viết lại bằng giọng văn hoàn toàn mới, sắc sảo và lôi cuốn hơn.
3. **ĐỊNH DẠNG**: Trả về đúng 3 phần, ngăn cách bởi dấu "|||".

---
📝 **Nội Dung Gốc**:
${combinedContent.substring(0, 100000)}

---
⚠️ **YÊU CẦU ĐẦU RA CHI TIẾT** (Phải tuân thủ tuyệt đối từng mục):

**PHẦN 1: TÊN CHƯƠNG MỚI**
- Dựa vào nội dung tóm tắt, hãy tạo một TÊN CHƯƠNG ngắn gọn, súc tích (tối đa 5-8 từ).
- Yêu cầu:
    - Tên chương phải GỢI TỚI nội dung chính của chương
    - Ngắn gọn, dễ nhớ, hấp dẫn
    - KHÔNG dùng số thứ tự (VD: "Chương 1", "Phần 1")
    - KHÔNG dùng từ "Chương" trong tên
    - Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa"

|||

**PHẦN 2: TÓM TẮT NGẮN (SHORT SUMMARY)**
- Hãy viết một đoạn TÓM TẮT NGẮN (Short Summary) dưới góc độ PHÂN TÍCH/CẢM NHẬN.
- Yêu cầu:
    - Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
    - Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
    - TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
    - Độ dài: 3-5 câu.

|||

**PHẦN 3: NỘI DUNG VIẾT LẠI (REWRITE CONTENT)**
- Bạn là một tiểu thuyết gia. Hãy TÓM LƯỢC & VIẾT LẠI nội dung này thành một bài Review cuốn hút.
- **MỤC TIÊU QUAN TRỌNG:**
    - **ĐỘ DÀI:** Chỉ giữ lại khoảng **40-50%** dung lượng so với bản gốc. CÔ ĐỌNG, không lan man.
    - **BỎ QUA:** Các hội thoại rườm rà, chi tiết mô tả không cần thiết.
    - **TẬP TRUNG:** Chỉ kể lại các sự kiện chính (Key Events) và cao trào.
- **TUÂN THỦ PHÁP LÝ:**
    1. **KHÔNG COPY** nguyên văn bản gốc.
    2. Viết lại 100% bằng giọng văn mới.
    3. BẮT BUỘC mở đầu bằng: *"Đây là bài tóm tắt và cảm nhận nội dung, không thay thế tác phẩm gốc."*
- **PHONG CÁCH VIẾT:**
    - Nhịp điệu NHANH, lôi cuốn.
    - Dùng từ ngữ gợi hình để thay thế cho các đoạn tả dài dòng.
    - Kết thúc: Dừng lại ĐỘT NGỘT ngay tại hành động/câu thoại cao trào nhất.
    - 🚫 **CẤM TUYỆT ĐỐI**: Không viết đoạn kết luận/nhận xét cuối bài.

👇 **XỬ LÝ VÀ TRẢ VỀ KẾT QUẢ NGAY BÊN DƯỚI**:`;

        console.log("\nPROMPT PREVIEW (First 500 chars):");
        console.log(prompt.substring(0, 500));
        console.log("...\nPROMPT END (Last 500 chars):");
        console.log(prompt.substring(prompt.length - 500));

        // 3. Call AI
        console.log("\n--- 3. CALLING AI ---");
        const apiKey = process.env.GEMINI_API_KEY || "YOUR_KEY_HERE";
        if (apiKey === "YOUR_KEY_HERE") {
            console.error("❌ Missing GEMINI_API_KEY in .env");
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { temperature: 0.9, topP: 0.95, topK: 40 }
        }); // Trying newer model? Or assume 1.5

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        console.log("\n--- 4. AI RESPONSE ---");
        console.log(responseText);

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

runDebug();
