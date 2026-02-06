"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sprout, ShoppingBag, Pickaxe, Coins, FlaskConical, Check, Zap, Trophy, Flame, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// Types
type Plot = {
    id: number;
    plotIndex: number;
    isUnlocked: boolean;
    seedId: string | null;
    plantedAt: string | null;
    waterCount?: number;
    lastWateredAt?: string | null;
    protectionExpiresAt?: string | null; // Phase 6: Protection
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
    sectId?: string | null;
    sectRole?: string | null;
    activeBuffs?: any[]; // Phase 4: Event Buffs

    // Phase 5: Professions
    professionAlchemyLevel?: number;
    professionAlchemyExp?: number;
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

type Beast = {
    id: string;
    name: string;
    description?: string;
    health: number;
    attack: number;
    defense: number;
    icon?: string;
    lootTable: string;
};

type BeastEncounter = {
    encounter: {
        id: number;
        userId: string;
        beastId: string;
        beastHealth: number;
        status: string;
    };
    beast: Beast;
};

type RaidLog = {
    id: number;
    attackerId: string;
    victimId: string;
    success: boolean;
    goldStolen: number;
    createdAt: string;
    attacker?: { name: string };
    victim?: { name: string };
};

type ArenaBattle = {
    id: number;
    player1Id: string;
    player2Id: string;
    winnerId: string;
    player1Reward: number;
    player2Reward: number;
    createdAt: string;
};

type TierInfo = {
    tier: string;
    icon: string;
    minPoints: number;
    currentPoints: number;
};

type GameState = {
    user: UserState;
    plots: Plot[];
    inventory: InventoryItem[];
    itemsDef?: any;
    worldEvents?: string[]; // Phase 4
};

type GameLog = {
    id: number;
    userId: string;
    targetUserId?: string;
    action: string;
    description: string;
    createdAt: string;
};

type LeaderboardEntry = {
    id: string;
    name: string;
    image: string | null;
    cultivationLevel: string;
    cultivationExp: number;
};

// Constants
const PLOT_UNLOCK_COSTS: Record<number, number> = {
    3: 1000,
    4: 5000,
    5: 20000,
    6: 50000,
    7: 100000,
    8: 500000
};

// Duplicate from Backend for UI logic
const CULTIVATION_LEVELS = [
    { name: 'Phàm Nhân', exp: 0, nextLevel: 'Luyện Khí', req: 100 },
    { name: 'Luyện Khí', exp: 100, nextLevel: 'Trúc Cơ', req: 1000 },
    { name: 'Trúc Cơ', exp: 1000, nextLevel: 'Kim Đan', req: 5000 },
    { name: 'Kim Đan', exp: 5000, nextLevel: 'Nguyên Anh', req: 20000 },
    { name: 'Nguyên Anh', exp: 20000, nextLevel: 'Hóa Thần', req: 100000 },
    { name: 'Hóa Thần', exp: 100000, nextLevel: 'Luyện Hư', req: 500000 },
];

export default function GameClient() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<GameState | null>(null);
    const [missions, setMissions] = useState<{ mission: Mission; userMission: UserMission | null }[]>([]);
    const [userMissions, setUserMissions] = useState<UserMission[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [sects, setSects] = useState<any[]>([]);
    const [userSect, setUserSect] = useState<any>(null);
    const [alchemyItems, setAlchemyItems] = useState<any[]>([]);
    const [beastEncounter, setBeastEncounter] = useState<BeastEncounter | null>(null);
    const [beastModalOpen, setBeastModalOpen] = useState(false); // List of sects to join
    const [mySect, setMySect] = useState<any>(null); // Current sect info
    const [activeTab, setActiveTab] = useState<'FARM' | 'SHOP' | 'ALCHEMY' | 'MISSIONS' | 'LOGS' | 'LEADERBOARD' | 'SECT' | 'PVP'>('FARM');

    // PVP State
    const [pvpSubTab, setPvpSubTab] = useState<'RAID' | 'ARENA'>('RAID');
    const [raidLogs, setRaidLogs] = useState<RaidLog[]>([]);
    const [protection, setProtection] = useState<any>(null);
    const [arenaBattles, setArenaBattles] = useState<ArenaBattle[]>([]);
    const [myTier, setMyTier] = useState<any>(null);
    const [arenaOpponent, setArenaOpponent] = useState<any>(null);
    const [arenaBattleLog, setArenaBattleLog] = useState<any[]>([]);
    const [arenaResult, setArenaResult] = useState<any>(null);
    const [arenaModalOpen, setArenaModalOpen] = useState(false);

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
        } catch (error) {
            toast.error("Có lỗi xảy ra");
        }
    };

    // ========== Beast Functions ==========
    const checkBeastEncounter = async () => {
        try {
            const res = await fetch(`${API_URL}/game/beast/current`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session!.user!.id })
            });
            const data = await res.json();
            if (data.encounter) {
                setBeastEncounter(data.encounter);
                setBeastModalOpen(true);
            }
        } catch (error) {
            console.error('Check beast error:', error);
        }
    };

    const attackBeast = async () => {
        try {
            const res = await fetch(`${API_URL}/game/beast/attack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session!.user!.id })
            });
            const data = await res.json();

            if (data.result === 'VICTORY') {
                toast.success(`Chiến thắng! Nhận được: ${data.loot.map((l: any) => `${l.quantity}x ${l.itemId}`).join(', ')}`);
                setBeastModalOpen(false);
                setBeastEncounter(null);
                fetchState();
                // fetchInventory(); // Assuming fetchState covers inventory
            } else {
                // Update beast health
                if (beastEncounter) {
                    setBeastEncounter({
                        ...beastEncounter,
                        encounter: { ...beastEncounter.encounter, beastHealth: data.beastHealth }
                    });
                }
                toast.info(`Gây ${data.playerDamage} sát thương! Quái phản công ${data.beastDamage} sát thương.`);
            }
        } catch (error) {
            toast.error('Không thể tấn công');
        }
    };

    const fleeBeast = async () => {
        try {
            const res = await fetch(`${API_URL}/game/beast/flee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session!.user!.id })
            });
            if (res.ok) {
                toast.success('Trốn thoát thành công!');
                setBeastModalOpen(false);
                setBeastEncounter(null);
            }
        } catch (error) {
            toast.error('Không thể trốn thoát');
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

    const fetchLogs = async () => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/logs?userId=${session.user.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setLogs(data);
            }
        } catch (e) { console.error("Fetch Logs Error", e); }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch(`${API_URL}/game/leaderboard`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setLeaderboard(data);
            }
        } catch (e) { console.error("Fetch LB Error", e); }
    };

    const fetchSects = async () => {
        try {
            const res = await fetch(`${API_URL}/game/sect/list`);
            const data = await res.json();
            if (Array.isArray(data)) setSects(data);
        } catch (e) { console.error("Fetch Sects Error", e); }
    };

    const fetchMySect = async () => {
        if (!state?.user?.sectId) return;
        try {
            const res = await fetch(`${API_URL}/game/sect/info?sectId=${state.user.sectId}`);
            const data = await res.json();
            if (data.sect) setMySect(data);
        } catch (e) { console.error("Fetch My Sect Error", e); }
    };

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated") {
            setLoading(false);
            return;
        }

        if (session?.user?.id) {
            fetchState();
            fetchMissions();
            fetchLogs();
            fetchLeaderboard();
            checkBeastEncounter();
        }
    }, [session, status]);

    useEffect(() => {
        if (state?.user?.sectId) {
            fetchMySect();
        } else {
            fetchSects();
        }
    }, [state?.user?.sectId]);

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

    const unlockSlot = async (plotIndex: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/unlock-slot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, plotIndex })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
                fetchLogs();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const waterPlant = async (targetPlotId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/water`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, targetPlotId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
                fetchLogs();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const setupProtection = async (plotId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/social/protect`, {
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

    const breakthrough = async () => {
        if (!session?.user?.id) return;
        try {
            // Confirmation?
            if (!confirm("Xác suất thất bại sẽ mất EXP. Nếu là Kim Đan trở lên sẽ có Thiên Kiếp (cần Hộ Thân Phù). Bạn chắc chắn muốn đột phá?")) return;

            const res = await fetch(`${API_URL}/game/breakthrough`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.success) {
                    toast.success(data.message);
                } else {
                    toast.error(data.message);
                }
                fetchState();
                fetchLogs();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const createSect = async (name: string, description: string) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/sect/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, name, description })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Thành lập tông môn thành công!");
                fetchState();
                fetchMySect();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const joinSect = async (sectId: number) => {
        if (!session?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/sect/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id, sectId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchState();
                fetchMySect();
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    const leaveSect = async () => {
        if (!session?.user?.id) return;
        if (!confirm("Bạn chắc chắn muốn rời tông môn?")) return;
        try {
            const res = await fetch(`${API_URL}/game/sect/leave`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: session.user.id })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                setMySect(null);
                fetchState();
                fetchSects(); // Refresh list to maybe show old sect
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Lỗi kết nối"); }
    };

    // --- PVP & RAID ---
    const fetchPvpStatus = async () => {
        if (!state?.user?.id) return;
        try {
            // Fetch protection status
            const resProt = await fetch(`${API_URL}/game/pvp/protection?userId=${state.user.id}`);
            const dataProt = await resProt.json();
            setProtection(dataProt);

            // Fetch raid history
            const resLogs = await fetch(`${API_URL}/game/pvp/raid-history?userId=${state.user.id}`);
            const dataLogs = await resLogs.json();
            if (dataLogs.raids) setRaidLogs(dataLogs.raids);
        } catch (e) {
            console.error("Fetch PVP Error", e);
        }
    };

    const handleRaid = async (victimId: string) => {
        try {
            if (!victimId) return;
            const res = await fetch(`${API_URL}/game/pvp/raid`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attackerId: state?.user?.id, victimId })
            });
            const data = await res.json();

            if (res.ok) {
                toast({
                    title: data.success ? "⚔️ Đánh Cướp Thành Công!" : "🛡️ Đánh Cướp Thất Bại!",
                    description: data.message,
                    variant: data.success ? "default" : "destructive",
                });
                fetchGameState(); // Update gold
                fetchPvpStatus(); // Update logs
            } else {
                toast({
                    title: "Lỗi",
                    description: data.error,
                    variant: "destructive"
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- ARENA ---
    const fetchArenaStatus = async () => {
        if (!state?.user?.id) return;
        try {
            const res = await fetch(`${API_URL}/game/arena/history?userId=${state.user.id}`);
            const data = await res.json();
            if (data.battles) setArenaBattles(data.battles);

            // Fetch tier
            const resTier = await fetch(`${API_URL}/game/ranking/my-tier?userId=${state.user.id}`);
            const dataTier = await resTier.json();
            setMyTier(dataTier);
        } catch (e) {
            console.error(e);
        }
    };

    const findArenaMatch = async () => {
        try {
            setArenaOpponent(null);
            setArenaResult(null);
            setArenaBattleLog([]);

            const res = await fetch(`${API_URL}/game/arena/find-match`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: state.user.id })
            });
            const data = await res.json();

            if (res.ok) {
                setArenaOpponent(data.opponent);
                setArenaModalOpen(true);
            } else {
                toast({ title: "Không tìm thấy đối thủ", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startArenaBattle = async () => {
        if (!arenaOpponent) return;
        try {
            const res = await fetch(`${API_URL}/game/arena/battle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ player1Id: state.user.id, player2Id: arenaOpponent.id })
            });
            const data = await res.json();

            if (res.ok) {
                // Animate battle log
                let roundIndex = 0;
                const interval = setInterval(() => {
                    if (roundIndex < data.battleLog.length) {
                        setArenaBattleLog(prev => [...prev, data.battleLog[roundIndex]]);
                        roundIndex++;
                    } else {
                        clearInterval(interval);
                        setArenaResult(data); // Show result
                        fetchGameState(); // Update rewards
                        fetchArenaStatus(); // Update history
                    }
                }, 800); // 0.8s per round
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (activeTab === 'SECT' && state.user?.id) {
            fetchMySect();
            fetchSects();
        }
        if (activeTab === 'PVP' && state.user?.id) {
            fetchPvpStatus();
            fetchArenaStatus();
        }
    }, [activeTab, state.user?.id]);


    if (status === "loading" || (loading && status === "authenticated")) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50">
                <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
                <p className="text-slate-600 font-medium animate-pulse">Đang tải dữ liệu tiên môn...</p>
            </div>
        );
    }


    if (status === "unauthenticated" || !session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-slate-200">
                    <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sprout className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Tu Tiên Giới</h2>
                    <p className="text-slate-600 mb-6">Bạn cần đăng nhập để bắt đầu hành trình tu tiên, trồng linh dược và luyện đan.</p>
                    <Button onClick={() => signIn()} className="w-full bg-green-600 hover:bg-green-700 text-lg py-6 font-bold shadow-green-200 shadow-xl">
                        Đăng Nhập Ngay
                    </Button>
                </div>
            </div>
        );
    }

    if (!state) return <div className="text-center p-10 text-red-500">Lỗi tải dữ liệu game. Vui lòng thử lại sau.</div>;

    // --- Helpers for Render ---
    const currentLvlDef = CULTIVATION_LEVELS.find(l => l.name === state.user.cultivationLevel) || CULTIVATION_LEVELS[0];
    const canBreakthrough = currentLvlDef.name !== 'Luyện Hư' && state.user.cultivationExp >= (currentLvlDef.req || 999999);
    const expProgress = Math.min(100, (state.user.cultivationExp / (currentLvlDef.req || 1)) * 100);

    const renderPlot = (plot: Plot) => {
        if (!plot.isUnlocked) {
            const cost = PLOT_UNLOCK_COSTS[plot.plotIndex];
            const canAfford = state.user.gold >= (cost || 999999);

            return (
                <div className="aspect-square bg-stone-200 rounded flex flex-col items-center justify-center border-2 border-stone-300 relative group overflow-hidden">
                    <div className="text-2xl mb-1 opacity-50">🔒</div>
                    {cost && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2">
                            <div className="text-white text-xs font-bold mb-2">Mở khóa?</div>
                            <div className="text-yellow-400 font-bold text-sm mb-2">{cost.toLocaleString()} V</div>
                            <Button
                                size="sm"
                                variant={canAfford ? "default" : "destructive"}
                                className="h-6 text-[10px]"
                                onClick={() => unlockSlot(plot.plotIndex)}
                                disabled={!canAfford}
                            >
                                {canAfford ? "Mở Ngay" : "Thiếu Vàng"}
                            </Button>
                        </div>
                    )}
                </div>
            );
        }

        if (!plot.seedId) {
            const seedInventory = state.inventory.filter(i => i.type === 'SEED' && i.quantity > 0);
            return (
                <div className="aspect-square bg-[#7c5c44] rounded border-4 border-[#5d4037] flex flex-col items-center justify-center relative overflow-hidden shadow-inner group">
                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                    <span className="text-xs text-stone-200 mb-2">Đất Trống</span>
                    {seedInventory.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 p-1 z-10">
                            {seedInventory.map(seed => {
                                const def = state.itemsDef?.[seed.itemId];
                                return (
                                    <button key={seed.itemId} onClick={() => plantSeed(plot.id, seed.itemId)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] p-1 rounded shadow-sm transition-transform hover:scale-105 active:scale-95">
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
        const baseGrowTimeMs = (seedDef?.growTime || 60) * 1000;

        // Water Logic
        const waterCount = plot.waterCount || 0;
        const reductionMs = baseGrowTimeMs * waterCount * 0.1; // 10% per water
        const finalGrowTimeMs = Math.max(0, baseGrowTimeMs - reductionMs);

        const elapsed = plot.plantedAt ? Date.now() - new Date(plot.plantedAt).getTime() : 0;
        const progress = Math.min(100, (elapsed / finalGrowTimeMs) * 100);
        const isReady = progress >= 100;

        return (
            <div className="aspect-square bg-[#5d4037] rounded border-4 border-[#3e2723] flex flex-col items-center justify-center relative shadow-inner cursor-pointer transition-all hover:scale-[1.02] group"
                onClick={() => isReady && harvest(plot.id)}
            >
                {/* Protection Status */}
                {plot.protectionExpiresAt && new Date(plot.protectionExpiresAt) > new Date() && (
                    <div className="absolute top-1 left-1 z-30 flex items-center gap-1" title={`Được bảo vệ đến ${new Date(plot.protectionExpiresAt).toLocaleTimeString()}`}>
                        <div className="bg-blue-600/80 text-white rounded-full p-0.5 border border-blue-300 shadow-sm animate-pulse">
                            <Shield className="w-3 h-3" />
                        </div>
                    </div>
                )}

                {/* Visual Plant */}
                <div className="text-4xl animate-bounce-slow z-10" style={{ filter: isReady ? 'none' : 'grayscale(0.2) brightness(0.9)' }}>
                    {seedDef?.icon || '🌱'}
                </div>

                {/* Progress Bar */}
                {!isReady && (
                    <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-black/50 rounded-full overflow-hidden z-20">
                        <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {/* Water Info / Action */}
                {!isReady && (
                    <div className="absolute top-1 right-1 z-30 flex flex-col gap-1 items-end">
                        {/* Droplets */}
                        <div className="flex gap-0.5">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`w-2 h-2 rounded-full border border-blue-300 ${i <= waterCount ? 'bg-blue-500' : 'bg-black/30'}`} />
                            ))}
                        </div>

                        {/* Water Button (Hidden unless hover) */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 bg-blue-500/80 hover:bg-blue-600 text-white rounded-full"
                                onClick={(e) => { e.stopPropagation(); waterPlant(plot.id); }}
                                title="Tưới nước (-10% thời gian)"
                            >
                                <span className="text-xs">💧</span>
                            </Button>

                            {/* Protection Button (Only if not already protected) */}
                            {(!plot.protectionExpiresAt || new Date(plot.protectionExpiresAt) < new Date()) && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 bg-indigo-500/80 hover:bg-indigo-600 text-white rounded-full"
                                    onClick={(e) => { e.stopPropagation(); setupProtection(plot.id); }}
                                    title="Dùng Trận Pháp (Chống trộm 4h)"
                                >
                                    <Shield className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {isReady && (
                    <div className="absolute top-1 right-1 z-20">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </div>
                )}

                {isReady && <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold text-xs opacity-0 hover:opacity-100 transition-opacity z-40 rounded">Thu Hoạch!</div>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#e8f5e9] p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Stats */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100 relative overflow-hidden">
                    {/* Event Buffs Display (Phase 4) */}
                    {state.user.activeBuffs && state.user.activeBuffs.length > 0 && (
                        <div className="absolute top-0 right-0 left-0 bg-indigo-600 text-white text-[10px] py-1 px-4 flex justify-between items-center animate-pulse z-20">
                            <span className="font-bold uppercase tracking-widest">⚡ Tác động Thiên Địa: {state.user.activeBuffs.map(b => b.type).join(', ')}</span>
                            {/* Simple timer visualization if we had expiration */}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow relative">
                                {state.user.cultivationLevel[0]}
                                {canBreakthrough && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />}
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800">{state.user.cultivationLevel}</h2>
                                <div className="text-xs text-slate-500 flex items-center gap-1 w-40">
                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${canBreakthrough ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} style={{ width: `${expProgress}%` }} />
                                    </div>
                                    <span className="text-[10px] w-12 text-right">{state.user.cultivationExp}/{currentLvlDef.req}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {canBreakthrough && (
                                <Button size="sm" variant="destructive" className="animate-pulse shadow-red-200 shadow-lg" onClick={breakthrough}>
                                    <Flame className="w-4 h-4 mr-1" /> Đột Phá!
                                </Button>
                            )}
                            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">
                                <Coins className="text-yellow-600 w-4 h-4" />
                                <span className="font-bold text-yellow-700 text-sm">{state.user.gold.toLocaleString()} <span className="text-[10px] font-normal text-yellow-600">Vàng</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab('FARM')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'FARM' ? 'bg-white text-green-700 shadow-sm' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}
                    >
                        <Sprout className="w-4 h-4" /> Nông Trại
                    </button>
                    <button
                        onClick={() => setActiveTab('SHOP')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'SHOP' ? 'bg-white text-blue-700 shadow-sm' : 'bg-blue-800/10 text-blue-800 hover:bg-blue-800/20'}`}
                    >
                        <ShoppingBag className="w-4 h-4" /> Thị Trấn
                    </button>
                    <button
                        onClick={() => setActiveTab('ALCHEMY')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'ALCHEMY' ? 'bg-white text-purple-700 shadow-sm' : 'bg-purple-800/10 text-purple-800 hover:bg-purple-800/20'}`}
                    >
                        <FlaskConical className="w-4 h-4" /> Luyện Đan
                    </button>
                    <button
                        onClick={() => setActiveTab('MISSIONS')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'MISSIONS' ? 'bg-white text-orange-700 shadow-sm' : 'bg-orange-800/10 text-orange-800 hover:bg-orange-800/20'}`}
                    >
                        📜 Cáo Thị
                    </button>
                    <button
                        onClick={() => setActiveTab('LEADERBOARD')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'LEADERBOARD' ? 'bg-white text-yellow-700 shadow-sm' : 'bg-yellow-800/10 text-yellow-800 hover:bg-yellow-800/20'}`}
                    >
                        <Trophy className="w-4 h-4" /> BXH
                    </button>
                    <button
                        onClick={() => setActiveTab('LOGS')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'LOGS' ? 'bg-white text-slate-700 shadow-sm' : 'bg-slate-800/10 text-slate-800 hover:bg-slate-800/20'}`}
                    >
                        📝 Nhật Ký
                    </button>
                    <button
                        onClick={() => setActiveTab('SECT')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'SECT' ? 'bg-white text-indigo-700 shadow-sm' : 'bg-indigo-800/10 text-indigo-800 hover:bg-indigo-800/20'}`}
                    >
                        ⛩️ Tông Môn
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
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Lò Luyện Đan</h3>

                                {/* Profession Status */}
                                <div className="text-right">
                                    <div className="text-sm font-bold text-purple-700">Luyện Đan Sư Lv.{state.user.professionAlchemyLevel || 1}</div>
                                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                                        <div
                                            className="h-full bg-purple-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, ((state.user.professionAlchemyExp || 0) / ((state.user.professionAlchemyLevel || 1) * 100)) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        EXP: {state.user.professionAlchemyExp || 0}/{(state.user.professionAlchemyLevel || 1) * 100}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.values(state.itemsDef || {}).filter((def: any) => def.ingredients && def.ingredients.length > 0).map((recipe: any) => {
                                    const profLvl = state.user.professionAlchemyLevel || 1;
                                    const baseChance = 0.5 + (profLvl * 0.05); // Match backend logic
                                    const chance = Math.min(0.9, baseChance);

                                    return (
                                        <div key={recipe.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex flex-col items-center text-center relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-bl">
                                                Tỷ lệ: {(chance * 100).toFixed(0)}%
                                            </div>
                                            <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{recipe.icon}</div>
                                            <div className="font-bold text-slate-800">{recipe.name}</div>
                                            <div className="text-xs text-purple-600 mb-3">Tăng {recipe.exp} Exp</div>

                                            <div className="w-full bg-white rounded p-2 mb-3 border border-purple-100 text-sm">
                                                <div className="text-xs text-slate-500 mb-1">Nguyên Liệu:</div>
                                                <div className="space-y-1">
                                                    {(typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : (recipe.ingredients || [])).map((ing: any) => {
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
                                    );
                                })}
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

                                                let canComplete = false;
                                                let progressText = "";

                                                if (mission.type === 'COLLECT') {
                                                    const userItem = state.inventory.find(inv => inv.itemId === mission.requiredItemId);
                                                    const current = userItem?.quantity || 0;
                                                    const required = mission.requiredQuantity || 1;
                                                    canComplete = current >= required;
                                                    progressText = `Vật phẩm: ${current}/${required}`;
                                                } else if (mission.type === 'PROGRESS' || mission.type === 'SYSTEM') {
                                                    const current = um.progress || 0;
                                                    const required = mission.requiredQuantity || 1; // Mapped from requiredCount in seeding
                                                    canComplete = current >= required;
                                                    progressText = `Tiến độ: ${current}/${required}`;
                                                }

                                                return (
                                                    <div key={um.id} className="border border-orange-200 bg-orange-50/30 rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <h5 className="font-bold text-slate-800">{mission.title}</h5>
                                                                <p className="text-xs text-slate-600 mt-1">{mission.description}</p>
                                                            </div>
                                                            {canComplete && <Check className="w-5 h-5 text-green-600" />}
                                                        </div>
                                                        <div className="text-xs text-slate-700 bg-white/50 p-2 rounded mb-2 font-mono">
                                                            {progressText}
                                                            {/* Show Item Name if Collect */}
                                                            {mission.type === 'COLLECT' && mission.requiredItemId && (
                                                                <span className="block text-[10px] text-slate-500">
                                                                    ({state.itemsDef?.[mission.requiredItemId]?.name || mission.requiredItemId})
                                                                </span>
                                                            )}
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
                                                            {canComplete ? "✅ Nộp Nhiệm Vụ" : "⏳ Đang thực hiện"}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Available Missions */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-600 mb-2">Nhiệm Vụ Khả Dụng</h4>
                                {missions.filter(m => !userMissions.some(um => um.missionId === m.id && um.status === 'IN_PROGRESS')).length === 0 ? (
                                    <p className="text-slate-400 text-sm italic">Hết nhiệm vụ khả dụng.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {missions
                                            .filter(m => !userMissions.some(um => um.missionId === m.id && um.status === 'IN_PROGRESS'))
                                            .map(mission => (
                                                <div key={mission.id} className="border border-slate-200 bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h5 className="font-bold text-slate-700 text-sm">{mission.title}</h5>
                                                            <div className="text-xs text-orange-600 mt-0.5">Thưởng: {mission.rewardGold} Vàng • {mission.rewardExp} Exp</div>
                                                        </div>
                                                        <Button size="sm" variant="outline" onClick={() => acceptMission(mission.id)}>
                                                            Nhận
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'LEADERBOARD' && (
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Bảng Xếp Hạng Tu Tiên</h3>
                            <div className="bg-white border rounded overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                                        <tr>
                                            <th className="p-3 w-12 text-center">#</th>
                                            <th className="p-3">Đạo Hữu</th>
                                            <th className="p-3">Cảnh Giới</th>
                                            <th className="p-3 text-right">Tu Vi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400 italic">Chưa có dữ liệu...</td>
                                            </tr>
                                        ) : (
                                            leaderboard.map((user, idx) => (
                                                <tr key={user.id} className="border-b last:border-0 hover:bg-yellow-50/50">
                                                    <td className="p-3 text-center font-bold text-slate-500">
                                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-800 flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                                            {user.image && <img src={user.image} alt="avatar" className="w-full h-full object-cover" />}
                                                        </div>
                                                        {user.name || 'Vô Danh'}
                                                        {user.id === session?.user?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded ml-1">Bạn</span>}
                                                    </td>
                                                    <td className="p-3 text-slate-600">{user.cultivationLevel}</td>
                                                    <td className="p-3 text-right font-mono text-blue-600">{user.cultivationExp.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'LOGS' && (
                        <div>
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">📝 Nhật Ký Hoạt Động</h3>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                {logs.length === 0 ? (
                                    <p className="text-slate-400 italic text-center py-4">Chưa có hoạt động nào...</p>
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="text-sm bg-slate-50 p-2 rounded border border-slate-100 flex justify-between gap-4">
                                            <span className="text-slate-700">{log.description}</span>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap" title={new Date(log.createdAt).toLocaleString()}>
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: vi })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'SECT' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-700 text-lg mb-4 flex items-center gap-2">⛩️ Tông Môn Thế Gia</h3>

                            {!state.user.sectId ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Join List */}
                                    <div>
                                        <h4 className="font-bold text-slate-600 mb-3">Danh Sách Tông Môn</h4>
                                        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200 max-h-[400px] overflow-y-auto">
                                            {sects.length === 0 ? (
                                                <p className="text-slate-400 italic text-sm text-center py-4">Chưa có tông môn nào...</p>
                                            ) : (
                                                sects.map(sect => (
                                                    <div key={sect.id} className="bg-white p-3 rounded shadow-sm border border-slate-100 flex justify-between items-center hover:bg-blue-50">
                                                        <div>
                                                            <div className="font-bold text-indigo-700">{sect.name}</div>
                                                            <div className="text-xs text-slate-500">{sect.description || "Không có mô tả"}</div>
                                                            <div className="text-[10px] text-slate-400 mt-1">Cấp {sect.level} • Tài nguyên: {sect.resources}</div>
                                                        </div>
                                                        <Button size="sm" onClick={() => joinSect(sect.id)}>Gia Nhập</Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Create Form */}
                                    <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                                        <h4 className="font-bold text-indigo-700 mb-3">Thành Lập Tông Môn</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">Tên Tông Môn</label>
                                                <input id="sectName" type="text" className="w-full border rounded p-2 text-sm mt-1" placeholder="Ví dụ: Thanh Vân Môn" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">Tôn Chỉ (Mô tả)</label>
                                                <input id="sectDesc" type="text" className="w-full border rounded p-2 text-sm mt-1" placeholder="Quy tụ anh tài..." />
                                            </div>
                                            <div className="text-xs text-slate-500">Phí thành lập: <span className="font-bold text-yellow-600">50,000 Vàng</span></div>
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => {
                                                const name = (document.getElementById('sectName') as HTMLInputElement).value;
                                                const desc = (document.getElementById('sectDesc') as HTMLInputElement).value;
                                                createSect(name, desc);
                                            }}>Khai Tông Lập Phái</Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // My Sect View
                                <div>
                                    {mySect ? (
                                        <div className="space-y-6">
                                            {/* Header Info */}
                                            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h2 className="text-3xl font-bold mb-1">{mySect.sect.name}</h2>
                                                            <p className="opacity-90 italic text-sm mb-4">{mySect.sect.description}</p>
                                                            <div className="flex gap-4 text-xs font-bold">
                                                                <span className="bg-white/20 px-2 py-1 rounded">Cấp {mySect.sect.level}</span>
                                                                <span className="bg-white/20 px-2 py-1 rounded">Tài nguyên: {mySect.sect.resources}</span>
                                                                <span className="bg-white/20 px-2 py-1 rounded">Thành viên: {mySect.members?.length}/20</span>
                                                            </div>
                                                        </div>
                                                        <Button variant="destructive" size="sm" onClick={leaveSect} className="bg-red-500/80 hover:bg-red-600 text-white border-0">
                                                            Rời Tông
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">⛩️</div>
                                            </div>

                                            {/* Members Grid */}
                                            <div>
                                                <h4 className="font-bold text-slate-700 mb-3">Thành Viên Tông Môn</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {mySect.members?.map((mem: any) => (
                                                        <div key={mem.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm">
                                                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                                                                {mem.image ? <img src={mem.image} alt={mem.name} className="w-full h-full object-cover" /> : '👤'}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                                                    {mem.name}
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${mem.role === 'LEADER' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>{mem.role}</span>
                                                                </div>
                                                                <div className="text-xs text-blue-600">{mem.cultivationLevel}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                                            <p className="text-slate-500">Đang tải thông tin tông môn...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PVP Tab */}
                    {activeTab === 'PVP' && (
                        <div className="space-y-6">
                            <div className="flex gap-2 border-b border-slate-200 pb-2">
                                <Button
                                    size="sm"
                                    variant={pvpSubTab === 'RAID' ? 'default' : 'ghost'}
                                    onClick={() => setPvpSubTab('RAID')}
                                    className={pvpSubTab === 'RAID' ? 'bg-red-600 text-white' : 'text-slate-600'}
                                >
                                    🏴‍☠️ Đánh Cướp
                                </Button>
                                <Button
                                    size="sm"
                                    variant={pvpSubTab === 'ARENA' ? 'default' : 'ghost'}
                                    onClick={() => setPvpSubTab('ARENA')}
                                    className={pvpSubTab === 'ARENA' ? 'bg-orange-600 text-white' : 'text-slate-600'}
                                >
                                    ⚔️ Lôi Đài
                                </Button>
                            </div>

                            {/* RAID SUB-TAB */}
                            {pvpSubTab === 'RAID' && (
                                <div className="space-y-6">
                                    {/* Protection Status */}
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-blue-800 flex items-center gap-2">
                                                🛡️ Hộ Thể Kim Quang
                                            </div>
                                            <div className="text-sm text-blue-600">
                                                {protection?.protectedUntil ? (
                                                    `Đang được bảo vệ đến ${new Date(protection.protectedUntil).toLocaleString()}`
                                                ) : (
                                                    "Bạn chưa có bảo hộ. Có thể bị tấn công bất cứ lúc nào!"
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right text-xs">
                                            <div className="font-bold">Lượt cướp còn lại: {3 - (protection?.raidsToday || 0)}/3</div>
                                            <div className="text-slate-500">Hồi phục lúc 00:00</div>
                                        </div>
                                    </div>

                                    {/* Raid Action */}
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-slate-700 mb-3">Tìm Mục Tiêu</h4>
                                        <div className="flex gap-2">
                                            <input id="raidTargetId" type="text" placeholder="Nhập ID người chơi..." className="flex-1 border rounded p-2 text-sm" />
                                            <Button variant="destructive" onClick={() => {
                                                const target = (document.getElementById('raidTargetId') as HTMLInputElement).value;
                                                handleRaid(target);
                                            }}>Cướp!</Button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 italic">* Cướp sẽ tốn 1000 vàng và có tỷ lệ thất bại nếu đối phương mạnh hơn.</p>
                                    </div>

                                    {/* Raid History */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-3">Lịch Sử Cướp Bóc</h4>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                            {raidLogs?.map(log => (
                                                <div key={log.id} className={`p-3 rounded border text-sm flex justify-between items-center ${log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                                    <div>
                                                        <span className="font-bold">{log.attackerId === state.user.id ? 'Bạn tấn công' : 'Bị tấn công bởi'}</span>
                                                        <span className="mx-1 text-slate-500">{log.attackerId === state.user.id ? log.victimId : log.attackerId}</span>
                                                    </div>
                                                    <div className="font-bold">
                                                        {log.success ? <span className="text-green-600">+{log.goldStolen} Gold</span> : <span className="text-red-500">Thất bại</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ARENA SUB-TAB */}
                            {pvpSubTab === 'ARENA' && (
                                <div className="space-y-6">
                                    {/* My Rank Info */}
                                    <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
                                        <div>
                                            <div className="text-sm opacity-90">Hạng Hiện Tại</div>
                                            <div className="text-3xl font-bold flex items-center gap-2">
                                                {myTier?.currentTier?.icon} {myTier?.currentTier?.tier}
                                            </div>
                                            <div className="text-xs mt-1 bg-white/20 px-2 py-1 rounded inline-block">
                                                Điểm: {myTier?.currentTier?.currentPoints || 0}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">{myTier?.seasonWins || 0}</div>
                                            <div className="text-xs opacity-80">Trận Thắng Mùa Này</div>
                                        </div>
                                    </div>

                                    {/* Find Match */}
                                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                        <div className="text-4xl mb-4">⚔️</div>
                                        <h3 className="text-xl font-bold text-slate-700 mb-2">Lôi Đài Tranh Bá</h3>
                                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">Tìm đối thủ có sức mạnh tương đương để so tài. Chiến thắng nhận Vàng, EXP và Điểm Xếp Hạng.</p>
                                        <Button size="lg" className="bg-orange-600 hover:bg-orange-700 font-bold px-8 shadow-lg shadow-orange-200" onClick={findArenaMatch}>
                                            Tìm Đối Thủ
                                        </Button>
                                    </div>

                                    {/* Battle History */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-3">Lịch Sử Đấu Trường</h4>
                                        <div className="space-y-2">
                                            {arenaBattles.map(battle => {
                                                const isWinner = battle.winnerId === state.user.id;
                                                return (
                                                    <div key={battle.id} className={`p-3 rounded flex justify-between items-center border ${isWinner ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-xl">{isWinner ? '🏆' : '💀'}</div>
                                                            <div>
                                                                <div className="font-bold text-sm">{isWinner ? 'Chiến Thắng' : 'Thất Bại'}</div>
                                                                <div className="text-[10px] text-slate-500">vs {battle.player1Id === state.user.id ? battle.player2Id : battle.player1Id}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`font-bold text-sm ${isWinner ? 'text-green-600' : 'text-slate-500'}`}>
                                                                {isWinner ? '+' : ''}{battle.player1Id === state.user.id ? battle.player1Reward : battle.player2Reward} Vàng
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">{new Date(battle.createdAt).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Leaderboard Tab */}
                    {activeTab === 'LEADERBOARD' && (
                        <div className="space-y-6">
                            <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-slate-100">
                                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Bảng Phong Thần</h2>
                                <p className="text-slate-500">Tính năng đang được cập nhật...</p>
                                <div className="mt-8 flex justify-center gap-4">
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 w-32">
                                        <div className="text-2xl">🥇</div>
                                        <div className="font-bold text-sm mt-1">Hạng 1</div>
                                        <div className="text-xs text-slate-400">Trống</div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 w-32">
                                        <div className="text-2xl">🥈</div>
                                        <div className="font-bold text-sm mt-1">Hạng 2</div>
                                        <div className="text-xs text-slate-400">Trống</div>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 w-32">
                                        <div className="text-2xl">🥉</div>
                                        <div className="font-bold text-sm mt-1">Hạng 3</div>
                                        <div className="text-xs text-slate-400">Trống</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Arena Modal */}
                    {arenaModalOpen && arenaOpponent && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => !arenaBattleLog.length && setArenaModalOpen(false)}>
                            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div className="bg-slate-900 text-white p-4 flex justify-center items-center relative">
                                    <h3 className="text-xl font-bold text-orange-400">Sàn Đấu Sinh Tử</h3>
                                    {!arenaResult && (
                                        <button onClick={() => setArenaModalOpen(false)} className="absolute right-4 text-slate-400 hover:text-white">✕</button>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="p-6 flex-1 overflow-y-auto">
                                    {!arenaResult && arenaBattleLog.length === 0 ? (
                                        // Match Found View
                                        <div className="text-center py-8">
                                            <div className="text-6xl mb-6">🆚</div>
                                            <h4 className="text-2xl font-bold text-slate-800 mb-2">Đã Tìm Thấy Đối Thủ!</h4>
                                            <div className="bg-slate-100 p-4 rounded-lg inline-block min-w-[200px] mb-8">
                                                <div className="font-bold text-lg text-indigo-700">{arenaOpponent.name}</div>
                                                <div className="text-sm text-slate-500">Tu vi: {arenaOpponent.cultivationExp} EXP</div>
                                            </div>

                                            <div className="flex justify-center gap-4">
                                                <Button variant="outline" onClick={() => setArenaModalOpen(false)}>Bỏ Qua</Button>
                                                <Button size="lg" className="bg-red-600 hover:bg-red-700 font-bold animate-pulse" onClick={startArenaBattle}>
                                                    ⚔️ BẮT ĐẦU CHIẾN ĐẤU
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Battle Log View
                                        <div className="space-y-4">
                                            <div className="space-y-2 font-mono text-sm max-h-[300px] overflow-y-auto bg-slate-900 text-green-400 p-4 rounded-lg">
                                                {arenaBattleLog.map((log, idx) => (
                                                    <div key={idx} className="border-b border-white/10 pb-1 mb-1 last:border-0">
                                                        <span className="text-yellow-500">[Hiệp {log.turn}]</span>
                                                        <span className="text-blue-400"> Bạn</span> gây {log.p1Damage} st,
                                                        <span className="text-red-400"> Địch</span> gây {log.p2Damage} st.
                                                        <div className="text-slate-500 text-xs text-right">HP: {log.p1HP} vs {log.p2HP}</div>
                                                    </div>
                                                ))}
                                                {arenaResult && (
                                                    <div className="pt-2 text-center font-bold text-yellow-400 text-lg border-t border-white/20 mt-4">
                                                        KẾT THÚC TRẬN ĐẤU
                                                    </div>
                                                )}
                                            </div>

                                            {arenaResult && (
                                                <div className="text-center animate-in zoom-in duration-500">
                                                    <div className="text-6xl mb-4">{arenaResult.winnerId === state.user.id ? '🏆' : '💀'}</div>
                                                    <h3 className={`text-3xl font-bold mb-2 ${arenaResult.winnerId === state.user.id ? 'text-yellow-600' : 'text-slate-600'}`}>
                                                        {arenaResult.winnerId === state.user.id ? 'CHIẾN THẮNG VINH QUANG!' : 'THẤT BẠI THẢM HẠI'}
                                                    </h3>

                                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 inline-block w-full max-w-sm mx-auto">
                                                        <div className="grid grid-cols-3 gap-2 text-center">
                                                            <div>
                                                                <div className="text-xs text-slate-500">Vàng</div>
                                                                <div className="font-bold text-yellow-600">+{arenaResult.rewards.winner.gold}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-slate-500">EXP</div>
                                                                <div className="font-bold text-blue-600">+{arenaResult.rewards.winner.exp}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-slate-500">Điểm</div>
                                                                <div className="font-bold text-orange-600">+{arenaResult.rewards.winner.points}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-6">
                                                        <Button size="lg" onClick={() => setArenaModalOpen(false)}>Đóng</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Beast Encounter Modal */}
            {beastEncounter && beastModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { }}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
                        {/* Beast Info */}
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-3">{beastEncounter.beast.icon || '👾'}</div>
                            <h2 className="text-2xl font-bold text-red-600">{beastEncounter.beast.name}</h2>
                            <p className="text-sm text-slate-600 mt-1">{beastEncounter.beast.description}</p>
                        </div>

                        {/* Health Bar */}
                        <div className="mb-6">
                            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                                <span>Máu quái</span>
                                <span>{beastEncounter.encounter.beastHealth} / {beastEncounter.beast.health}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-red-500 h-full transition-all"
                                    style={{ width: `${(beastEncounter.encounter.beastHealth / beastEncounter.beast.health) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                <div className="text-xs text-slate-500 font-medium">Tấn công</div>
                                <div className="text-lg font-bold text-red-600">{beastEncounter.beast.attack}</div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <div className="text-xs text-slate-500 font-medium">Phòng thủ</div>
                                <div className="text-lg font-bold text-blue-600">{beastEncounter.beast.defense}</div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                                onClick={attackBeast}
                            >
                                ⚔️ Tấn Công
                            </Button>
                            <Button
                                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white"
                                onClick={fleeBeast}
                            >
                                🏃 Trốn Thoát
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
