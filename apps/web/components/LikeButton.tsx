"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LikeButton({ workId }: { workId: number }) {
    const [liked, setLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetch(`/api/works/${workId}/favorite`)
            .then(res => res.json())
            .then(data => {
                setLiked(data.favorited);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [workId]);

    const toggleLike = async () => {
        // Optimistic update
        setLiked(!liked);

        try {
            const res = await fetch(`/api/works/${workId}/favorite`, { method: "POST" });
            if (res.status === 401) {
                // Redirect if not logged in (or show toast)
                alert("Vui lòng đăng nhập để thích truyện!");
                setLiked(false); // Revert
                return;
            }

            const data = await res.json();
            setLiked(data.favorited);
            router.refresh(); // Refresh to update counts if any
        } catch (error) {
            setLiked(!liked); // Revert on error
            console.error(error);
        }
    };

    if (loading) return <Button variant="outline" disabled className="w-full">...</Button>;

    return (
        <Button
            onClick={toggleLike}
            variant={liked ? "secondary" : "outline"}
            className={`w-full gap-2 transition-all ${liked ? 'bg-pink-100 text-pink-600 border-pink-200 hover:bg-pink-200' : 'text-slate-600'}`}
        >
            {liked ? "❤️ Đã thích" : "🤍 Yêu thích"}
        </Button>
    );
}
