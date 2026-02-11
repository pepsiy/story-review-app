'use client';

import { useState, useEffect } from 'react';
import { X, Sword, Sparkles, Package, Running } from 'lucide-react';

interface CombatModalProps {
    userId: string;
    enemyId: string;
    onClose: () => void;
    onVictory?: (rewards: any) => void;
}

interface CombatState {
    sessionId: string;
    turn: number;
    player: {
        hp: number;
        maxHp: number;
        mana: number;
        maxMana: number;
        attack: number;
        defense: number;
        critRate: number;
        element: string | null;
        equippedSkills: Skill[];
    };
    enemy: {
        name: string;
        hp: number;
        maxHp: number;
        mana: number;
        maxMana: number;
        icon: string;
        element: string | null;
        aiPattern: string;
    };
    playerBuffs: any[];
    enemyBuffs: any[];
    playerCooldowns: Record<string, number>;
    combatLog: CombatLogEntry[];
}

interface Skill {
    id: string;
    name: string;
    element: string;
    manaCost: number;
    damageMultiplier: number;
    cooldown: number;
}

interface CombatLogEntry {
    turn: number;
    actor: 'player' | 'enemy' | 'system';
    action?: string;
    skillName?: string;
    damage?: number;
    isCrit?: boolean;
    isDodge?: boolean;
    message: string;
}

export function CombatModal({ userId, enemyId, onClose, onVictory }: CombatModalProps) {
    const [combat, setCombat] = useState<CombatState | null>(null);
    const [selectedAction, setSelectedAction] = useState<'attack' | 'skill' | 'item' | null>(null);
    const [loading, setLoading] = useState(false);
    const [animating, setAnimating] = useState(false);

    // Initialize combat
    useEffect(() => {
        const initCombat = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const res = await fetch(`${API_URL}/game/combat/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, enemyId })
                });

                if (!res.ok) throw new Error('Failed to start combat');
                const data = await res.json();

                setCombat({
                    sessionId: data.sessionId,
                    turn: data.turn,
                    player: data.player,
                    enemy: data.enemy,
                    playerBuffs: [],
                    enemyBuffs: [],
                    playerCooldowns: {},
                    combatLog: [{ turn: 0, actor: 'system', message: `Chiến đấu với ${data.enemy.name} bắt đầu!` }]
                });
            } catch (error) {
                console.error('initCombat error:', error);
                alert('Không thể khởi tạo chiến đấu!');
                onClose();
            }
        };

        initCombat();
    }, [userId, enemyId]);

    // Execute action
    const executeAction = async (action: string, skillId?: string) => {
        if (!combat || animating) return;

        setLoading(true);
        setAnimating(true);

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/game/combat/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: combat.sessionId, action, skillId })
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.error || 'Action failed');
                setLoading(false);
                setAnimating(false);
                return;
            }

            const data = await res.json();

            // Handle combat end
            if (data.result === 'victory') {
                setTimeout(() => {
                    alert(`Chiến thắng! Nhận ${data.rewards.gold} gold, ${data.rewards.exp} EXP!`);
                    onVictory?.(data.rewards);
                    onClose();
                }, 1000);
                return;
            }

            if (data.result === 'defeat') {
                setTimeout(() => {
                    alert(`Bại trận! Mất ${data.expLost} EXP.`);
                    onClose();
                }, 1000);
                return;
            }

            if (data.result === 'fled') {
                alert(`Trốn thoát thành công! Mất ${data.expLost} EXP.`);
                onClose();
                return;
            }

            // Update combat state
            setCombat(prev => prev ? {
                ...prev,
                turn: data.turn,
                player: { ...prev.player, hp: data.playerHp, mana: data.playerMana },
                enemy: { ...prev.enemy, hp: data.enemyHp, mana: data.enemyMana },
                playerBuffs: data.playerBuffs || [],
                enemyBuffs: data.enemyBuffs || [],
                playerCooldowns: data.playerCooldowns || {},
                combatLog: [...prev.combatLog, ...data.combatLog.slice(-2)]
            } : null);

            setTimeout(() => {
                setAnimating(false);
                setLoading(false);
                setSelectedAction(null);
            }, 1500);

        } catch (error) {
            console.error('executeAction error:', error);
            alert('Lỗi khi thực hiện hành động!');
            setLoading(false);
            setAnimating(false);
        }
    };

    if (!combat) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-slate-800 p-8 rounded-lg">
                    <p className="text-white">Đang khởi tạo chiến đấu...</p>
                </div>
            </div>
        );
    }

    const playerHpPercent = (combat.player.hp / combat.player.maxHp) * 100;
    const enemyHpPercent = (combat.enemy.hp / combat.enemy.maxHp) * 100;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-4 border-amber-500/30">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-900 to-orange-900 p-4 flex justify-between items-center border-b-4 border-amber-500">
                    <h2 className="text-2xl font-bold text-white">⚔️ Chiến Đấu - Lượt {combat.turn}</h2>
                    <button onClick={onClose} className="text-white hover:text-red-300">
                        <X size={32} />
                    </button>
                </div>

                {/* Enemy Section */}
                <div className="p-6 bg-gradient-to-b from-red-950/30 to-transparent">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2">{combat.enemy.icon} {combat.enemy.name}</h3>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden border-2 border-red-500">
                                    <div
                                        className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-500"
                                        style={{ width: `${enemyHpPercent}%` }}
                                    />
                                </div>
                                <span className="text-white font-bold min-w-[100px]">{combat.enemy.hp}/{combat.enemy.maxHp}</span>
                            </div>
                            {combat.enemy.element && (
                                <p className="text-sm text-amber-300 mt-1">Hệ: {combat.enemy.element}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Combat Log */}
                <div className="px-6 py-4 bg-black/30 max-h-32 overflow-y-auto">
                    {combat.combatLog.slice(-5).map((log, idx) => (
                        <p key={idx} className={`text-sm mb-1 ${log.actor === 'player' ? 'text-cyan-300' :
                                log.actor === 'enemy' ? 'text-red-300' :
                                    'text-gray-400'
                            }`}>
                            {log.message}
                        </p>
                    ))}
                </div>

                {/* Player Section */}
                <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Bạn</h3>
                    <div className="space-y-2 mb-4">
                        {/* HP Bar */}
                        <div className="flex gap-2 items-center">
                            <span className="text-white font-semibold min-w-[60px]">HP:</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden border-2 border-green-500">
                                <div
                                    className="bg-gradient-to-r from-green-600 to-green-400 h-full transition-all duration-500"
                                    style={{ width: `${playerHpPercent}%` }}
                                />
                            </div>
                            <span className="text-white font-bold min-w-[100px]">{combat.player.hp}/{combat.player.maxHp}</span>
                        </div>

                        {/* Mana Bar */}
                        <div className="flex gap-2 items-center">
                            <span className="text-white font-semibold min-w-[60px]">Mana:</span>
                            <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden border-2 border-blue-500">
                                <div
                                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-500"
                                    style={{ width: `${(combat.player.mana / combat.player.maxMana) * 100}%` }}
                                />
                            </div>
                            <span className="text-white font-bold min-w-[100px]">{combat.player.mana}/{combat.player.maxMana}</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {!selectedAction && (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => executeAction('attack')}
                                disabled={loading || animating}
                                className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
                            >
                                <Sword size={20} /> Tấn Công
                            </button>

                            <button
                                onClick={() => setSelectedAction('skill')}
                                disabled={loading || animating}
                                className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
                            >
                                <Sparkles size={20} /> Kỹ Năng
                            </button>

                            <button
                                disabled
                                className="bg-gradient-to-r from-gray-600 to-gray-500 opacity-50 cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2"
                            >
                                <Package size={20} /> Vật Phẩm
                            </button>

                            <button
                                onClick={() => executeAction('flee')}
                                disabled={loading || animating}
                                className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
                            >
                                <Running size={20} /> Trốn Thoát
                            </button>
                        </div>
                    )}

                    {/* Skill Selection */}
                    {selectedAction === 'skill' && (
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-white font-bold">Chọn Kỹ Năng:</h4>
                                <button onClick={() => setSelectedAction(null)} className="text-gray-400 hover:text-white">
                                    Quay lại
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {combat.player.equippedSkills.map(skill => {
                                    const onCooldown = combat.playerCooldowns[skill.id] > 0;
                                    const insufficientMana = combat.player.mana < skill.manaCost;
                                    const disabled = onCooldown || insufficientMana;

                                    return (
                                        <button
                                            key={skill.id}
                                            onClick={() => executeAction('skill', skill.id)}
                                            disabled={disabled || loading || animating}
                                            className={`p-3 rounded-lg border-2 text-left transition-all ${disabled
                                                    ? 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'
                                                    : 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-400 hover:border-purple-300'
                                                }`}
                                        >
                                            <p className="font-bold text-white">{skill.name}</p>
                                            <p className="text-xs text-blue-200">Mana: {skill.manaCost}</p>
                                            {onCooldown && (
                                                <p className="text-xs text-red-300">Hồi: {combat.playerCooldowns[skill.id]} lượt</p>
                                            )}
                                            {insufficientMana && !onCooldown && (
                                                <p className="text-xs text-red-300">Không đủ mana</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
