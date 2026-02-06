import { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../../../packages/db/src";
import { users, beasts, userBeastEncounters, inventory, gameLogs } from "../../../../packages/db/src";

// Spawn a beast encounter for a user
export const spawnBeast = async (userId: string, beastId: string) => {
    try {
        // Check if user already has an active encounter
        const activeEncounter = await db.query.userBeastEncounters.findFirst({
            where: and(
                eq(userBeastEncounters.userId, userId),
                eq(userBeastEncounters.status, 'ACTIVE')
            )
        });

        if (activeEncounter) {
            return { success: false, message: "User already has an active beast encounter" };
        }

        // Get beast definition
        const beast = await db.query.beasts.findFirst({
            where: eq(beasts.id, beastId)
        });

        if (!beast) {
            return { success: false, message: "Beast not found" };
        }

        // Create encounter
        await db.insert(userBeastEncounters).values({
            userId,
            beastId,
            beastHealth: beast.health,
            status: 'ACTIVE'
        });

        // Log event
        await db.insert(gameLogs).values({
            userId,
            action: 'BEAST_SPAWN',
            description: `${beast.name} đã xuất hiện!`
        });

        return { success: true, beast };
    } catch (error) {
        console.error("Spawn Beast Error:", error);
        return { success: false, message: "Internal error" };
    }
};

// Get current active encounter
export const getActiveEncounter = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const encounter = await db.select({
            encounter: userBeastEncounters,
            beast: beasts
        })
            .from(userBeastEncounters)
            .innerJoin(beasts, eq(userBeastEncounters.beastId, beasts.id))
            .where(and(
                eq(userBeastEncounters.userId, userId),
                eq(userBeastEncounters.status, 'ACTIVE')
            ))
            .limit(1);

        if (encounter.length === 0) {
            return res.json({ encounter: null });
        }

        res.json({ encounter: encounter[0] });
    } catch (error) {
        console.error("Get Encounter Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Attack beast
export const attackBeast = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        // Get active encounter
        const encounterData = await db.select({
            encounter: userBeastEncounters,
            beast: beasts
        })
            .from(userBeastEncounters)
            .innerJoin(beasts, eq(userBeastEncounters.beastId, beasts.id))
            .where(and(
                eq(userBeastEncounters.userId, userId),
                eq(userBeastEncounters.status, 'ACTIVE')
            ))
            .limit(1);

        if (encounterData.length === 0) {
            return res.status(404).json({ error: "No active encounter" });
        }

        const { encounter, beast } = encounterData[0];

        // Get user stats
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        // Calculate player damage (based on cultivation exp)
        const baseDamage = Math.floor((user.cultivationExp || 0) / 100);
        const randomBonus = Math.floor(Math.random() * 20) + 10;
        const playerDamage = baseDamage + randomBonus;

        // Apply damage to beast
        const newBeastHealth = Math.max(0, encounter.beastHealth - playerDamage);

        // Check if beast is defeated
        if (newBeastHealth <= 0) {
            // Victory! Distribute loot
            const lootTable = beast.lootTable ? JSON.parse(beast.lootTable) : [];
            const lootReceived: any[] = [];

            for (const loot of lootTable) {
                const roll = Math.random();
                if (roll <= loot.chance) {
                    // Add to inventory
                    const existingItem = await db.query.inventory.findFirst({
                        where: and(
                            eq(inventory.userId, userId),
                            eq(inventory.itemId, loot.itemId)
                        )
                    });

                    if (existingItem) {
                        await db.update(inventory)
                            .set({ quantity: existingItem.quantity + loot.quantity })
                            .where(eq(inventory.id, existingItem.id));
                    } else {
                        // Determine type (simplified, ideally fetch from gameItems)
                        await db.insert(inventory).values({
                            userId,
                            itemId: loot.itemId,
                            quantity: loot.quantity,
                            type: 'PRODUCT' // Default, should be fetched from item def
                        });
                    }

                    lootReceived.push(loot);
                }
            }

            // Update encounter to VICTORY
            await db.update(userBeastEncounters)
                .set({
                    beastHealth: 0,
                    status: 'VICTORY',
                    completedAt: new Date()
                })
                .where(eq(userBeastEncounters.id, encounter.id));

            // Log victory
            await db.insert(gameLogs).values({
                userId,
                action: 'BEAST_DEFEAT',
                description: `Đã đánh bại ${beast.name}!`
            });

            return res.json({
                success: true,
                result: 'VICTORY',
                playerDamage,
                beastHealth: 0,
                loot: lootReceived
            });
        }

        // Beast still alive, update health
        await db.update(userBeastEncounters)
            .set({ beastHealth: newBeastHealth })
            .where(eq(userBeastEncounters.id, encounter.id));

        // Beast counter-attack (simplified, no user health for now)
        const beastDamage = beast.attack;

        res.json({
            success: true,
            result: 'CONTINUE',
            playerDamage,
            beastDamage,
            beastHealth: newBeastHealth
        });
    } catch (error) {
        console.error("Attack Beast Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Flee from beast
export const fleeBeast = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID required" });

        const encounter = await db.query.userBeastEncounters.findFirst({
            where: and(
                eq(userBeastEncounters.userId, userId),
                eq(userBeastEncounters.status, 'ACTIVE')
            )
        });

        if (!encounter) {
            return res.status(404).json({ error: "No active encounter" });
        }

        // Update status to FLED
        await db.update(userBeastEncounters)
            .set({
                status: 'FLED',
                completedAt: new Date()
            })
            .where(eq(userBeastEncounters.id, encounter.id));

        // Log flee
        await db.insert(gameLogs).values({
            userId,
            action: 'BEAST_FLEE',
            description: `Đã trốn khỏi quái vật`
        });

        res.json({ success: true, message: "Escaped from beast" });
    } catch (error) {
        console.error("Flee Beast Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
