"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

type WorkComment = {
    id: number;
    content: string;
    createdAt: string | null;
    chapterId: number | null;
    workId: number | null;
    chapterNumber: number | null;
    user: {
        name: string | null;
        image: string | null;
    } | null;
};

export function WorkCommentSection({
    workId,
    workSlug,
    user,
}: {
    workId: number;
    workSlug: string;
    user?: any;
}) {
    const [comments, setComments] = useState<WorkComment[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const fetchComments = async () => {
        setFetching(true);
        try {
            const res = await fetch(`/api/work-comments?workId=${workId}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [workId]);

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/work-comments?workId=${workId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (res.ok) {
                setContent("");
                fetchComments();
            } else {
                alert("Vui lòng đăng nhập để bình luận!");
            }
        } catch {
            alert("Lỗi kết nối!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-5 rounded-lg shadow-sm" id="binh-luan">
            <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b flex items-center gap-2">
                💬 Bình Luận
                <span className="text-sm font-normal text-slate-400">({comments.length})</span>
            </h2>

            {/* Input */}
            {user ? (
                <div className="flex gap-3 mb-6">
                    <div className="flex-shrink-0">
                        {user.image ? (
                            <Image
                                src={user.image}
                                alt={user.name || ""}
                                width={36}
                                height={36}
                                className="w-9 h-9 rounded-full border"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                                {user.name?.[0] || "U"}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <textarea
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm resize-none"
                            placeholder="Chia sẻ cảm nhận của bạn về bộ truyện này..."
                            rows={3}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) handleSubmit();
                            }}
                        />
                        <div className="text-right mt-2 flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-400">Ctrl+Enter để gửi</span>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={loading || !content.trim()}
                            >
                                {loading ? "Đang gửi..." : "Gửi"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-4 rounded-lg text-center mb-6 border border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">
                        Đăng nhập để tham gia bình luận cùng cộng đồng.
                    </p>
                </div>
            )}

            {/* Comment List */}
            {fetching ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-slate-200 rounded w-1/4" />
                                <div className="h-3 bg-slate-100 rounded w-3/4" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-5">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                            <div className="flex-shrink-0">
                                {comment.user?.image ? (
                                    <Image
                                        src={comment.user.image}
                                        alt={comment.user.name || "User"}
                                        width={36}
                                        height={36}
                                        className="w-9 h-9 rounded-full border"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">
                                        {comment.user?.name?.[0] || "?"}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="font-semibold text-slate-900 text-sm">
                                        {comment.user?.name || "Ẩn danh"}
                                    </span>
                                    {/* Chapter badge for chapter comments */}
                                    {comment.chapterNumber !== null && (
                                        <Link
                                            href={`/truyen/${workSlug}/${comment.chapterNumber}#binh-luan`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                        >
                                            📖 Chương {comment.chapterNumber}
                                        </Link>
                                    )}
                                    <span className="text-xs text-slate-400 ml-auto">
                                        {comment.createdAt
                                            ? new Date(comment.createdAt).toLocaleDateString("vi-VN", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })
                                            : ""}
                                    </span>
                                </div>
                                <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))}
                    {comments.length === 0 && (
                        <p className="text-center text-slate-400 italic py-6">
                            Chưa có bình luận nào. Hãy là người đầu tiên! 🎉
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
