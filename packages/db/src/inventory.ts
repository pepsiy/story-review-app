import { pgTable, serial, text, integer, boolean } from 'drizzle-orm/pg-core';

// Game Inventory Table
export const inventory = pgTable('inventory', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemId: text('item_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    type: text('type').notNull(), // SEED, CROP, ITEM, WEAPON, ARMOR, ACCESSORY  
    isEquipped: boolean('is_equipped').default(false),
});
