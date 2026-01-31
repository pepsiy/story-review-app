"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateChapterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Form states
    const [rawInput, setRawInput] = useState("");
    const [chapterNumber, setChapterNumber] = useState("");
    const [sourceChapterRange, setSourceChapterRange] = useState("");
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [originalText, setOriginalText] = useState("");
    const [youtubeId, setYoutubeId] = useState("");

    // URL Extraction states
    const [extractUrl, setExtractUrl] = useState("");
    const [extracting, setExtracting] = useState(false);

    // Fetch work data to auto-suggest chapter number
    useEffect(() => {
        fetch(`http://localhost:3001/admin/works/${id}`)
            .then(res => res.json())
            .then(work => {
                if (work.chapters && work.chapters.length > 0) {
                    const maxChapterNumber = Math.max(...work.chapters.map((ch: any) => ch.chapterNumber || 0));
                    setChapterNumber((maxChapterNumber + 1).toString());
                }
            })
            .catch(err => console.error("Error fetching work:", err));
    }, [id]);

    // Clean HTML and unwanted content from raw text
    function cleanRawText(text: string): string {
        return text
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove common ad markers
            .replace(/ads-\w+/gi, '')
            // Trim
            .trim();
    }

    // Extract content from TruyenFull URL
    async function extractContentFromUrl() {
        if (!extractUrl.trim()) {
            alert("Vui lòng nhập URL truyenfull.vision!");
            return;
        }

        if (!extractUrl.includes("truyenfull.vision")) {
            alert("Chỉ hỗ trợ URL từ truyenfull.vision!");
            return;
        }

        setExtracting(true);
        try {
            // Use a CORS proxy or backend endpoint to fetch the page
            const response = await fetch(`http://localhost:3001/admin/extract-url`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: extractUrl }),
            });

            if (!response.ok) {
                throw new Error("Không thể tải nội dung từ URL");
            }

            const { content } = await response.json();

            // Append to existing rawInput
            setRawInput(prev => prev ? `${prev}\n\n---\n\n${content}` : content);
            setExtractUrl(""); // Clear URL input
            alert("✅ Đã trích xuất nội dung thành công!");
        } catch (error) {
            console.error(error);
            alert("❌ Lỗi khi trích xuất nội dung. Vui lòng thử lại!");
        } finally {
            setExtracting(false);
        }
    }

    async function handleAIGenerate() {
        if (!rawInput.trim()) {
            alert("Vui lòng nhập nội dung gốc trước!");
            return;
        }

        setAiLoading(true);
        try {
            // Clean the raw input before processing
            const cleanedText = cleanRawText(rawInput);

            if (!cleanedText) {
                alert("Nội dung sau khi xử lý trống rỗng!");
                setAiLoading(false);
                return;
            }

            // Call 1: Generate Summary (Review/Analysis Style)
            const summaryPrompt = `Hãy viết một đoạn TÓM TẮT NGẮN (Short Summary) dưới góc độ PHÂN TÍCH/CẢM NHẬN cho nội dung sau:

${cleanedText}

Yêu cầu:
- Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
- Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
- TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
- Độ dài: 3-5 câu.`;

            const summaryRes = await fetch("http://localhost:3001/admin/ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: summaryPrompt }),
            });
            const summaryData = await summaryRes.json();
            if (summaryData.text) {
                setSummary(summaryData.text);
            }

            // Call 2: Rewrite Content (Concise Storytelling)
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
${cleanedText}

Bắt đầu viết (Ngắn gọn, súc tích):`;

            const rewriteRes = await fetch("http://localhost:3001/admin/ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: rewritePrompt }),
            });
            const rewriteData = await rewriteRes.json();
            if (rewriteData.text) {
                setOriginalText(rewriteData.text);
            }

            // Call 3: Generate Chapter Title based on Summary
            const titlePrompt = `Dựa vào nội dung tóm tắt sau, hãy tạo một TÊN CHƯƠNG ngắn gọn, súc tích (tối đa 5-8 từ).

Tóm tắt:
${summaryData.text || cleanedText.substring(0, 500)}

Yêu cầu:
- Tên chương phải GỢI TỚI nội dung chính của chương
- Ngắn gọn, dễ nhớ, hấp dẫn
- KHÔNG dùng số thứ tự (VD: "Chương 1", "Phần 1")
- KHÔNG dùng từ "Chương" trong tên
- Ví dụ: "Hành Trình Bắt Đầu", "Thử Thách Đầu Tiên", "Định Mệnh Giao Thoa"

Chỉ trả về TÊN CHƯƠNG, không giải thích:`;

            const titleRes = await fetch("http://localhost:3001/admin/ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: titlePrompt }),
            });
            const titleData = await titleRes.json();
            if (titleData.text) {
                const cleanedTitle = titleData.text.replace(/^["']|["']$/g, '').trim();
                setTitle(cleanedTitle);
            }

            alert("✅ AI đã tạo nội dung thành công!");
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối AI Service");
        } finally {
            setAiLoading(false);
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);

        const payload = {
            workId: parseInt(id),
            chapterNumber: parseInt(chapterNumber),
            title,
            summary,
            youtubeId,
            sourceChapterRange: sourceChapterRange || null,
            originalText: originalText || "Placeholder content",
        };

        try {
            const res = await fetch("http://localhost:3001/admin/chapters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed");

            router.push(`/admin/works/${id}`);
            router.refresh();
        } catch (e) {
            alert("Error creating chapter");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
            <h1 className="text-2xl font-bold mb-6">Thêm Chương Mới</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                {/* URL Extraction Section */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <Label htmlFor="extractUrl" className="text-green-900 font-semibold">
                        🔗 Trích Xuất Tự Động từ TruyenFull
                    </Label>
                    <div className="flex gap-2 mt-2">
                        <Input
                            id="extractUrl"
                            placeholder="https://truyenfull.vision/truyen/..."
                            value={extractUrl}
                            onChange={(e) => setExtractUrl(e.target.value)}
                            className="flex-1 border-green-300"
                        />
                        <Button
                            type="button"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={extractContentFromUrl}
                            disabled={extracting}
                        >
                            {extracting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Đang trích xuất...
                                </>
                            ) : "Extract"}
                        </Button>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                        Nhập link chương, nhấn Extract để tự động lấy nội dung. Có thể extract nhiều lần liên tiếp.
                    </p>
                </div>

                {/* AI Raw Input Section */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <Label htmlFor="rawInput" className="text-indigo-900 font-semibold">
                        📝 Nội Dung Gốc / Raw Input
                    </Label>
                    <textarea
                        id="rawInput"
                        rows={6}
                        className="flex w-full rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm mt-2"
                        placeholder="Paste nội dung chương gốc vào đây..."
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                    />
                    <Button
                        type="button"
                        className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700"
                        onClick={handleAIGenerate}
                        disabled={aiLoading}
                    >
                        {aiLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                AI đang xử lý...
                            </>
                        ) : "🤖 AI Tạo Tóm Tắt & Viết Lại"}
                    </Button>
                    <p className="text-xs text-indigo-700 mt-2">
                        AI sẽ tự động tạo "Tóm Tắt Ngắn" và "Nội Dung Viết Lại" theo phong cách review
                    </p>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="grid gap-2 col-span-1">
                        <Label htmlFor="chapterNumber">Số Chương</Label>
                        <Input
                            type="number"
                            id="chapterNumber"
                            required
                            placeholder="1"
                            value={chapterNumber}
                            onChange={(e) => setChapterNumber(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2 col-span-3">
                        <Label htmlFor="title">Tên Chương</Label>
                        <Input
                            id="title"
                            required
                            placeholder="Tên chương..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="sourceChapterRange">Từ chương (gốc)</Label>
                    <Input
                        id="sourceChapterRange"
                        placeholder="VD: 1,5 (tóm tắt từ chương 1 đến 5 của bản gốc)"
                        value={sourceChapterRange}
                        onChange={(e) => setSourceChapterRange(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Nhập dạng: startChapter,endChapter. Để trống nếu không áp dụng.</p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="youtubeId">YouTube Video ID</Label>
                    <Input
                        id="youtubeId"
                        placeholder="Ví dụ: dQw4w9WgXcQ"
                        value={youtubeId}
                        onChange={(e) => setYoutubeId(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Lấy ID từ URL YouTube: youtube.com/watch?v=<b>IDsAuNay</b></p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="summary">Tóm Tắt Ngắn (AI tạo tự động)</Label>
                    <textarea
                        id="summary"
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="AI sẽ tự động điền tóm tắt vào đây..."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="originalText">Nội dung tóm tắt (Public - Hiển thị cho người đọc)</Label>
                    <textarea
                        id="originalText"
                        rows={8}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        placeholder="AI sẽ viết lại nội dung theo phong cách review/storytelling..."
                        value={originalText}
                        onChange={(e) => setOriginalText(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Nội dung này sẽ được public cho người đọc</p>
                </div>

                <div className="pt-4 flex gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-1/3"
                        onClick={() => router.back()}
                    >
                        Hủy
                    </Button>
                    <Button type="submit" disabled={loading} className="w-2/3">
                        {loading ? "Đang tạo..." : "Tạo Chương"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
