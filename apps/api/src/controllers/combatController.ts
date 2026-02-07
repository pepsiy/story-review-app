
import { Request, Response } from 'express';
// Fix relative path
import { db } from "../../../../packages/db/src";
import { users, inventory } from "../../../../packages/db/src";
import { eq, and } from 'drizzle-orm';
import { BEASTS, CULTIVATION_LEVELS, ELEMENTS } from '../data/gameData';

// Helper: Check Elemental Advantage
// Returns: 1 (Neutral), 1.5 (Advantage), 0.5 (Disadvantage)
const checkElementAdvantage = (atkElement?: string, defElement?: string) => {
    if (!atkElement || !defElement) return 1;

    // Cast to any to avoid strict indexing issues with simple string dict
    const elementsInfo = ELEMENTS as any;

    // Check Strong
    if (elementsInfo[atkElement]?.strength === defElement) return 1.5;

    // Check Weak
    if (elementsInfo[atkElement]?.weakness === defElement) return 0.5;

    return 1;
};

// Helper to calculate damage
const calculateDamage = (attacker: any, defender: any) => {
    // Basic formula
    const attack = attacker.attack || 10;
    const defense = defender.defense || 0;

    // Elemental Mult
    const elementMult = checkElementAdvantage(attacker.element, defender.element);

    // Damage = Attack * (100 / (100 + Defense))
    let damage = Math.floor(attack * (100 / (100 + defense)));

    // Apply Element
    damage = Math.floor(damage * elementMult);

    // Variance +/- 10%
    const variance = 0.9 + Math.random() * 0.2;
    damage = Math.floor(damage * variance);

    return { damage: Math.max(1, damage), elementMult };
};

export const startCombat = async (req: Request, res: Response) => {
    try {
        const { userId, type, targetId } = req.body; // type: 'PVE', targetId: beast_id
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.combatStatus === 'IN_COMBAT') {
            // Return existing state if already in combat????
            // For now, reset or return error. Let's return error.
            // Actually, if client crashed, we want to resume.
            if (user.combatState) {
                return res.json({ success: true, combatState: JSON.parse(user.combatState) });
            }
        }

        let enemy: any = null;
        if (type === 'PVE') {
            const beastDef = BEASTS.find(b => b.id === targetId) as any; // Cast to any to access new element prop
            if (!beastDef) return res.status(400).json({ error: 'Beast not found' });
            enemy = {
                id: beastDef.id,
                name: beastDef.name,
                fullHp: beastDef.health,
                hp: beastDef.health,
                stats: { attack: beastDef.attack, defense: beastDef.defense, speed: 10 },
                icon: beastDef.icon,
                element: beastDef.element // Add Element
            };
        } else {
            return res.status(400).json({ error: 'PVP not supported yet' });
        }

        // Initialize Combat State
        // Recalculate User Stats here to be safe (or passed from client? No, backend calc)
        // Simplified: Use saved stats or recalc.
        // For security, should recalc.
        // Quick calc based on Attributes
        // Re-using logic from characterController is best, but for now duplicate simple version
        // TODO: Import calculateDerivedStats

        // Mock User Stats for now equal to attributes * mult
        const userStats = {
            attack: (user.cultivationExp || 0) / 100 + 10, // Dummy
            defense: (user.cultivationExp || 0) / 200 + 5,
            hp: 100 + (user.cultivationExp || 0) / 10,
            speed: 10,
            element: 'METAL' // Default Element for Player (or based on Root/Weapon)
            // TODO: Fetch from Weapon
        };
        // Actually, we should use the updated stats from character profile.
        // Let's assume frontend sends basic stats or we fetch full profile?
        // Fetching full profile is heavy.
        // Let's just trust basic scaling for now or fetch equipment.
        // IMPROVEMENT: Fetch equipment here.

        const combatState = {
            enemy,
            userHp: 100, // Should be MaxHP
            userMaxHp: 100,
            turnCount: 1,
            logs: [{ text: `Bạn đụng độ ${enemy.name}!`, type: 'info' }]
        };

        await db.update(users)
            .set({
                combatStatus: 'IN_COMBAT',
                combatState: JSON.stringify(combatState)
            })
            .where(eq(users.id, userId));

        return res.json({ success: true, combatState });

    } catch (error) {
        console.error('startCombat error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const combatAction = async (req: Request, res: Response) => {
    try {
        const { userId, action } = req.body; // 'ATTACK', 'SKILL', 'FLEE'
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });
        if (!user || user.combatStatus !== 'IN_COMBAT' || !user.combatState) {
            return res.status(400).json({ error: 'Not in combat' });
        }

        let state = JSON.parse(user.combatState);
        const { enemy } = state;
        const logs = [];

        // 1. Player Turn
        if (action === 'FLEE') {
            // Chance to flee
            if (Math.random() > 0.5) {
                await db.update(users).set({ combatStatus: 'IDLE', combatState: null }).where(eq(users.id, userId));
                return res.json({ success: true, finished: true, message: 'Bạn đã chạy thoát thành công!' });
            } else {
                logs.push({ text: 'Bạn cố gắng bỏ chạy nhưng thất bại!', type: 'warning' });
            }
        } else if (action === 'ATTACK') {
            // User Attack
            // Simplified User Attack for prototype
            // TODO: Get element from equipped weapon?
            // For now, assume player is METAL (Kim) or check equipment if we had it loaded.

            // Mock fetching weapon element (Future: Load from inventory)
            const playerElement = 'WOOD'; // Default wood sword logic

            const userAttack = 15; // Placeholder
            const { damage: dmg, elementMult } = calculateDamage({ attack: userAttack, element: playerElement }, enemy);

            enemy.hp -= dmg;

            let logText = `Bạn tấn công ${enemy.name} gây ${dmg} sát thương!`;
            if (elementMult > 1) logText += ` (Khắc chế!)`;
            if (elementMult < 1) logText += ` (Bị chặn!)`;

            logs.push({ text: logText, type: 'player-atk' });
        }

        // Check Enemy Death
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            // Victory
            const expReward = 50;
            const goldReward = 20;

            await db.update(users)
                .set({
                    combatStatus: 'IDLE',
                    combatState: null,
                    cultivationExp: (user.cultivationExp || 0) + expReward,
                    gold: (user.gold || 0) + goldReward
                })
                .where(eq(users.id, userId));

            return res.json({
                success: true,
                finished: true,
                result: 'VICTORY',
                rewards: { exp: expReward, gold: goldReward },
                logs: [...state.logs, ...logs, { text: `Bạn đã đánh bại ${enemy.name}!`, type: 'victory' }]
            });
        }

        // 2. Enemy Turn (If not dead and Player didn't flee successfully)
        if (enemy.hp > 0) {
            // Enemy Attack
            // Enemy Attack
            const { damage: enemyDmg, elementMult } = calculateDamage(enemy, { defense: 5, element: 'WOOD' }); // Placeholder defense & element
            state.userHp -= enemyDmg;

            let logText = `${enemy.name} tấn công lại gây ${enemyDmg} sát thương!`;
            if (elementMult > 1) logText += ` (Khắc chế!)`;
            if (elementMult < 1) logText += ` (Bị chặn!)`;

            logs.push({ text: logText, type: 'enemy-atk' });
        }

        // Check Player Death
        if (state.userHp <= 0) {
            state.userHp = 0;
            // Defeat
            await db.update(users)
                .set({ combatStatus: 'IDLE', combatState: null }) // Penalty?
                .where(eq(users.id, userId));

            return res.json({
                success: true,
                finished: true,
                result: 'DEFEAT',
                logs: [...state.logs, ...logs, { text: `Bạn đã bị ${enemy.name} đánh bại!`, type: 'defeat' }]
            });
        }

        // Update State
        state.turnCount += 1;
        state.logs = [...state.logs, ...logs]; // Append new logs
        // Limit logs size?
        if (state.logs.length > 20) state.logs = state.logs.slice(-20);

        await db.update(users)
            .set({ combatState: JSON.stringify(state) })
            .where(eq(users.id, userId));

        return res.json({ success: true, combatState: state });

    } catch (error) {
        console.error('combatAction error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
