"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Form States
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [author, setAuthor] = useState("");
    const [coverImage, setCoverImage] = useState("");
    const [genre, setGenre] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("ONGOING");
    const [isHot, setIsHot] = useState(false);

    // Fetch existing data
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        fetch(`${API_URL}/admin/works/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => {
                setTitle(data.title);
                setSlug(data.slug);
                setAuthor(data.author || "");
                setCoverImage(data.coverImage || "");
                setGenre(data.genre || "");
                setDescription(data.description || "");
                setStatus(data.status || "ONGOING");
                setIsHot(data.isHot || false);
            })
            .catch(err => {
                console.error(err);
                alert("Không tìm thấy truyện!");
                router.push("/admin");
            })
            .finally(() => setInitialLoading(false));
    }, [id, router]);

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
        const val = e.target.value;
        setTitle(val);
        // Only auto-update slug if it matches the generated version of the *old* title (simple heuristic)
        // Or simplified: Just don't auto-update slug on Edit to preserve SEO, unless user manually clears it.
    };

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);

        const payload = {
            title,
            slug,
            author,
            coverImage,
            genre,
            description,
            isHot,
            status,
        };

        try {
            const res = await fetch(`${API_URL}/admin/works/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    throw new Error("Slug (URL) đã tồn tại. Vui lòng đổi slug khác.");
                }
                throw new Error(data.error || "Có lỗi xảy ra khi cập nhật.");
            }

            router.push("/admin");
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
            <h1 className="text-2xl font-bold mb-6">Sửa Truyện: {title}</h1>
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="title">Tên Truyện</Label>
                    <Input
                        name="title"
                        id="title"
                        required
                        value={title}
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
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="author">Tác Giả</Label>
                        <Input
                            name="author"
                            id="author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="coverImage">Link Ảnh Bìa</Label>
                    <Input
                        name="coverImage"
                        id="coverImage"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="genre">Thể Loại</Label>
                        <Input
                            name="genre"
                            id="genre"
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">Trạng Thái</Label>
                        <select
                            name="status"
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
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
                                        setDescription(data.text);
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
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        name="isHot"
                        id="isHot"
                        className="h-4 w-4"
                        checked={isHot}
                        onChange={(e) => setIsHot(e.target.checked)}
                    />
                    <Label htmlFor="isHot">Đánh dấu là Truyện HOT 🔥</Label>
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
