// Phase 33: Turn-Based Combat - Skill Book Drops Service
// Calculate skill book drop rates based on enemy type and level

export type SkillRarity = 'pham' | 'huyen' | 'dia' | 'thien' | 'than';

export interface SkillBookDrop {
    bookId: string;
    skillId: string;
    name: string;
    rarity: SkillRarity;
    icon: string;
}

export interface DropRateConfig {
    baseDropRate: number; // 0-1 (0.15 = 15%)
    rarityWeights: Record<SkillRarity, number>;
}

/**
 * Drop rate configurations by enemy type
 */
const DROP_CONFIGS: Record<string, DropRateConfig> = {
    normal: {
        baseDropRate: 0.15, // 15% chance
        rarityWeights: {
            pham: 60,
            huyen: 30,
            dia: 9,
            thien: 1,
            than: 0
        }
    },
    elite: {
        baseDropRate: 0.35, // 35% chance
        rarityWeights: {
            pham: 20,
            huyen: 50,
            dia: 25,
            thien: 5,
            than: 0
        }
    },
    boss: {
        baseDropRate: 0.80, // 80% chance
        rarityWeights: {
            pham: 0,
            huyen: 10,
            dia: 40,
            thien: 40,
            than: 10
        }
    }
};

/**
 * Determine if a skill book should drop
 */
export function shouldDropSkillBook(enemyType: 'normal' | 'elite' | 'boss'): boolean {
    const config = DROP_CONFIGS[enemyType];
    return Math.random() < config.baseDropRate;
}

/**
 * Generate skill book drop
 */
export function generateSkillBookDrop(
    enemyType: 'normal' | 'elite' | 'boss',
    enemyElement: string | null,
    allSkillBooks: SkillBookDrop[]
): SkillBookDrop | null {
    if (!shouldDropSkillBook(enemyType)) {
        return null;
    }

    const config = DROP_CONFIGS[enemyType];

    // Select rarity based on weights
    const rarity = weightedRandomRarity(config.rarityWeights);

    // Filter eligible books (matching rarity, optionally matching element)
    let eligibleBooks = allSkillBooks.filter(book => book.rarity === rarity);

    // Prefer books matching enemy element (70% chance)
    if (enemyElement && Math.random() < 0.7) {
        const elementBooks = eligibleBooks.filter(book =>
            book.skillId.includes(enemyElement)
        );
        if (elementBooks.length > 0) {
            eligibleBooks = elementBooks;
        }
    }

    if (eligibleBooks.length === 0) {
        return null;
    }

    // Random selection from eligible books
    return eligibleBooks[Math.floor(Math.random() * eligibleBooks.length)];
}

/**
 * Weighted random rarity selection
 */
function weightedRandomRarity(weights: Record<SkillRarity, number>): SkillRarity {
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            return rarity as SkillRarity;
        }
    }

    return 'pham'; // Fallback
}

/**
 * Get rarity display info for UI
 */
export function getRarityInfo(rarity: SkillRarity): {
    name: string;
    color: string;
    glow: string;
} {
    const rarityMap = {
        pham: { name: 'Phàm Cấp', color: '#9CA3AF', glow: '#6B7280' },
        huyen: { name: 'Huyền Cấp', color: '#10B981', glow: '#059669' },
        dia: { name: 'Địa Cấp', color: '#3B82F6', glow: '#2563EB' },
        thien: { name: 'Thiên Cấp', color: '#8B5CF6', glow: '#7C3AED' },
        than: { name: 'Thần Cấp', color: '#F59E0B', glow: '#D97706' }
    };

    return rarityMap[rarity] || rarityMap.pham;
}

/**
 * Calculate guaranteed gold/EXP rewards (separate from skill book drops)
 */
export function calculateCombatRewards(
    enemyLevel: number,
    enemyType: 'normal' | 'elite' | 'boss',
    playerLevel: number
): {
    gold: number;
    exp: number;
} {
    const levelDiff = enemyLevel - playerLevel;
    const baseMultiplier = 1 + Math.max(0, levelDiff * 0.1); // +10% per level above player

    let typeMultiplier = 1.0;
    switch (enemyType) {
        case 'elite':
            typeMultiplier = 2.0;
            break;
        case 'boss':
            typeMultiplier = 5.0;
            break;
    }

    const baseGold = 10 + (enemyLevel * 5);
    const baseExp = 20 + (enemyLevel * 10);

    return {
        gold: Math.floor(baseGold * baseMultiplier * typeMultiplier),
        exp: Math.floor(baseExp * baseMultiplier * typeMultiplier)
    };
}
