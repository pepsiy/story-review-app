"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sprout, ShoppingBag, Pickaxe, Coins } from "lucide-react";

// Types
type Plot = {
    id: number;
    plotIndex: number;
    isUnlocked: boolean;
    seedId: string | null;
    plantedAt: string | null;
};

type Item = {
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

type GameState = {
    user: UserState;
    plots: Plot[];
    inventory: Item[];
};

// --- Game Data (Mirrored from Backend for UI) ---
const ITEMS_DEF: any = {
    'seed_linh_thao': { name: 'Hạt Linh Thảo', icon: '🌿', growTime: 60, price: 10 },
    'seed_nhan_sam': { name: 'Hạt Nhân Sâm', icon: '🥕', growTime: 300, price: 50 },
    'herb_linh_thao': { name: 'Linh Thảo', icon: '🍃' },
    'herb_nhan_sam': { name: 'Nhân Sâm', icon: '🥕' },
};

export default function GamePage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<GameState | null>(null);
    const [activeTab, setActiveTab] = useState<'FARM' | 'SHOP'>('FARM');

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

    useEffect(() => {
        if (session?.user?.id) fetchState();
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
                            {seedInventory.map(seed => (
                                <button key={seed.itemId} onClick={() => plantSeed(plot.id, seed.itemId)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] p-1 rounded">
                                    Gieo {ITEMS_DEF[seed.itemId]?.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[10px] text-stone-400">Hết hạt giống</span>
                    )}
                </div>
            );
        }

        const seedDef = ITEMS_DEF[plot.seedId];
        const growTimeMs = seedDef?.growTime * 1000 || 0;
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
                        <ShoppingBag className="w-4 h-4" /> Thị Trấn (Shop)
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
                                        {state.inventory.map(item => (
                                            <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{ITEMS_DEF[item.itemId]?.icon || '📦'}</span>
                                                    <div>
                                                        <div className="font-medium text-sm text-slate-800">{ITEMS_DEF[item.itemId]?.name || item.itemId}</div>
                                                        <div className="text-xs text-slate-500">{item.type}</div>
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold text-slate-600">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'SHOP' && (
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Tạp Hóa Thị Trấn</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(ITEMS_DEF).map(([key, def]: any) => (
                                    def.price ? (
                                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                            <div className="text-4xl mb-2">{def.icon}</div>
                                            <div className="font-bold text-sm text-slate-800 mb-1">{def.name}</div>
                                            <div className="text-xs text-slate-500 mb-3 bg-blue-50 px-2 py-0.5 rounded text-blue-600">Thời gian: {def.growTime}s</div>

                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                                                onClick={() => buyItem(key)}
                                            >
                                                Mua ({def.price} Vàng)
                                            </Button>
                                        </div>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
