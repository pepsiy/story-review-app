export const ITEM_TYPES = {
    SEED: 'SEED',
    PRODUCT: 'PRODUCT', // Harvested item
    CONSUMABLE: 'CONSUMABLE', // Pills
};

export const ITEMS: Record<string, { id: string, name: string, type: string, price?: number, growTime?: number, exp?: number, sellPrice?: number }> = {
    // Seeds
    'seed_linh_thao': { id: 'seed_linh_thao', name: 'Hạt Linh Thảo', type: ITEM_TYPES.SEED, price: 10, growTime: 60 }, // 60s for testing
    'seed_nhan_sam': { id: 'seed_nhan_sam', name: 'Hạt Nhân Sâm', type: ITEM_TYPES.SEED, price: 50, growTime: 300 },

    // Products
    'herb_linh_thao': { id: 'herb_linh_thao', name: 'Linh Thảo', type: ITEM_TYPES.PRODUCT, sellPrice: 5, exp: 5 },
    'herb_nhan_sam': { id: 'herb_nhan_sam', name: 'Nhân Sâm', type: ITEM_TYPES.PRODUCT, sellPrice: 20, exp: 30 },

    // Pills
    'pill_truc_co': { id: 'pill_truc_co', name: 'Trúc Cơ Đan', type: ITEM_TYPES.CONSUMABLE, price: 1000, exp: 500, sellPrice: 200 },
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
};

export const CULTIVATION_LEVELS = [
    { name: 'Phàm Nhân', exp: 0, breakthroughChance: 1.0 },
    { name: 'Luyện Khí', exp: 100, breakthroughChance: 0.9 }, // To Trúc Cơ
    { name: 'Trúc Cơ', exp: 1000, breakthroughChance: 0.7 }, // To Kim Đan
    { name: 'Kim Đan', exp: 5000, breakthroughChance: 0.5 }, // To Nguyên Anh
    { name: 'Nguyên Anh', exp: 20000, breakthroughChance: 0.3 }, // To Hóa Thần
    { name: 'Hóa Thần', exp: 100000, breakthroughChance: 0.1 }, // To Luyện Hư
];
