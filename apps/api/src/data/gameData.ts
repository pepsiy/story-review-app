export const ITEM_TYPES = {
    SEED: 'SEED',
    PRODUCT: 'PRODUCT', // Harvested item
    CONSUMABLE: 'CONSUMABLE', // Pills
    WEAPON: 'WEAPON',
    ARMOR: 'ARMOR',
    ACCESSORY: 'ACCESSORY'
};

export const ITEMS: Record<string, {
    id: string, name: string, type: string, element?: string,
    price?: number, growTime?: number, exp?: number, sellPrice?: number, description?: string,
    stats?: { attack?: number, defense?: number, hp?: number, speed?: number }
}> = {
    // Equipment - Weapons
    'weapon_wood_sword': {
        id: 'weapon_wood_sword', name: 'Mộc Kiếm', type: ITEM_TYPES.WEAPON, element: 'WOOD',
        price: 100, sellPrice: 20, description: "Kiếm làm bằng gỗ, dành cho người mới luyện tập.",
        stats: { attack: 10 }
    },
    'weapon_iron_sword': {
        id: 'weapon_iron_sword', name: 'Thiết Kiếm', type: ITEM_TYPES.WEAPON, element: 'METAL',
        price: 500, sellPrice: 100, description: "Kiếm rèn từ sắt thường, sắc bén hơn gỗ.",
        stats: { attack: 25 }
    },

    // Equipment - Armors
    'armor_cloth': {
        id: 'armor_cloth', name: 'Áo Vải Thô', type: ITEM_TYPES.ARMOR, element: 'WOOD',
        price: 100, sellPrice: 20, description: "Áo vải bình thường, che chắn chút ít.",
        stats: { defense: 5, hp: 20 }
    },
    'armor_leather': {
        id: 'armor_leather', name: 'Giáp Da Thú', type: ITEM_TYPES.ARMOR, element: 'EARTH',
        price: 600, sellPrice: 120, description: "Giáp làm từ da thú, khá bền.",
        stats: { defense: 15, hp: 50 }
    },

    // Seeds
    'seed_linh_thao': { id: 'seed_linh_thao', name: 'Hạt Linh Thảo', type: ITEM_TYPES.SEED, price: 10, growTime: 300 }, // 5 mins
    'seed_nhan_sam': { id: 'seed_nhan_sam', name: 'Hạt Nhân Sâm', type: ITEM_TYPES.SEED, price: 50, growTime: 1800 }, // 30 mins

    // Products
    'herb_linh_thao': { id: 'herb_linh_thao', name: 'Linh Thảo', type: ITEM_TYPES.PRODUCT, sellPrice: 15, exp: 5 }, // Profit 50%
    'herb_nhan_sam': { id: 'herb_nhan_sam', name: 'Nhân Sâm', type: ITEM_TYPES.PRODUCT, sellPrice: 80, exp: 30 }, // Profit 60%

    // Pills
    'pill_truc_co': { id: 'pill_truc_co', name: 'Trúc Cơ Đan', type: ITEM_TYPES.CONSUMABLE, price: 1000, exp: 500, sellPrice: 200 },

    // Special
    'item_talisman_protect': { id: 'item_talisman_protect', name: 'Hộ Thân Phù', type: ITEM_TYPES.CONSUMABLE, price: 5000, description: "Tăng 30% tỉ lệ thành công khi độ kiếp và giảm phạt thất bại.", sellPrice: 2500 },
    'item_array_basic': { id: 'item_array_basic', name: 'Trận Pháp Cơ Bản', type: ITEM_TYPES.CONSUMABLE, price: 500, description: "Bảo vệ vườn thuốc khỏi đạo tặc trong 4 giờ.", sellPrice: 50 },
};

// Recipes for Alchemy
export const RECIPES: Record<string, { ingredients: { itemId: string, quantity: number }[], cost: number }> = {
    'pill_truc_co': {
        ingredients: [
            { itemId: 'herb_linh_thao', quantity: 10 },
            { itemId: 'herb_nhan_sam', quantity: 2 }
        ],
        cost: 100 // Cost 100 Gold to craft
    }
};

export const ELEMENTS = {
    METAL: { name: 'Kim', icon: '⚔️', weakness: 'FIRE', strength: 'WOOD' },
    WOOD: { name: 'Mộc', icon: '🌲', weakness: 'METAL', strength: 'EARTH' },
    WATER: { name: 'Thủy', icon: '💧', weakness: 'EARTH', strength: 'FIRE' },
    FIRE: { name: 'Hỏa', icon: '🔥', weakness: 'WATER', strength: 'METAL' },
    EARTH: { name: 'Thổ', icon: '⛰️', weakness: 'WOOD', strength: 'WATER' }
};

// Config costs for unlocking slots (Index 0-2 are free)
export const PLOT_UNLOCK_COSTS: Record<number, number> = {
    3: 1000,
    4: 5000,
    5: 20000,
    6: 50000,
    7: 100000,
    8: 500000
};

export const WATER_CONFIG = {
    REDUCTION_PERCENT: 0.1, // 10% reduction per water
    MAX_WATER_PER_CROP: 3,
    COOLDOWN_MS: 15 * 60 * 1000, // 15 Minutes
};

export const STAMINA_CONFIG = {
    REGEN_RATE_MS: 5 * 60 * 1000, // 5 Minutes per point
    REGEN_AMOUNT: 1,
    MAX_DEFAULT: 100,
};

export const CULTIVATION_LEVELS = [
    { name: 'Phàm Nhân', exp: 0, breakthroughChance: 1.0 },
    { name: 'Luyện Khí', exp: 100, breakthroughChance: 0.9 }, // To Trúc Cơ
    { name: 'Trúc Cơ', exp: 1000, breakthroughChance: 0.7 }, // To Kim Đan
    { name: 'Kim Đan', exp: 5000, breakthroughChance: 0.5 }, // To Nguyên Anh
    { name: 'Nguyên Anh', exp: 20000, breakthroughChance: 0.3 }, // To Hóa Thần
    { name: 'Hóa Thần', exp: 100000, breakthroughChance: 0.1 }, // To Luyện Hư
];

export const DAILY_MISSIONS = [
    {
        id: 'mission_daily_login',
        title: 'Điểm Danh',
        description: 'Đăng nhập vào game',
        type: 'SYSTEM',
        rewardGold: 20,
        rewardExp: 0
    },
    {
        id: 'mission_daily_water',
        title: 'Nông Dân Chăm Chỉ',
        description: 'Tưới nước cho cây 5 lần',
        type: 'PROGRESS',
        requiredAction: 'WATER',
        requiredCount: 5,
        rewardGold: 50,
        rewardExp: 10
    },
    {
        id: 'mission_daily_harvest',
        title: 'Thu Hoạch Vụ Mùa',
        description: 'Thu hoạch 10 cây bất kỳ',
        type: 'PROGRESS',
        requiredAction: 'HARVEST',
        requiredCount: 10,
        rewardGold: 100,
        rewardExp: 20
    }
];

export const BEASTS = [
    {
        id: 'beast_wolf',
        name: 'Sói Hoang',
        description: 'Đàn sói hung dữ xuất hiện trong rừng sâu',
        health: 100,
        attack: 15,
        defense: 5,
        icon: '🐺',
        lootTable: [
            { itemId: 'herb_linh_thao', quantity: 3, chance: 0.7 },
            { itemId: 'seed_linh_chi', quantity: 1, chance: 0.3 }
        ]
    },
    {
        id: 'beast_tiger',
        name: 'Hổ Núi',
        description: 'Hổ núi cấp trung, rất nguy hiểm',
        health: 250,
        attack: 30,
        defense: 10,
        icon: '🐯',
        lootTable: [
            { itemId: 'pill_basic', quantity: 2, chance: 0.6 },
            { itemId: 'herb_linh_thao', quantity: 5, chance: 0.5 }
        ]
    },
    {
        id: 'beast_dragon',
        name: 'Giao Long',
        description: 'Rồng giao huyền thoại, cực kỳ mạnh mẽ',
        health: 500,
        attack: 50,
        defense: 20,
        icon: '🐲',
        lootTable: [
            { itemId: 'pill_rare', quantity: 1, chance: 0.8 },
            { itemId: 'item_array_basic', quantity: 1, chance: 0.4 }
        ]
    }
];

export const RAID_SETTINGS = {
    DAILY_LIMIT: 3,
    GOLD_COST: 1000,
    SUCCESS_CHANCE_BASE: 0.5, // 50% base
    LEVEL_ADVANTAGE_BONUS: 0.1, // +10% per level difference in attacker's favor
    STEAL_PERCENTAGE: 0.15, // 15% of victim's gold
    PROTECTION_COOLDOWN_HOURS: 3
};

export const ARENA_SETTINGS = {
    WINNER_POINTS: 50,
    LOSER_POINTS: -20,
    WINNER_GOLD: 2000,
    LOSER_GOLD: 200,
    WINNER_EXP: 500,
    LOSER_EXP: 50,
    MAX_TURNS: 10
};

export const RANKING_TIERS = [
    { tier: 'BRONZE', minPoints: 0, icon: '🥉', rewardGold: 1000 },
    { tier: 'SILVER', minPoints: 1000, icon: '🥈', rewardGold: 5000 },
    { tier: 'GOLD', minPoints: 3000, icon: '🥇', rewardGold: 15000 },
    { tier: 'DIAMOND', minPoints: 7000, icon: '💎', rewardGold: 50000 },
    { tier: 'LEGEND', minPoints: 15000, icon: '👑', rewardGold: 100000 }
];

export const TRAINING_MAPS: Record<string, {
    id: string;
    name: string;
    description: string;
    reqLevel: number; // Cultivation Level Index (0: Phàm Nhân, 1: Luyện Khí...)
    reqChapterId?: number; // Optional: Require reading a chapter
    expPerMin: number;
    rewards: { itemId: string, chance: number, quantity: number }[];
    // Phase 32: AFK Animation fields
    enemyName: string;
    enemyIcon: string;
    killRate: number; // Kills per minute
    goldPerKill: number;
    expPerKill: number;
}> = {
    'map_forest_1': {
        id: 'map_forest_1',
        name: 'Rừng Sơ Nhập',
        description: 'Khu rừng yên tĩnh, thích hợp cho người mới bắt đầu thiền định.',
        reqLevel: 0,
        expPerMin: 5,
        rewards: [
            { itemId: 'herb_linh_thao', chance: 0.3, quantity: 1 },
            { itemId: 'seed_linh_thao', chance: 0.1, quantity: 1 }
        ],
        enemyName: 'Sói Hoang',
        enemyIcon: '🐺',
        killRate: 12, // 12 kills/min = 1 kill per 5 seconds
        goldPerKill: 5,
        expPerKill: 3
    },
    'map_cave_1': {
        id: 'map_cave_1',
        name: 'Hang Động Bí Ẩn',
        description: 'Nơi linh khí hội tụ, nhưng có nhiều dơi độc.',
        reqLevel: 1, // Luyện Khí
        expPerMin: 15,
        rewards: [
            { itemId: 'herb_nhan_sam', chance: 0.2, quantity: 1 },
            { itemId: 'seed_nhan_sam', chance: 0.05, quantity: 1 }
        ],
        enemyName: 'Dơi Ma',
        enemyIcon: '🦇',
        killRate: 10,
        goldPerKill: 10,
        expPerKill: 8
    },
    'map_mountain_1': {
        id: 'map_mountain_1',
        name: 'Đỉnh Núi Tuyết',
        description: 'Lạnh giá thấu xương, rèn luyện ý chí.',
        reqLevel: 2, // Trúc Cơ
        expPerMin: 50,
        rewards: [
            { itemId: 'item_talisman_protect', chance: 0.01, quantity: 1 }
        ],
        enemyName: 'Yêu Ma Băng',
        enemyIcon: '❄️',
        killRate: 6,
        goldPerKill: 25,
        expPerKill: 20
    }
};
