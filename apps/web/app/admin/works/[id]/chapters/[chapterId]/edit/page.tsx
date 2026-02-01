"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id, chapterId } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);

    // Form States
    const [rawInput, setRawInput] = useState("");
    const [chapterNumber, setChapterNumber] = useState("");
    const [sourceChapterRange, setSourceChapterRange] = useState("");
    const [title, setTitle] = useState("");
    const [originalText, setOriginalText] = useState("");
    const [summary, setSummary] = useState("");
    const [youtubeId, setYoutubeId] = useState("");
    const [status, setStatus] = useState("DRAFT");

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Fetch existing chapter data
    useEffect(() => {
        fetch(`${API_URL}/admin/works/${id}`)
            .then(res => res.json())
            .then(work => {
                const chapter = work.chapters?.find((ch: any) => ch.id === parseInt(chapterId));
                if (!chapter) throw new Error("Chapter not found");

                setChapterNumber(chapter.chapterNumber?.toString() || "");
                setSourceChapterRange(chapter.sourceChapterRange || "");
                setTitle(chapter.title || "");
                setOriginalText(chapter.originalText || "");
                setSummary(chapter.summary || "");
                setYoutubeId(chapter.youtubeId || "");
                setStatus(chapter.status || "DRAFT");
            })
            .catch(err => {
                console.error(err);
                alert("Không tìm thấy chương!");
                router.push(`/admin/works/${id}`);
            })
            .finally(() => setInitialLoading(false));
    }, [id, chapterId, router]);

    async function handleAIGenerate() {
        const contentToProcess = rawInput.trim() || originalText.trim();

        if (!contentToProcess) {
            alert("Vui lòng nhập nội dung vào khung 'Raw Input' hoặc 'Nội Dung Gốc' trước!");
            return;
        }

        setAiLoading(true);
        try {
            // Clean HTML if from raw input
            const cleanedText = rawInput.trim()
                ? contentToProcess
                    .replace(/<[^>]*>/g, '')
                    .replace(/\s+/g, ' ')
                    .replace(/ads-\w+/gi, '')
                    .trim()
                : contentToProcess;

            if (!cleanedText) {
                alert("Nội dung sau khi xử lý trống rỗng!");
                setAiLoading(false);
                return;
            }

            // If raw input provided, rewrite it and update originalText
            if (rawInput.trim()) {
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

                const rewriteRes = await fetch(`${API_URL}/admin/ai/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: rewritePrompt }),
                });
                const rewriteData = await rewriteRes.json();
                if (rewriteData.text) {
                    setOriginalText(rewriteData.text);
                }
            }

            // Generate Summary
            const summaryPrompt = `Hãy viết một đoạn TÓM TẮT NGẮN (Short Summary) dưới góc độ PHÂN TÍCH/CẢM NHẬN cho nội dung sau:

${cleanedText}

Yêu cầu:
- Tập trung vào ý nghĩa, cảm xúc nhân vật, và nghệ thuật kể chuyện.
- Bắt đầu bằng những câu như: "Chương truyện khắc họa...", "Bi kịch của nhân vật bắt đầu...", "Tác giả khéo léo lồng ghép..."
- TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Chương truyện giới thiệu...", "Chương này nói về..."
- Độ dài: 3-5 câu.`;

            const summaryRes = await fetch(`${API_URL}/admin/ai/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: summaryPrompt }),
            });
            const summaryData = await summaryRes.json();
            if (summaryData.text) {
                setSummary(summaryData.text);
            }

            // Generate Chapter Title if empty
            if (!title || title.trim() === "") {
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

                const titleRes = await fetch(`${API_URL}/admin/ai/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: titlePrompt }),
                });
                const titleData = await titleRes.json();
                if (titleData.text) {
                    const cleanedTitle = titleData.text.replace(/^["']|["']$/g, '').trim();
                    setTitle(cleanedTitle);
                }
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
            chapterNumber: parseInt(chapterNumber),
            title,
            originalText,
            summary,
            youtubeId,
            sourceChapterRange: sourceChapterRange || null,
            status,
        };

        try {
            const res = await fetch(`${API_URL}/admin/chapters/${chapterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Có lỗi xảy ra khi cập nhật chương.");
            }

            router.push(`/admin/works/${id}`);
            router.refresh();
        } catch (e: any) {
            alert(`❌ Lỗi: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    if (initialLoading) return <div className="p-8">Đang tải dữ liệu...</div>;

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
            <h1 className="text-2xl font-bold mb-6">Sửa Chương #{chapterNumber}</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                {/* AI Raw Input Section */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <Label htmlFor="rawInput" className="text-indigo-900 font-semibold">
                        📝 Nhập Nội Dung Mới (Tùy Chọn)
                    </Label>
                    <textarea
                        id="rawInput"
                        rows={6}
                        className="flex w-full rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm mt-2"
                        placeholder="Paste nội dung chương mới vào đây nếu muốn AI viết lại..."
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
                        Nếu để trống, AI sẽ tạo tóm tắt từ nội dung hiện tại bên dưới
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="chapterNumber">Số Chương</Label>
                        <Input
                            name="chapterNumber"
                            id="chapterNumber"
                            type="number"
                            required
                            value={chapterNumber}
                            onChange={(e) => setChapterNumber(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">Trạng Thái</Label>
                        <select
                            name="status"
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="DRAFT">Nháp</option>
                            <option value="PUBLISHED">Đã xuất bản</option>
                        </select>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="title">Tiêu Đề Chương</Label>
                    <Input
                        name="title"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="sourceChapterRange">Từ chương (gốc)</Label>
                    <Input
                        name="sourceChapterRange"
                        id="sourceChapterRange"
                        placeholder="VD: 1,5 (tóm tắt từ chương 1 đến 5 của bản gốc)"
                        value={sourceChapterRange}
                        onChange={(e) => setSourceChapterRange(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Nhập dạng: startChapter,endChapter. Để trống nếu không áp dụng.</p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="youtubeId">YouTube Video ID (Tùy chọn)</Label>
                    <Input
                        name="youtubeId"
                        id="youtubeId"
                        placeholder="dQw4w9WgXcQ"
                        value={youtubeId}
                        onChange={(e) => setYoutubeId(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Nếu có video review trên YouTube, nhập ID của video</p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="summary">Tóm Tắt Ngắn</Label>
                    <textarea
                        name="summary"
                        id="summary"
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Tóm tắt nội dung chính của chương..."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="originalText">Nội dung tóm tắt (Public - Hiển thị cho người đọc)</Label>
                    <textarea
                        name="originalText"
                        id="originalText"
                        rows={8}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        placeholder="Nội dung review/tóm tắt (sẽ hiển thị công khai cho người đọc)..."
                        value={originalText}
                        onChange={(e) => setOriginalText(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Nội dung này sẽ được public cho người đọc</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                        onClick={handleAIGenerate}
                        disabled={aiLoading}
                    >
                        {aiLoading ? "⏳ AI đang tạo..." : "🤖 AI Tạo Tóm Tắt từ Nội Dung"}
                    </Button>
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
                        {loading ? "Đang lưu..." : "Lưu Thay Đổi"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
