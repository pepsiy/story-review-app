// Phase 33: Turn-Based Combat - Damage Calculator Service
// Handles combat damage calculations with crit, dodge, and elemental modifiers

export interface CombatStats {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    attack: number;
    defense: number;
    critRate: number;    // 0-100
    critDamage: number;  // 150 = 150% (1.5x)
    dodgeRate: number;   // 0-100
    element: string | null;
}

export interface Skill {
    id: string;
    name: string;
    element: string;
    manaCost: number;
    damageMultiplier: number; // 150 = 1.5x
    effects?: SkillEffect[];
}

export interface SkillEffect {
    type: 'buff' | 'debuff' | 'heal';
    stat: string; // 'attack' | 'defense' | 'hp' | 'dodge' | 'crit_rate' | 'crit_damage'
    value: number;
    duration: number; // Turns
}

export interface DamageResult {
    damage: number;
    isCrit: boolean;
    isDodge: boolean;
    elementModifier: number; // 0.5 | 1.0 | 1.5
    elementAdvantage: 'weak' | 'neutral' | 'strong' | null;
}

/**
 * Element advantage mapping
 * Each element lists which elements it is strong against
 */
const ELEMENT_ADVANTAGES: Record<string, string[]> = {
    fire: ['wind', 'ice'],
    water: ['fire'],
    wind: ['earth'],
    earth: ['lightning'],
    lightning: ['water'],
    ice: ['water', 'wind'],
    light: ['dark'],
    dark: ['light']
};

/**
 * Calculate element damage modifier
 * @returns 1.5 (advantage), 1.0 (neutral), or 0.5 (disadvantage)
 */
export function getElementModifier(attackElement: string | null, defenseElement: string | null): {
    modifier: number;
    advantage: 'weak' | 'neutral' | 'strong' | null;
} {
    if (!attackElement || attackElement === 'neutral' || !defenseElement) {
        return { modifier: 1.0, advantage: null };
    }

    // Check if attacker has advantage
    if (ELEMENT_ADVANTAGES[attackElement]?.includes(defenseElement)) {
        return { modifier: 1.5, advantage: 'strong' };
    }

    // Check if defender has advantage (attacker is weak)
    if (ELEMENT_ADVANTAGES[defenseElement]?.includes(attackElement)) {
        return { modifier: 0.5, advantage: 'weak' };
    }

    return { modifier: 1.0, advantage: 'neutral' };
}

/**
 * Calculate damage for an attack
 */
export function calculateDamage(
    attacker: CombatStats,
    defender: CombatStats,
    skill: Skill | null, // null = normal attack  
    isPlayerTurn: boolean
): DamageResult {
    // 1. Base damage calculation
    const skillMultiplier = skill ? skill.damageMultiplier / 100 : 1.0;
    const defenseMitigation = defender.defense * 0.5;
    let baseDamage = (attacker.attack * skillMultiplier) - defenseMitigation;

    // 2. Dodge check (defender)
    const dodgeRoll = Math.random() * 100;
    if (dodgeRoll < defender.dodgeRate) {
        return {
            damage: 0,
            isCrit: false,
            isDodge: true,
            elementModifier: 1.0,
            elementAdvantage: null
        };
    }

    // 3. Element modifier
    const skillElement = skill?.element || attacker.element;
    const { modifier: elementMod, advantage: elementAdv } = getElementModifier(skillElement, defender.element);
    baseDamage *= elementMod;

    // 4. Crit check (attacker)
    const critRoll = Math.random() * 100;
    const isCrit = critRoll < attacker.critRate;
    if (isCrit) {
        baseDamage *= (attacker.critDamage / 100);
    }

    // 5. Final damage (min 1)
    const finalDamage = Math.max(1, Math.floor(baseDamage));

    return {
        damage: finalDamage,
        isCrit,
        isDodge: false,
        elementModifier: elementMod,
        elementAdvantage: elementAdv
    };
}

/**
 * Apply skill effects (buffs/debuffs/heals) to a combatant
 */
export function applySkillEffects(
    target: CombatStats,
    effects: SkillEffect[],
    currentBuffs: ActiveBuff[]
): { updatedStats: CombatStats, updatedBuffs: ActiveBuff[] } {
    const updatedStats = { ...target };
    const newBuffs: ActiveBuff[] = [];

    for (const effect of effects) {
        if (effect.type === 'heal') {
            // Immediate heal
            updatedStats.hp = Math.min(updatedStats.maxHp, updatedStats.hp + effect.value);
        } else {
            // Add buff/debuff with duration
            newBuffs.push({
                stat: effect.stat,
                value: effect.value,
                duration: effect.duration,
                type: effect.type
            });
        }
    }

    return {
        updatedStats,
        updatedBuffs: [...currentBuffs, ...newBuffs]
    };
}

export interface ActiveBuff {
    stat: string;
    value: number; // +10 for buff, -10 for debuff
    duration: number; // Turns remaining
    type: 'buff' | 'debuff';
}

/**
 * Apply active buffs to combat stats (for display/calculation)
 */
export function applyBuffsToStats(baseStats: CombatStats, buffs: ActiveBuff[]): CombatStats {
    const modifiedStats = { ...baseStats };

    for (const buff of buffs) {
        if (buff.duration > 0) {
            switch (buff.stat) {
                case 'attack':
                    modifiedStats.attack += buff.value;
                    break;
                case 'defense':
                    modifiedStats.defense += buff.value;
                    break;
                case 'crit_rate':
                    modifiedStats.critRate += buff.value;
                    break;
                case 'crit_damage':
                    modifiedStats.critDamage += buff.value;
                    break;
                case 'dodge':
                    modifiedStats.dodgeRate += buff.value;
                    break;
            }
        }
    }

    return modifiedStats;
}

/**
 * Decrement buff/debuff durations at end of turn
 */
export function decrementBuffDurations(buffs: ActiveBuff[]): ActiveBuff[] {
    return buffs
        .map(buff => ({ ...buff, duration: buff.duration - 1 }))
        .filter(buff => buff.duration > 0);
}

/**
 * Validate if attacker has enough mana to use skill
 */
export function canUseSkill(attacker: CombatStats, skill: Skill, cooldowns: Record<string, number>): {
    canUse: boolean;
    reason?: string;
} {
    if (attacker.mana < skill.manaCost) {
        return { canUse: false, reason: 'Không đủ mana' };
    }

    if (cooldowns[skill.id] && cooldowns[skill.id] > 0) {
        return { canUse: false, reason: `Skill đang hồi (còn ${cooldowns[skill.id]} lượt)` };
    }

    return { canUse: true };
}
