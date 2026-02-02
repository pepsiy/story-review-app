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
    'pill_truc_co': { id: 'pill_truc_co', name: 'Trúc Cơ Đan', type: ITEM_TYPES.CONSUMABLE, price: 1000, exp: 500 },
};

export const CULTIVATION_LEVELS = [
    { name: 'Phàm Nhân', exp: 0 },
    { name: 'Luyện Khí', exp: 100 },
    { name: 'Trúc Cơ', exp: 1000 },
    { name: 'Kim Đan', exp: 5000 },
    { name: 'Nguyên Anh', exp: 20000 },
    { name: 'Hóa Thần', exp: 100000 },
];
