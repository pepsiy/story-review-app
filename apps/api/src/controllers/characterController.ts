import { Request, Response } from 'express';
// Fix relative path to local monorepo package
import { db } from "../../../../packages/db/src";
import { users, inventory } from "../../../../packages/db/src";
import { eq, and } from 'drizzle-orm';
import { STAMINA_CONFIG, CULTIVATION_LEVELS, ITEMS, ITEM_TYPES } from '../data/gameData';

export const syncStamina = async (userId: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) return null;

    const now = new Date();
    const lastUpdate = user.lastStaminaUpdate || now;
    const elapsedMs = now.getTime() - lastUpdate.getTime();

    // Config: 5 mins per point
    const regenRate = STAMINA_CONFIG.REGEN_RATE_MS;
    const maxStamina = user.maxStamina || STAMINA_CONFIG.MAX_DEFAULT;

    // Only regen if not full
    if ((user.stamina || 0) < maxStamina) {
        const regenPoints = Math.floor(elapsedMs / regenRate);

        if (regenPoints > 0) {
            const newStamina = Math.min(maxStamina, (user.stamina || 0) + regenPoints);
            // Update time preventing drift, but reset to Now if full to avoid "banking" time
            const newLastUpdate = newStamina >= maxStamina
                ? now
                : new Date(lastUpdate.getTime() + (regenPoints * regenRate));

            await db.update(users)
                .set({
                    stamina: newStamina,
                    lastStaminaUpdate: newLastUpdate
                })
                .where(eq(users.id, userId));

            // Return updated values
            return { ...user, stamina: newStamina, lastStaminaUpdate: newLastUpdate };
        }
    }

    return user;
};

export const getCharacterProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        // Sync Stamina First
        const user = await syncStamina(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Calculate Derived Stats
        const str = user.statStr || 0;
        const agi = user.statAgi || 0;
        const int = user.statInt || 0;
        const vit = user.statVit || 0;

        // Level Bonus
        const levelIndex = CULTIVATION_LEVELS.findIndex(l => l.name === user.cultivationLevel);
        const levelBonus = (levelIndex >= 0 ? levelIndex : 0) * 10;

        // Equipment Bonus
        const equippedItems = await db.query.inventory.findMany({
            where: and(
                eq(inventory.userId, userId),
                eq(inventory.isEquipped, true)
            )
        });

        let equipStr = 0; // If we have stats on items
        let equipAttack = 0;
        let equipDefense = 0;
        let equipHp = 0;
        let equipSpeed = 0;

        const equipmentMap: Record<string, any> = {};

        for (const item of equippedItems) {
            const itemDef = ITEMS[item.itemId];
            if (itemDef) {
                // Determine slot based on type
                let slot = 'unknown';
                if (itemDef.type === ITEM_TYPES.WEAPON) slot = 'weapon';
                if (itemDef.type === ITEM_TYPES.ARMOR) slot = 'armor';
                if (itemDef.type === ITEM_TYPES.ACCESSORY) slot = 'accessory';

                equipmentMap[slot] = { ...itemDef, instanceId: item.id };

                if (itemDef.stats) {
                    if (itemDef.stats.attack) equipAttack += itemDef.stats.attack;
                    if (itemDef.stats.defense) equipDefense += itemDef.stats.defense;
                    if (itemDef.stats.hp) equipHp += itemDef.stats.hp;
                    if (itemDef.stats.speed) equipSpeed += itemDef.stats.speed;
                }
            }
        }

        const derivedStats = {
            attack: (str * 2) + levelBonus + equipAttack,
            magicAttack: (int * 2) + levelBonus, // Add magic weapon later
            defense: (vit * 1) + (str * 0.5) + (levelBonus / 2) + equipDefense,
            speed: (agi * 1) + equipSpeed,
            hpMax: (vit * 10) + (levelBonus * 50) + 100 + equipHp,
            critChance: (agi * 0.1) + (int * 0.05), // %
            dodgeChance: (agi * 0.1), // %
        };

        return res.json({
            stats: {
                str, agi, int, vit,
                points: user.statPoints
            },
            resources: {
                stamina: user.stamina,
                maxStamina: user.maxStamina,
                hp: user.currentHealth,
                maxHp: user.maxHealth || derivedStats.hpMax // Sync if needed
            },
            derived: derivedStats,
            cultivation: {
                level: user.cultivationLevel,
                exp: user.cultivationExp
            },
            equipment: equipmentMap
        });

    } catch (error) {
        console.error('getCharacterProfile error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const distributeStatPoints = async (req: Request, res: Response) => {
    try {
        const { userId, stat, amount } = req.body; // stat: 'str'|'agi'|'int'|'vit', amount: number

        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if ((user.statPoints || 0) < amount) {
            return res.status(400).json({ error: 'Not enough stat points' });
        }

        const updateData: any = {
            statPoints: (user.statPoints || 0) - amount
        };

        switch (stat) {
            case 'str': updateData.statStr = (user.statStr || 0) + amount; break;
            case 'agi': updateData.statAgi = (user.statAgi || 0) + amount; break;
            case 'int': updateData.statInt = (user.statInt || 0) + amount; break;
            case 'vit': updateData.statVit = (user.statVit || 0) + amount; break;
            default: return res.status(400).json({ error: 'Invalid stat type' });
        }

        await db.update(users)
            .set(updateData)
            .where(eq(users.id, userId));

        return res.json({ success: true, message: `Added ${amount} points to ${stat.toUpperCase()}` });

    } catch (error) {
        console.error('distributeStatPoints error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const equipItem = async (req: Request, res: Response) => {
    try {
        const { userId, inventoryId } = req.body;

        if (!userId || !inventoryId) return res.status(400).json({ error: 'Missing parameters' });

        // Check item ownership
        const item = await db.query.inventory.findFirst({
            where: and(eq(inventory.id, inventoryId), eq(inventory.userId, userId))
        });

        if (!item) return res.status(404).json({ error: 'Item not found' });

        const itemDef = ITEMS[item.itemId];
        if (!itemDef) return res.status(400).json({ error: 'Invalid item definition' });

        if (![ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.ACCESSORY].includes(itemDef.type)) {
            return res.status(400).json({ error: 'Item is not equippable' });
        }

        // Unequip current item in same slot
        // Filter inventory by userId, isEquipped=true
        const equippedItems = await db.query.inventory.findMany({
            where: and(eq(inventory.userId, userId), eq(inventory.isEquipped, true))
        });

        // Find item to unequip
        for (const equipped of equippedItems) {
            const equippedDef = ITEMS[equipped.itemId];
            if (equippedDef && equippedDef.type === itemDef.type) {
                await db.update(inventory)
                    .set({ isEquipped: false })
                    .where(eq(inventory.id, equipped.id));
            }
        }

        // Equip new item
        await db.update(inventory)
            .set({ isEquipped: true })
            .where(eq(inventory.id, inventoryId));

        return res.json({ success: true, message: `Equipped ${itemDef.name}` });

    } catch (error) {
        console.error('equipItem error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const unequipItem = async (req: Request, res: Response) => {
    try {
        const { userId, slot } = req.body; // slot: 'weapon' | 'armor' | 'accessory'

        // ... This is harder because we need to find the item by slot.
        // Simplified: Pass inventoryId to unequip
    } catch (e) { }
};

export const unequipItemById = async (req: Request, res: Response) => {
    try {
        const { userId, inventoryId } = req.body;

        if (!userId || !inventoryId) return res.status(400).json({ error: 'Missing parameters' });

        await db.update(inventory)
            .set({ isEquipped: false })
            .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId)));

        return res.json({ success: true, message: 'Unequipped' });
    } catch (error) {
        console.error('unequipItem error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
