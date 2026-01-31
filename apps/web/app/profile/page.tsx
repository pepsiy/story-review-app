"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface UserProfile {
    id: string;
    name: string;
    email: string;
    image: string;
    bio: string;
    stats: {
        following: number;
        followers: number;
        likes: number;
        comments: number;
    };
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ name: "", bio: "", image: "" });
    const [activeTab, setActiveTab] = useState('reviews');
    const [favorites, setFavorites] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'favorites') {
            fetch('/api/user/favorites')
                .then(res => res.json())
                .then(data => setFavorites(Array.isArray(data) ? data : []));
        }
    }, [activeTab]);

    useEffect(() => {
        fetch("/api/user/profile")
            .then(res => {
                if (res.status === 401) {
                    router.push("/"); // Redirect if not logged in
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (data) {
                    setUser(data);
                    setFormData({ name: data.name, bio: data.bio || "", image: data.image || "" });
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [router]);

    const handleUpdate = async () => {
        const res = await fetch("/api/user/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            alert("Cập nhật thành công!");
            setIsEditing(false);
            setUser(prev => prev ? { ...prev, ...formData } : null);
            router.refresh();
        } else {
            alert("Có lỗi xảy ra!");
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500">Đang tải hồ sơ...</div>;
    if (!user) return <div className="text-center py-20 text-red-500">Vui lòng đăng nhập để xem hồ sơ.</div>;

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl font-sans text-slate-900">
            {/* Header / Info Section */}
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-slate-200 mb-4 relative group">
                    <img
                        src={user.image || "https://placehold.co/200x200?text=U"}
                        alt={user.name}
                        className="w-full h-full object-cover"
                    />
                </div>

                <h1 className="text-2xl font-bold flex items-center gap-2">
                    {user.name}
                    {/* {user.role === 'admin' && <span className="text-blue-500 text-sm">✓</span>} */}
                </h1>
                <p className="text-slate-500 text-sm font-medium mb-1">@{user.email.split('@')[0]}</p>

                {/* Edit Button */}
                <div className="mt-4 flex gap-2">
                    <Dialog open={isEditing} onOpenChange={setIsEditing}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="h-10 px-8 font-semibold border-slate-300 hover:bg-slate-50">
                                Sửa hồ sơ
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Tên hiển thị</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ảnh đại diện (URL)</Label>
                                    <Input
                                        value={formData.image}
                                        onChange={e => setFormData({ ...formData, image: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Giới thiệu (Bio)</Label>
                                    <Textarea
                                        value={formData.bio}
                                        onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Viết gì đó về bạn..."
                                        rows={3}
                                    />
                                </div>
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleUpdate}>
                                    Lưu thay đổi
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="ghost" className="h-10 w-10 p-0 border border-slate-200">
                        ↗
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-8 md:gap-12 mb-8 border-y border-slate-100 py-4">
                <div className="text-center">
                    <span className="block font-bold text-lg">{user.stats.following}</span>
                    <span className="text-xs text-slate-500 text-nowrap">Đang follow</span>
                </div>
                <div className="text-center">
                    <span className="block font-bold text-lg">{user.stats.followers}</span>
                    <span className="text-xs text-slate-500 text-nowrap">Follower</span>
                </div>
                <div className="text-center">
                    <span className="block font-bold text-lg">{user.stats.comments}</span>
                    <span className="text-xs text-slate-500 text-nowrap">Bình luận</span>
                </div>
            </div>

            {/* Bio */}
            {user.bio ? (
                <div className="text-center text-sm leading-relaxed max-w-lg mx-auto mb-8 text-slate-700 whitespace-pre-line">
                    {user.bio}
                </div>
            ) : (
                <div className="text-center text-sm text-slate-400 mb-8 italic">Chưa có giới thiệu.</div>
            )}

            {/* Content Tabs */}
            <div className="border-t border-slate-200">
                <div className="flex justify-center">
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeTab === 'reviews' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Reviews
                    </button>
                    <button
                        onClick={() => setActiveTab('favorites')}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeTab === 'favorites' ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        ❤️ Đã thích
                    </button>
                    <button
                        onClick={() => setActiveTab('private')}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeTab === 'private' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        🔒 Riêng tư
                    </button>
                </div>

                <div className="py-8">
                    {activeTab === 'reviews' && (
                        <div className="text-center text-slate-500 text-sm py-8">
                            <p>✨ Bạn chưa đăng bài review nào.</p>
                        </div>
                    )}

                    {activeTab === 'favorites' && (
                        <div className="space-y-4">
                            {favorites.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {favorites.map((work: any) => (
                                        <div key={work.id} className="flex gap-4 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                            <div className="w-16 h-24 bg-slate-200 rounded flex-shrink-0 overflow-hidden">
                                                <img src={work.coverImage} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 truncate">{work.title}</h4>
                                                <p className="text-xs text-slate-500 mb-2 truncate">{work.author}</p>
                                                <Button onClick={() => router.push(`/truyen/${work.slug}`)} className="h-7 text-xs px-3" variant="secondary">
                                                    Đọc tiếp
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 text-sm py-8">
                                    <p>💔 Bạn chưa thích truyện nào cả.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'private' && (
                        <div className="text-center text-slate-500 text-sm py-8">
                            <p>🔒 Không có nội dung riêng tư.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
