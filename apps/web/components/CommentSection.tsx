"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
// import { useSession } from "next-auth/react"; // If using SessionProvider. But we might not have it wrapped yet?
// We can use a prop `user` passed from server, or use `UserNav` approach. 
// BUT for simpler client side auth check without provider, we can check a client-side session fetch or just let API fail.
// Better: Pass `user` (session.user) from Server Component (Page).

type Comment = {
    id: number;
    content: string;
    createdAt: string;
    user: {
        name: string | null;
        image: string | null;
    } | null;
};

export function CommentSection({ chapterId, user }: { chapterId: number, user?: any }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchComments = async () => {
        try {
            const res = await fetch(`/api/comments?chapterId=${chapterId}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [chapterId]);

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chapterId, content }),
            });
            if (res.ok) {
                setContent("");
                fetchComments(); // Reload
            } else {
                alert("Vui lòng đăng nhập để bình luận!");
            }
        } catch (e) {
            alert("Lỗi kết nối!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-100 max-w-4xl mx-auto mt-12">
            <h3 className="text-xl font-bold text-slate-900 mb-6">💬 Bình Luận ({comments.length})</h3>

            {/* Input Form */}
            {user ? (
                <div className="flex gap-4 mb-8">
                    {user.image ? (
                        <Image src={user.image} alt={user.name} width={40} height={40} className="w-10 h-10 rounded-full border" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                    )}
                    <div className="flex-1">
                        <textarea
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                            placeholder="Chia sẻ cảm nghĩ của bạn..."
                            rows={3}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <div className="text-right mt-2">
                            <Button onClick={handleSubmit} disabled={loading || !content.trim()}>
                                {loading ? "Đang gửi..." : "Gửi bình luận"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-4 rounded-lg text-center mb-8 border border-slate-200 border-dashed">
                    <p className="text-slate-600 mb-2">Đăng nhập để tham gia bình luận cùng cộng đồng.</p>
                    {/* The Login button above in Header handles login. Detailed inline login button strictly needs client interaction logic or redirect. */}
                    <p className="text-sm text-slate-500">(Sử dụng nút Login ở góc trên phải màn hình)</p>
                </div>
            )}

            {/* List */}
            <div className="space-y-6">
                {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4">
                        <div className="flex-shrink-0">
                            {comment.user?.image ? (
                                <Image src={comment.user.image} alt={comment.user.name || "User"} width={40} height={40} className="w-10 h-10 rounded-full border" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                                    {comment.user?.name?.[0] || "?"}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h4 className="font-semibold text-slate-900 text-sm">{comment.user?.name || "Người dùng ẩn danh"}</h4>
                                <span className="text-xs text-slate-400">
                                    {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                            <p className="text-slate-700 mt-1 text-sm leading-relaxed">{comment.content}</p>
                        </div>
                    </div>
                ))}
                {comments.length === 0 && (
                    <p className="text-center text-slate-400 italic">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                )}
            </div>
        </div>
    );
}
