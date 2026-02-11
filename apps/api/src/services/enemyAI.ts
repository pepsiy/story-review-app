// Phase 33: Turn-Based Combat - Enemy AI Service
// AI decision-making logic for enemy turns

import { CombatStats, Skill, canUseSkill } from './damageCalculator';

export interface EnemySkillConfig {
    skill: Skill;
    usageRate: number; // 0-100 probability
    minTurn: number;
}

export type AIPattern = 'aggressive' | 'defensive' | 'balanced';

export interface AIDecision {
    action: 'attack' | 'skill';
    skillId?: string;
    reasoning?: string; // For debugging
}

/**
 * Decide enemy action based on AI pattern, HP, and available skills
 */
export function decideEnemyAction(
    enemy: CombatStats,
    player: CombatStats,
    availableSkills: EnemySkillConfig[],
    currentTurn: number,
    aiPattern: AIPattern,
    cooldowns: Record<string, number>
): AIDecision {
    const hpPercent = (enemy.hp / enemy.maxHp) * 100;

    // Filter usable skills (mana, cooldown, min turn)
    const usableSkills = availableSkills.filter(config => {
        if (currentTurn < config.minTurn) return false;
        const { canUse } = canUseSkill(enemy, config.skill, cooldowns);
        return canUse;
    });

    // === CRITICAL HP: Prioritize healing/defensive skills ===
    if (hpPercent < 30) {
        const healSkill = usableSkills.find(c =>
            c.skill.effects?.some(e => e.type === 'heal')
        );
        if (healSkill) {
            return {
                action: 'skill',
                skillId: healSkill.skill.id,
                reasoning: 'Low HP - using heal skill'
            };
        }

        const defensiveSkill = usableSkills.find(c =>
            c.skill.effects?.some(e => e.type === 'buff' && e.stat === 'defense')
        );
        if (defensiveSkill && Math.random() < 0.7) {
            return {
                action: 'skill',
                skillId: defensiveSkill.skill.id,
                reasoning: 'Low HP - boosting defense'
            };
        }
    }

    // === NO USABLE SKILLS: Default to normal attack ===
    if (usableSkills.length === 0) {
        return { action: 'attack', reasoning: 'No skills available' };
    }

    // === AI PATTERN LOGIC ===
    let skillChance = 0.5; // Base 50%

    switch (aiPattern) {
        case 'aggressive':
            skillChance = 0.80; // 80% use skills
            break;
        case 'defensive':
            skillChance = 0.40; // 40% use skills
            break;
        case 'balanced':
            skillChance = 0.60; // 60% use skills
            break;
    }

    // Adjust based on player HP (aggressive when player is low)
    const playerHpPercent = (player.hp / player.maxHp) * 100;
    if (playerHpPercent < 40 && aiPattern === 'aggressive') {
        skillChance += 0.15; // Go for the kill
    }

    // Roll for skill usage
    if (Math.random() < skillChance) {
        // Select skill based on usage rates (weighted random)
        const selectedSkill = weightedRandomSkill(usableSkills);
        return {
            action: 'skill',
            skillId: selectedSkill.skill.id,
            reasoning: `AI Pattern: ${aiPattern}, HP: ${hpPercent.toFixed(0)}%`
        };
    }

    // Fall back to normal attack
    return { action: 'attack', reasoning: 'Random roll chose normal attack' };
}

/**
 * Weighted random selection based on usage rates
 */
function weightedRandomSkill(skills: EnemySkillConfig[]): EnemySkillConfig {
    const totalWeight = skills.reduce((sum, s) => sum + s.usageRate, 0);
    let random = Math.random() * totalWeight;

    for (const skillConfig of skills) {
        random -= skillConfig.usageRate;
        if (random <= 0) {
            return skillConfig;
        }
    }

    // Fallback (should never happen)
    return skills[0];
}

/**
 * Get AI personality description for UI
 */
export function getAIPatternDescription(pattern: AIPattern): string {
    switch (pattern) {
        case 'aggressive':
            return 'Hung Hãn - Ưu tiên tấn công';
        case 'defensive':
            return 'Thận Trọng - Ưu tiên phòng thủ';
        case 'balanced':
            return 'Cân Bằng - Linh hoạt chiến thuật';
        default:
            return 'Không rõ';
    }
}
