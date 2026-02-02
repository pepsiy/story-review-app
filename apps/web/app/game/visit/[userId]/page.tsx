"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Droplet, Pickaxe } from "lucide-react";

type Plot = {
    id: number;
    plotIndex: number;
    isUnlocked: boolean;
    seedId: string | null;
    plantedAt: string | null;
};

type TargetUser = {
    id: string;
    name: string;
    cultivationLevel: string;
};

type Friendship = {
    friendshipLevel: number;
    waterCount: number;
    stealCount: number;
};

export default function VisitFarmPage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const targetUserId = params.userId as string;

    const [loading, setLoading] = useState(true);
    const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
    const [plots, setPlots] = useState<Plot[]>([]);
    const [friendship, setFriendship] = useState<Friendship>({ friendshipLevel: 0, waterCount: 0, stealCount: 0 });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const fetchFarm = async () => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/visit-farm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, targetUserId })
            });
            const data = await res.json();
            if (res.ok) {
                setTargetUser(data.targetUser);
                setPlots(data.plots);
                setFriendship(data.friendship);
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            console.error("Fetch Farm Error", e);
            toast.error("Lỗi kết nối");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.id) fetchFarm();
    }, [session, targetUserId]);

    const waterPlant = async (plotId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/water`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, targetUserId, plotId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchFarm();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const stealHarvest = async (plotId: number) => {
        if (!session?.user?.id) return;
        if (!confirm("Bạn chắc chắn muốn hái trộm? Hành động này sẽ giảm hảo cảm!")) return;

        try {
            const res = await fetch(`${API_URL}/game/steal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, targetUserId, plotId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchFarm();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!session) return <div className="text-center p-10">Vui lòng đăng nhập!</div>;
    if (!targetUser) return <div className="text-center p-10">Không tìm thấy người dùng.</div>;

    return (
        <div className="min-h-screen bg-[#e8f5e9] p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between border border-green-100">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
                    </Button>
                    <div className="text-center">
                        <h2 className="font-bold text-xl">{targetUser.name}</h2>
                        <p className="text-sm text-slate-500">{targetUser.cultivationLevel}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Hảo Cảm</p>
                        <p className={`font-bold ${friendship.friendshipLevel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {friendship.friendshipLevel}
                        </p>
                    </div>
                </div>

                {/* Farm Grid */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-bold text-slate-700 mb-4">Vườn Dược Liệu</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {plots
                            .sort((a, b) => a.plotIndex - b.plotIndex)
                            .map(plot => {
                                if (!plot.isUnlocked) {
                                    return (
                                        <div key={plot.id} className="aspect-square bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                            <span className="text-slate-400 text-2xl">🔒</span>
                                        </div>
                                    );
                                }

                                if (!plot.seedId) {
                                    return (
                                        <div key={plot.id} className="aspect-square bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border-2 border-amber-200 flex items-center justify-center">
                                            <span className="text-amber-400 text-2xl">🌱</span>
                                        </div>
                                    );
                                }

                                // Has plant
                                return (
                                    <div key={plot.id} className="aspect-square bg-gradient-to-br from-green-100 to-green-200 rounded-lg border-2 border-green-400 relative group">
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-4xl">🌿</span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 p-2 items-center justify-center">
                                            <Button
                                                size="sm"
                                                className="w-full bg-blue-500 hover:bg-blue-600"
                                                onClick={() => waterPlant(plot.id)}
                                            >
                                                <Droplet className="w-3 h-3 mr-1" /> Tưới
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="w-full"
                                                onClick={() => stealHarvest(plot.id)}
                                            >
                                                <Pickaxe className="w-3 h-3 mr-1" /> Trộm
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* Stats */}
                    <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-600 flex gap-4">
                        <span>Tưới: {friendship.waterCount} lần</span>
                        <span>Trộm: {friendship.stealCount} lần</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
