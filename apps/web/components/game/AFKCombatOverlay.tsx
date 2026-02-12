import { useEffect, useState, useRef } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { FloatingDamage } from './FloatingDamage';

interface AFKCombatOverlayProps {
    userId: string;
    mapId: string;
    onComplete?: () => void;
}

interface CombatLog {
    id: string;
    enemyName: string;
    gold: number;
    exp: number;
}

interface RealtimeProgress {
    isTraining: boolean;
    mapId: string;
    mapName: string;
    enemyName: string;
    enemyIcon: string;
    totalKills: number;
    goldEarned: number;
    expEarned: number;
    elapsedSeconds: number;
    killRate: number;
    goldPerKill: number;
    expPerKill: number;
}

export function AFKCombatOverlay({ userId, mapId, onComplete }: AFKCombatOverlayProps) {
    const [progress, setProgress] = useState<RealtimeProgress | null>(null);
    const [combatLog, setCombatLog] = useState<CombatLog[]>([]);
    const [floatingEffects, setFloatingEffects] = useState<Array<{ id: string, type: 'damage' | 'gold' | 'exp', value: number }>>([]);
    const prevKillsRef = useRef(0);

    useEffect(() => {
        const pollProgress = async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                const API_URL = baseUrl.replace(/\/$/, ""); // Remove trailing slash if present
                const fullUrl = `${API_URL}/game/training/realtime-progress?userId=${userId}`;
                // console.log("Fetching AFK progress:", fullUrl); // Debug log

                const res = await fetch(fullUrl);

                if (!res.ok) {
                    const text = await res.text();
                    console.error(`AFK Overlay Error: ${res.status} ${res.statusText}`, text);
                    return;
                }

                const data: RealtimeProgress = await res.json();

                if (!data.isTraining) {
                    onComplete?.();
                    return;
                }

                setProgress(data);

                // Check for new kills
                if (prevKillsRef.current === 0 && data.totalKills > 0) {
                    // First load with existing kills - skip animation
                    prevKillsRef.current = data.totalKills;
                } else if (data.totalKills > prevKillsRef.current) {
                    const newKills = data.totalKills - prevKillsRef.current;

                    // Limit animations if too many (e.g. heavy lag spike or tab background)
                    const killsToAnimate = Math.min(newKills, 5);

                    for (let i = 0; i < killsToAnimate; i++) {
                        // Add combat log entry
                        setCombatLog(prev => [{
                            id: `${Date.now()}-${i}`,
                            enemyName: data.enemyName,
                            gold: data.goldPerKill,
                            exp: data.expPerKill
                        }, ...prev].slice(0, 10)); // Keep last 10

                        // Add floating effects
                        setFloatingEffects(prev => [
                            ...prev,
                            { id: `dmg-${Date.now()}-${i}`, type: 'damage', value: Math.floor(Math.random() * 50) + 50 },
                            { id: `gold-${Date.now()}-${i}`, type: 'gold', value: data.goldPerKill },
                            { id: `exp-${Date.now()}-${i}`, type: 'exp', value: data.expPerKill }
                        ]);

                        // Remove effects after animation
                        setTimeout(() => {
                            setFloatingEffects(prev => prev.filter(e => !e.id.includes(`${Date.now()}-${i}`)));
                        }, 1000);
                    }

                    prevKillsRef.current = data.totalKills;
                }
            } catch (error) {
                console.error('Poll error:', error);
            }
        };

        // Initial poll
        pollProgress();

        // Poll every 2 seconds
        const interval = setInterval(pollProgress, 2000);

        return () => clearInterval(interval);
    }, [userId, onComplete]);

    if (!progress) return null;

    const killProgress = (progress.elapsedSeconds % (60 / progress.killRate)) / (60 / progress.killRate);

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-300 rounded-xl p-6 animate-fade-in">
            {/* Combat Arena */}
            <div className="relative h-48 bg-gradient-to-b from-sky-200 to-green-200 rounded-lg mb-4 overflow-hidden">
                {/* Character */}
                <div className="absolute left-8 top-1/2 -translate-y-1/2 text-6xl animate-attack">
                    🧙‍♂️
                </div>

                {/* Enemy */}
                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-6xl animate-hit">
                    {progress.enemyIcon}
                </div>

                {/* Floating Effects */}
                {floatingEffects.map(effect => (
                    <FloatingDamage
                        key={effect.id}
                        id={effect.id}
                        type={effect.type}
                        value={effect.value}
                    />
                ))}

                {/* Kill Progress Bar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-2/3">
                    <div className="bg-white/50 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-green-500 h-full transition-all duration-500"
                            style={{ width: `${killProgress * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Real-Time Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white/80 rounded-lg p-3 text-center">
                    <div className="text-yellow-600 font-bold text-xl">
                        <AnimatedNumber value={progress.goldEarned} /> 💰
                    </div>
                    <div className="text-xs text-slate-500">Vàng</div>
                </div>
                <div className="bg-white/80 rounded-lg p-3 text-center">
                    <div className="text-blue-600 font-bold text-xl">
                        <AnimatedNumber value={progress.expEarned} /> ⚡
                    </div>
                    <div className="text-xs text-slate-500">EXP</div>
                </div>
                <div className="bg-white/80 rounded-lg p-3 text-center">
                    <div className="text-green-600 font-bold text-xl">
                        <AnimatedNumber value={progress.totalKills} /> 💀
                    </div>
                    <div className="text-xs text-slate-500">Kills</div>
                </div>
            </div>

            {/* Combat Log */}
            <div className="bg-white/60 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="text-xs font-bold text-slate-600 mb-2">⚔️ Combat Log</div>
                <div className="space-y-1">
                    {combatLog.map(log => (
                        <div key={log.id} className="text-xs text-slate-700 animate-slide-in">
                            Đã tiêu diệt <span className="font-bold">{log.enemyName}</span> +{log.gold}💰 +{log.exp}⚡
                        </div>
                    ))}
                    {combatLog.length === 0 && (
                        <div className="text-xs text-slate-400 italic">Chờ chiến đấu...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
