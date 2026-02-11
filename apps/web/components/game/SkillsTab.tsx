'use client';

import { useState, useEffect } from 'react';
import { SkillCard } from './SkillCard';
import { Sparkles } from 'lucide-react';

interface SkillsTabProps {
    userId: string;
}

export function SkillsTab({ userId }: SkillsTabProps) {
    const [learnedSkills, setLearnedSkills] = useState<any[]>([]);
    const [equippedSlots, setEquippedSlots] = useState<(string | null)[]>([null, null, null, null]);
    const [loading, setLoading] = useState(true);

    // Fetch user's learned skills
    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const res = await fetch(`${API_URL}/game/skills?userId=${userId}`);
                if (!res.ok) throw new Error('Failed to fetch skills');

                const data = await res.json();
                setLearnedSkills(data.skills || []);
                setEquippedSlots(data.equippedSlots || [null, null, null, null]);
                setLoading(false);
            } catch (error) {
                console.error('fetchSkills error:', error);
                setLoading(false);
            }
        };

        fetchSkills();
    }, [userId]);

    // Equip skill to slot
    const equipSkill = async (skillId: string, slot: number) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/game/skills/equip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, skillId, slot })
            });

            if (!res.ok) throw new Error('Failed to equip skill');

            const updatedSlots = [...equippedSlots];
            updatedSlots[slot] = skillId;
            setEquippedSlots(updatedSlots);
        } catch (error) {
            console.error('equipSkill error:', error);
            alert('Không thể trang bị skill!');
        }
    };

    // Unequip skill from slot
    const unequipSkill = async (slot: number) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/game/skills/unequip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, slot })
            });

            if (!res.ok) throw new Error('Failed to unequip skill');

            const updatedSlots = [...equippedSlots];
            updatedSlots[slot] = null;
            setEquippedSlots(updatedSlots);
        } catch (error) {
            console.error('unequipSkill error:', error);
            alert('Không thể gỡ skill!');
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-400">Đang tải kỹ năng...</p>
            </div>
        );
    }

    const equippedSkillIds = equippedSlots.filter(s => s !== null);

    return (
        <div className="p-6 space-y-6">
            {/* Equipped Skills Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="text-amber-400" size={24} />
                    Kỹ Năng Đang Trang Bị
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {equippedSlots.map((skillId, index) => {
                        const skill = learnedSkills.find(s => s.id === skillId);

                        if (skill) {
                            return (
                                <div key={index} className="relative">
                                    <div className="absolute top-2 left-2 bg-amber-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center z-10">
                                        {index + 1}
                                    </div>
                                    <SkillCard
                                        skill={skill}
                                        isEquipped={true}
                                        onUnequip={() => unequipSkill(index)}
                                    />
                                </div>
                            );
                        }

                        // Empty slot
                        return (
                            <div
                                key={index}
                                className="border-2 border-dashed border-gray-600 rounded-lg p-4 h-48 flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 transition-colors"
                            >
                                <div className="bg-gray-700 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mb-2">
                                    {index + 1}
                                </div>
                                <p className="text-sm">Chưa trang bị</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Learned Skills Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4">
                    📚 Kỹ Năng Đã Học ({learnedSkills.length})
                </h3>

                {learnedSkills.length === 0 ? (
                    <div className="text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-gray-400">Bạn chưa học kỹ năng nào!</p>
                        <p className="text-sm text-gray-500 mt-2">Đánh bại quái vật để nhặt Bí Kíp và học kỹ năng mới.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {learnedSkills.map(skill => (
                            <SkillCard
                                key={skill.id}
                                skill={skill}
                                isEquipped={equippedSkillIds.includes(skill.id)}
                                onEquip={() => {
                                    const emptySlot = equippedSlots.findIndex(s => s === null);
                                    if (emptySlot !== -1) {
                                        equipSkill(skill.id, emptySlot);
                                    } else {
                                        alert('Tất cả slot đã đầy! Gỡ skill khác trước.');
                                    }
                                }}
                                onUnequip={() => {
                                    const slotIndex = equippedSlots.findIndex(s => s === skill.id);
                                    if (slotIndex !== -1) unequipSkill(slotIndex);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Tutorial Hint */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                <h4 className="text-blue-300 font-semibold mb-2">💡 Mẹo:</h4>
                <ul className="text-sm text-blue-200 space-y-1">
                    <li>• Bạn có thể trang bị tối đa 4 kỹ năng cùng lúc</li>
                    <li>• Kỹ năng có Cooldown sẽ cần hồi chiêu sau khi sử dụng</li>
                    <li>• Kỹ năng hệ có lợi thế gây 150% sát thương!</li>
                    <li>• Bí Kíp rơi ngẫu nhiên khi đánh quái (15-80% tùy loại)</li>
                </ul>
            </div>
        </div>
    );
}
