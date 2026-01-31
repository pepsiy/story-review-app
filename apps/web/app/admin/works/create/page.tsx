"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateWorkPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [slug, setSlug] = useState("");

    const generateSlug = (text: string) => {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, "-")
            .trim();
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSlug = generateSlug(e.target.value);
        setSlug(newSlug);
    };

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        const formData = new FormData(event.currentTarget);

        const payload = {
            title: formData.get("title"),
            slug: formData.get("slug"),
            author: formData.get("author"),
            coverImage: formData.get("coverImage"),
            genre: formData.get("genre"),
            description: formData.get("description"),
            isHot: formData.get("isHot") === "on",
            status: formData.get("status"),
        };

        try {
            const res = await fetch("http://localhost:3001/admin/works", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    throw new Error("Slug (URL) đã tồn tại. Vui lòng đổi tiêu đề hoặc slug.");
                }
                throw new Error(data.error || "Có lỗi xảy ra khi tạo truyện.");
            }

            router.push("/admin");
            router.refresh();
        } catch (e: any) {
            alert(`❌ Lỗi: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
            <h1 className="text-2xl font-bold mb-6">Thêm Truyện Mới</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="title">Tên Truyện</Label>
                    <Input
                        name="title"
                        id="title"
                        required
                        placeholder="Ví dụ: Đấu Phá Thương Khung"
                        onChange={handleTitleChange}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="slug">Slug (URL)</Label>
                        <Input
                            name="slug"
                            id="slug"
                            required
                            placeholder="dau-pha-thuong-khung"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="author">Tác Giả</Label>
                        <Input name="author" id="author" placeholder="Thiên Tàm Thổ Đậu" />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="coverImage">Link Ảnh Bìa</Label>
                    <Input name="coverImage" id="coverImage" placeholder="https://..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="genre">Thể Loại</Label>
                        <Input name="genre" id="genre" placeholder="Tiên Hiệp, Huyễn Huyễn" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">Trạng Thái</Label>
                        <select name="status" id="status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="ONGOING">Đang ra</option>
                            <option value="COMPLETED">Hoàn thành</option>
                            <option value="DROPPED">Ngừng</option>
                        </select>
                    </div>
                </div>

                <div className="grid gap-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="description">Giới Thiệu Ngắn</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100"
                            onClick={async () => {
                                const title = (document.getElementById("title") as HTMLInputElement).value;
                                if (!title) return alert("Vui lòng nhập tên truyện trước!");

                                const btn = document.activeElement as HTMLButtonElement;
                                const originalText = btn.innerText;
                                btn.innerText = "Generating...";
                                btn.disabled = true;

                                try {
                                    const res = await fetch("http://localhost:3001/admin/ai/generate", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            prompt: `Viết một đoạn giới thiệu hấp dẫn (khoảng 3-4 câu) cho truyện: ${title}. Thể loại: Tiên hiệp/Huyền ảo.`
                                        }),
                                    });
                                    const data = await res.json();
                                    if (data.text) {
                                        setSlug(curr => curr); // Trigger re-render if needed, but not strictly required
                                        (document.getElementById("description") as HTMLTextAreaElement).value = data.text;
                                    } else {
                                        alert("Lỗi AI: " + (data.error || "Unknown"));
                                    }
                                } catch (e) { console.error(e); alert("Lỗi kết nối AI Service"); }
                                finally {
                                    btn.innerText = originalText;
                                    btn.disabled = false;
                                }
                            }}
                        >
                            ✨ AI Generate
                        </Button>
                    </div>
                    <textarea
                        name="description"
                        id="description"
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Giới thiệu tóm tắt về truyện..."
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input type="checkbox" name="isHot" id="isHot" className="h-4 w-4" />
                    <Label htmlFor="isHot">Đánh dấu là Truyện HOT 🔥</Label>
                </div>

                <div className="pt-4">
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading ? "Đang tạo..." : "Tạo Truyện"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
