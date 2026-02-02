"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sprout, ShoppingBag, Pickaxe, Coins, FlaskConical, Check, Zap } from "lucide-react";

// Types
type Plot = {
    id: number;
    plotIndex: number;
    isUnlocked: boolean;
    seedId: string | null;
    plantedAt: string | null;
};

type InventoryItem = {
    id: number;
    itemId: string;
    quantity: number;
    type: string;
};

type UserState = {
    id: string;
    gold: number;
    cultivationLevel: string;
    cultivationExp: number;
};

type Mission = {
    id: number;
    title: string;
    description?: string;
    type: string;
    requiredItemId?: string;
    requiredQuantity?: number;
    rewardGold: number;
    rewardExp: number;
};

type UserMission = {
    id: number;
    userId: string;
    missionId: number;
    status: string;
    progress: number;
    startedAt: string;
    completedAt?: string;
};

type GameState = {
    user: UserState;
    plots: Plot[];
    inventory: InventoryItem[];
    itemsDef?: any;
};

// --- Game Data (Mirrored from Backend for UI) ---
// Note: Now fetched dynamically from API


export default function GameClient() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<GameState | null>(null);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [userMissions, setUserMissions] = useState<UserMission[]>([]);
    const [activeTab, setActiveTab] = useState<'FARM' | 'SHOP' | 'ALCHEMY' | 'MISSIONS'>('FARM');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const fetchState = async () => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/state`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id })
            });
            const data = await res.json();
            if (data.user) {
                setState(data);
            }
        } catch (e) {
            console.error("Fetch State Error", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchMissions = async () => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/missions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id })
            });
            const data = await res.json();
            if (data.missions) {
                setMissions(data.missions);
                setUserMissions(data.userMissions || []);
            }
        } catch (e) {
            console.error("Fetch Missions Error", e);
        }
    };

    useEffect(() => {
        if (session?.user?.id) {
            fetchState();
            fetchMissions();
        }
    }, [session]);

    // --- Actions ---

    const plantSeed = async (plotId: number, seedId: string) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/plant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, plotId, seedId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Đã gieo hạt thành công! 🌱");
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const harvest = async (plotId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/harvest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, plotId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const buyItem = async (itemId: string, qty: number = 1) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/buy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, itemId, quantity: qty })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const sellItem = async (itemId: string, qty: number = 1) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/sell`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, itemId, quantity: qty })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const craftItem = async (itemId: string) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/craft`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, itemId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const useItem = async (itemId: string) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/use`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, itemId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const acceptMission = async (missionId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/missions/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, missionId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Đã nhận nhiệm vụ!");
                fetchMissions();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const completeMission = async (missionId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/missions/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, missionId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
                fetchMissions();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!session) return <div className="text-center p-10">Vui lòng đăng nhập để chơi game!</div>;
    if (!state) return <div className="text-center p-10">Lỗi tải dữ liệu game.</div>;

    // --- Render Helpers ---

    const renderPlot = (plot: Plot) => {
        if (!plot.isUnlocked) return <div className="aspect-square bg-stone-300 rounded flex items-center justify-center opacity-50 cursor-not-allowed border-2 border-stone-400">🔒</div>;

        if (!plot.seedId) {
            // Empty -> Show Plant Button (if has seeds)
            const seedInventory = state.inventory.filter(i => i.type === 'SEED' && i.quantity > 0);
            return (
                <div className="aspect-square bg-[#7c5c44] rounded border-4 border-[#5d4037] flex flex-col items-center justify-center relative overflow-hidden shadow-inner group">
                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                    <span className="text-xs text-stone-200 mb-2">Đất Trống</span>
                    {seedInventory.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 p-1">
                            {seedInventory.map(seed => {
                                const def = state.itemsDef?.[seed.itemId];
                                return (
                                    <button key={seed.itemId} onClick={() => plantSeed(plot.id, seed.itemId)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] p-1 rounded">
                                        Gieo {def?.name || seed.itemId}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <span className="text-[10px] text-stone-400">Hết hạt giống</span>
                    )}
                </div>
            );
        }

        const seedDef = state.itemsDef?.[plot.seedId];
        const growTimeMs = (seedDef?.growTime || 60) * 1000;
        const elapsed = plot.plantedAt ? Date.now() - new Date(plot.plantedAt).getTime() : 0;
        const progress = Math.min(100, (elapsed / growTimeMs) * 100);
        const isReady = progress >= 100;

        return (
            <div className="aspect-square bg-[#5d4037] rounded border-4 border-[#3e2723] flex flex-col items-center justify-center relative shadow-inner cursor-pointer transition-all hover:scale-[1.02]"
                onClick={() => isReady && harvest(plot.id)}
            >
                {/* Visual Plant */}
                <div className="text-4xl animate-bounce-slow" style={{ filter: isReady ? 'none' : 'grayscale(0.5) brightness(0.8)' }}>
                    {seedDef?.icon || '🌱'}
                </div>

                {/* Progress Bar */}
                {!isReady && (
                    <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {isReady && (
                    <div className="absolute top-1 right-1">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </div>
                )}

                {isReady && <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold text-xs opacity-0 hover:opacity-100 transition-opacity">Thu Hoạch!</div>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#e8f5e9] p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Stats */}
                <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-4 border border-green-100">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow">
                            {state.user.cultivationLevel[0]}
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">{state.user.cultivationLevel}</h2>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                Exp: <span className="text-blue-600 font-mono">{state.user.cultivationExp}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100">
                        <Coins className="text-yellow-600 w-5 h-5" />
                        <span className="font-bold text-yellow-700">{state.user.gold.toLocaleString()} <span className="text-xs font-normal">Vàng</span></span>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('FARM')}
                        className={`px-6 py-2 rounded-t-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'FARM' ? 'bg-white text-green-700 shadow-sm' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}
                    >
                        <Sprout className="w-4 h-4" /> Nông Trại
                    </button>
                    <button
                        onClick={() => setActiveTab('SHOP')}
                        className={`px-6 py-2 rounded-t-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'SHOP' ? 'bg-white text-blue-700 shadow-sm' : 'bg-blue-800/10 text-blue-800 hover:bg-blue-800/20'}`}
                    >
                        <ShoppingBag className="w-4 h-4" /> Thị Trấn
                    </button>
                    <button
                        onClick={() => setActiveTab('ALCHEMY')}
                        className={`px-6 py-2 rounded-t-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'ALCHEMY' ? 'bg-white text-purple-700 shadow-sm' : 'bg-purple-800/10 text-purple-800 hover:bg-purple-800/20'}`}
                    >
                        <FlaskConical className="w-4 h-4" /> Luyện Đan
                    </button>
                    <button
                        onClick={() => setActiveTab('MISSIONS')}
                        className={`px-6 py-2 rounded-t-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'MISSIONS' ? 'bg-white text-orange-700 shadow-sm' : 'bg-orange-800/10 text-orange-800 hover:bg-orange-800/20'}`}
                    >
                        📜 Bảng Cáo Thị
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-b-xl rounded-tr-xl shadow-lg p-6 min-h-[400px]">

                    {activeTab === 'FARM' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Pickaxe className="w-4 h-4" /> Vườn Dược Liệu</h3>
                                <div className="grid grid-cols-3 gap-3 w-full bg-[#8d6e63] p-3 rounded-lg shadow-inner">
                                    {state.plots.map(plot => (
                                        <div key={plot.id}>{renderPlot(plot)}</div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 h-full">
                                <h3 className="font-bold text-slate-700 mb-4">Kho Đồ (Túi)</h3>
                                {state.inventory.length === 0 ? (
                                    <p className="text-slate-400 italic text-sm">Túi trống rỗng...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {state.inventory.map(item => {
                                            const def = state.itemsDef?.[item.itemId] || {};
                                            return (
                                                <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{def.icon || '📦'}</span>
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-800">{def.name || item.itemId}</div>
                                                            <div className="text-xs text-slate-400">{item.type}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-600">x{item.quantity}</span>
                                                        {def.sellPrice && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-6 w-6 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                                                                title={`Bán lấy ${def.sellPrice} Vàng`}
                                                                onClick={() => sellItem(item.itemId)}
                                                            >
                                                                $
                                                            </Button>
                                                        )}
                                                        {item.type === 'CONSUMABLE' && (
                                                            <Button
                                                                variant="default"
                                                                size="icon"
                                                                className="h-6 w-6 bg-blue-500 hover:bg-blue-600 text-white"
                                                                title="Sử dụng (Tăng Exp)"
                                                                onClick={() => useItem(item.itemId)}
                                                            >
                                                                <Zap className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'SHOP' && (
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Tạp Hóa Thị Trấn</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.values(state.itemsDef || {}).filter((def: any) => def.price > 0).map((def: any) => (
                                    <div key={def.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                        <div className="text-4xl mb-2">{def.icon}</div>
                                        <div className="font-bold text-sm text-slate-800 mb-1">{def.name}</div>
                                        {def.type === 'SEED' && <div className="text-xs text-slate-500 mb-3 bg-blue-50 px-2 py-0.5 rounded text-blue-600">Thời gian: {def.growTime}s</div>}
                                        {def.description && <div className="text-[10px] text-slate-400 mb-2 italic">{def.description}</div>}

                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                                            onClick={() => buyItem(def.id)}
                                        >
                                            Mua ({def.price} Vàng)
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ALCHEMY' && (
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Lò Luyện Đan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.values(state.itemsDef || {}).filter((def: any) => def.ingredients && def.ingredients.length > 0).map((recipe: any) => (
                                    <div key={recipe.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex flex-col items-center text-center relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-bl">Cấp 1</div>
                                        <div className="text-4xl mb-2">{recipe.icon}</div>
                                        <div className="font-bold text-slate-800">{recipe.name}</div>
                                        <div className="text-xs text-purple-600 mb-3">Tăng {recipe.exp} Exp</div>

                                        <div className="w-full bg-white rounded p-2 mb-3 border border-purple-100 text-sm">
                                            <div className="text-xs text-slate-500 mb-1">Nguyên Liệu:</div>
                                            <div className="space-y-1">
                                                {recipe.ingredients.map((ing: any) => {
                                                    // Resolve ing definition
                                                    const ingDef = state.itemsDef?.[ing.itemId];
                                                    const userHas = state.inventory.find(i => i.itemId === ing.itemId)?.quantity || 0;
                                                    const isEnough = userHas >= ing.quantity;
                                                    return (
                                                        <div key={ing.itemId} className="flex justify-between text-xs">
                                                            <span>{ingDef?.name || ing.itemId}</span>
                                                            <span className={isEnough ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                                                {userHas}/{ing.quantity} {isEnough && <Check className="inline w-3 h-3" />}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-dashed border-slate-200">
                                                    <span>Phí Luyện</span>
                                                    <span className={state.user.gold >= 100 ? "text-yellow-600 font-bold" : "text-red-500 font-bold"}>100 Vàng</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                            onClick={() => craftItem(recipe.id)}
                                        >
                                            <FlaskConical className="w-4 h-4 mr-1" /> Luyện Đan
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'MISSIONS' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-700 text-lg mb-4">📜 Bảng Cáo Thị Tông Môn</h3>

                            {/* Active Missions */}
                            <div>
                                <h4 className="text-sm font-semibold text-orange-700 mb-2">Nhiệm Vụ Đang Thực Hiện</h4>
                                {userMissions.filter(um => um.status === 'IN_PROGRESS').length === 0 ? (
                                    <p className="text-slate-400 text-sm italic">Chưa nhận nhiệm vụ nào.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {userMissions
                                            .filter(um => um.status === 'IN_PROGRESS')
                                            .map(um => {
                                                const mission = missions.find(m => m.id === um.missionId);
                                                if (!mission) return null;

                                                const userItem = state.inventory.find(inv => inv.itemId === mission.requiredItemId);
                                                const canComplete = userItem && userItem.quantity >= (mission.requiredQuantity || 1);

                                                return (
                                                    <div key={um.id} className="border border-orange-200 bg-orange-50/30 rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <h5 className="font-bold text-slate-800">{mission.title}</h5>
                                                                <p className="text-xs text-slate-600 mt-1">{mission.description}</p>
                                                            </div>
                                                            {canComplete && <Check className="w-5 h-5 text-green-600" />}
                                                        </div>
                                                        <div className="text-xs text-slate-700 bg-white/50 p-2 rounded mb-2">
                                                            Yêu cầu: <span className="font-mono">{mission.requiredQuantity} {mission.requiredItemId}</span>
                                                            <br />
                                                            Hiện có: <span className={`font-mono ${canComplete ? 'text-green-600' : 'text-red-600'}`}>{userItem?.quantity || 0}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-600 bg-yellow-50 p-2 rounded mb-3">
                                                            Thưởng: <span className="text-yellow-600 font-bold">{mission.rewardGold} Vàng</span> + <span className="text-blue-600 font-bold">{mission.rewardExp} Exp</span>
                                                        </div>
                                                        <Button
                                                            variant={canComplete ? "default" : "secondary"}
                                                            className="w-full"
                                                            disabled={!canComplete}
                                                            onClick={() => completeMission(mission.id)}
                                                        >
                                                            {canComplete ? "✅ Nộp Nhiệm Vụ" : "⏳ Chưa đủ vật phẩm"}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Available Missions */}
                            <div>
                                <h4 className="text-sm font-semibold text-orange-700 mb-2">Nhiệm Vụ Khả Dụng</h4>
                                {missions.filter(m => !userMissions.find(um => um.missionId === m.id)).length === 0 ? (
                                    <p className="text-slate-400 text-sm italic">Không có nhiệm vụ mới.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {missions
                                            .filter(m => !userMissions.find(um => um.missionId === m.id))
                                            .map(mission => (
                                                <div key={mission.id} className="border border-slate-200 bg-white rounded-lg p-4 hover:shadow-md transition-shadow">
                                                    <h5 className="font-bold text-slate-800">{mission.title}</h5>
                                                    <p className="text-xs text-slate-600 mt-1 mb-3">{mission.description}</p>
                                                    <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded mb-2">
                                                        Yêu cầu: <span className="font-mono">{mission.requiredQuantity} {mission.requiredItemId}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 bg-yellow-50 p-2 rounded mb-3">
                                                        Thưởng: <span className="text-yellow-600 font-bold">{mission.rewardGold} Vàng</span> + <span className="text-blue-600 font-bold">{mission.rewardExp} Exp</span>
                                                    </div>
                                                    <Button
                                                        className="w-full bg-orange-600 hover:bg-orange-700"
                                                        onClick={() => acceptMission(mission.id)}
                                                    >
                                                        Nhận Nhiệm Vụ
                                                    </Button>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
