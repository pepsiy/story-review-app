'use client';

interface SkillCardProps {
    skill: {
        id: string;
        name: string;
        description?: string;
        tier: string;
        element: string;
        manaCost: number;
        cooldown: number;
        damageMultiplier: number;
    };
    isEquipped?: boolean;
    onEquip?: () => void;
    onUnequip?: () => void;
}

const TIER_COLORS = {
    pham: 'from-gray-500 to-gray-600',
    huyen: 'from-green-500 to-green-600',
    dia: 'from-blue-500 to-blue-600',
    thien: 'from-purple-500 to-purple-600',
    than: 'from-amber-500 to-orange-600'
};

const TIER_NAMES = {
    pham: 'Phàm Cấp',
    huyen: 'Huyền Cấp',
    dia: 'Địa Cấp',
    thien: 'Thiên Cấp',
    than: 'Thần Cấp'
};

const ELEMENT_ICONS: Record<string, string> = {
    fire: '🔥',
    water: '💧',
    wind: '💨',
    earth: '🪨',
    lightning: '⚡',
    ice: '❄️',
    dark: '🌑',
    light: '✨',
    neutral: '⚪'
};

export function SkillCard({ skill, isEquipped, onEquip, onUnequip }: SkillCardProps) {
    const tierColor = TIER_COLORS[skill.tier as keyof typeof TIER_COLORS] || TIER_COLORS.pham;
    const tierName = TIER_NAMES[skill.tier as keyof typeof TIER_NAMES] || skill.tier;
    const elementIcon = ELEMENT_ICONS[skill.element] || '⚪';

    return (
        <div className={`bg-slate-800 rounded-lg border-2 p-4 transition-all hover:scale-105 ${isEquipped ? 'border-amber-400 shadow-lg shadow-amber-500/50' : 'border-slate-600 hover:border-slate-400'
            }`}>
            {/* Header: Name + Tier Badge */}
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                    {elementIcon} {skill.name}
                </h4>
                <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${tierColor} text-white font-semibold`}>
                    {tierName}
                </span>
            </div>

            {/* Description */}
            {skill.description && (
                <p className="text-gray-400 text-sm mb-3">{skill.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="flex items-center gap-1">
                    <span className="text-blue-300">💧 Mana:</span>
                    <span className="text-white font-semibold">{skill.manaCost}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-purple-300">⏱️ Hồi:</span>
                    <span className="text-white font-semibold">{skill.cooldown} lượt</span>
                </div>
                <div className="flex items-center gap-1 col-span-2">
                    <span className="text-red-300">⚔️ Sát thương:</span>
                    <span className="text-white font-semibold">{skill.damageMultiplier}%</span>
                </div>
            </div>

            {/* Action Button */}
            {isEquipped && onUnequip && (
                <button
                    onClick={onUnequip}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                    Gỡ Trang Bị
                </button>
            )}
            {!isEquipped && onEquip && (
                <button
                    onClick={onEquip}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                    Trang Bị
                </button>
            )}
        </div>
    );
}
