// Phase 33: Turn-Based Combat - Combat Controller
// API endpoints for managing turn-based combat sessions

import { Request, Response } from 'express';
import { db } from '@repo/db';
import { users, beasts, skills, userSkills, combatSessions, enemySkills, skillBooks } from '@repo/db';
import { eq, and } from 'drizzle-orm';
import {
    calculateDamage,
    applySkillEffects,
    applyBuffsToStats,
    decrementBuffDurations,
    CombatStats,
    Skill,
    ActiveBuff
} from '../services/damageCalculator';
import { decideEnemyAction, AIPattern, EnemySkillConfig } from '../services/enemyAI';
import { generateSkillBookDrop, calculateCombatRewards, SkillBookDrop } from '../services/skillBookDrops';
import { randomUUID } from 'crypto';

// ===================================
// POST /game/combat/start
// Initialize combat session
// ===================================
export const startCombat = async (req: Request, res: Response) => {
    try {
        const { userId, enemyId } = req.body;

        if (!userId || !enemyId) {
            return res.status(400).json({ error: 'Missing userId or enemyId' });
        }

        // Fetch user stats
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch enemy (beast) stats
        const enemy = await db.query.beasts.findFirst({
            where: eq(beasts.id, enemyId)
        });

        if (!enemy) {
            return res.status(404).json({ error: 'Enemy not found' });
        }

        // Check if user already has active combat
        const existingSession = await db.query.combatSessions.findFirst({
            where: and(
                eq(combatSessions.userId, userId),
                eq(combatSessions.state, 'active')
            )
        });

        if (existingSession) {
            return res.status(400).json({ error: 'You are already in combat! Finish or flee first.' });
        }

        // Create combat session
        const sessionId = randomUUID();
        await db.insert(combatSessions).values({
            id: sessionId,
            userId,
            enemyId,
            state: 'active',
            turn: 1,
            playerHp: user.currentHealth || user.maxHealth,
            playerMana: user.mana || user.maxMana,
            enemyHp: enemy.health,
            enemyMana: enemy.mana || enemy.maxMana || 20,
            playerBuffs: JSON.stringify([]),
            playerCooldowns: JSON.stringify({}),
            enemyBuffs: JSON.stringify([]),
            enumyCooldowns: JSON.stringify({}),
            combatLog: JSON.stringify([{
                turn: 0,
                message: `Bạn gặp ${enemy.name}! Chiến đấu bắt đầu!`,
                type: 'system'
            }])
        });

        // Fetch player's equipped skills
        const equippedSkills = await db.query.userSkills.findMany({
            where: and(
                eq(userSkills.userId, userId),
                eq(userSkills.equippedSlot, 1) // This should filter slots 1-4, but simplified for now
            ),
            with: {
                skill: true
            }
        });

        return res.json({
            sessionId,
            player: {
                hp: user.currentHealth || user.maxHealth,
                maxHp: user.maxHealth,
                mana: user.mana || user.maxMana,
                maxMana: user.maxMana,
                attack: user.statStr * 2, // STR = attack
                defense: user.statVit, // VIT = defense
                critRate: user.critRate || 5,
                critDamage: user.critDamage || 150,
                dodgeRate: user.dodgeRate || 5,
                element: user.element,
                equippedSkills: equippedSkills.map(us => us.skill)
            },
            enemy: {
                name: enemy.name,
                hp: enemy.health,
                maxHp: enemy.health,
                mana: enemy.mana || enemy.maxMana || 20,
                maxMana: enemy.maxMana || 20,
                attack: enemy.attack,
                defense: enemy.defense,
                critRate: enemy.critRate || 2,
                dodgeRate: enemy.dodgeRate || 3,
                element: enemy.element,
                icon: enemy.icon,
                aiPattern: enemy.aiPattern as AIPattern || 'balanced'
            },
            turn: 1,
            message: `Chiến đấu với ${enemy.name} bắt đầu!`
        });

    } catch (error) {
        console.error('startCombat error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ===================================
// POST /game/combat/action
// Process player action + enemy turn
// ===================================
export const processCombatAction = async (req: Request, res: Response) => {
    try {
        const { sessionId, action, skillId } = req.body;

        if (!sessionId || !action) {
            return res.status(400).json({ error: 'Missing sessionId or action' });
        }

        // Fetch combat session
        const session = await db.query.combatSessions.findFirst({
            where: eq(combatSessions.id, sessionId)
        });

        if (!session || session.state !== 'active') {
            return res.status(404).json({ error: 'Combat session not found or ended' });
        }

        // Fetch user and enemy data
        const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
        const enemy = await db.query.beasts.findFirst({ where: eq(beasts.id, session.enemyId) });

        if (!user || !enemy) {
            return res.status(404).json({ error: 'User or enemy not found' });
        }

        // Parse current state
        let playerBuffs: ActiveBuff[] = JSON.parse(session.playerBuffs || '[]');
        let enemyBuffs: ActiveBuff[] = JSON.parse(session.enemyBuffs || '[]');
        let playerCooldowns: Record<string, number> = JSON.parse(session.playerCooldowns || '{}');
        let enemyCooldowns: Record<string, number> = JSON.parse(session.enemyCooldowns || '{}');
        let combatLog: any[] = JSON.parse(session.combatLog || '[]');

        let playerHp = session.playerHp;
        let playerMana = session.playerMana;
        let enemyHp = session.enemyHp;
        let enemyMana = session.enemyMana;

        // Build combat stats
        const playerStats: CombatStats = {
            hp: playerHp,
            maxHp: user.maxHealth,
            mana: playerMana,
            maxMana: user.maxMana,
            attack: user.statStr * 2,
            defense: user.statVit,
            critRate: user.critRate || 5,
            critDamage: user.critDamage || 150,
            dodgeRate: user.dodgeRate || 5,
            element: user.element
        };

        const enemyStats: CombatStats = {
            hp: enemyHp,
            maxHp: enemy.health,
            mana: enemyMana,
            maxMana: enemy.maxMana || 20,
            attack: enemy.attack,
            defense: enemy.defense,
            critRate: enemy.critRate || 2,
            critDamage: 150,
            dodgeRate: enemy.dodgeRate || 3,
            element: enemy.element
        };

        // === PLAYER TURN ===
        let playerActionLog: any = { turn: session.turn, actor: 'player' };

        if (action === 'attack') {
            // Normal attack
            const playerStatsWithBuffs = applyBuffsToStats(playerStats, playerBuffs);
            const damageResult = calculateDamage(playerStatsWithBuffs, enemyStats, null, true);

            enemyHp -= damageResult.damage;
            playerActionLog = {
                ...playerActionLog,
                action: 'attack',
                damage: damageResult.damage,
                isCrit: damageResult.isCrit,
                isDodge: damageResult.isDodge,
                message: damageResult.isDodge
                    ? `Bạn tấn công nhưng ${enemy.name} né tránh!`
                    : `Bạn tấn công gây ${damageResult.damage} sát thương${damageResult.isCrit ? ' (BÁO KÍCH!)' : ''}!`
            };

        } else if (action === 'skill' && skillId) {
            // Use skill
            const skillData = await db.query.skills.findFirst({ where: eq(skills.id, skillId) });
            if (!skillData) {
                return res.status(400).json({ error: 'Skill not found' });
            }

            // Check mana and cooldown
            if (playerMana < skillData.manaCost) {
                return res.status(400).json({ error: 'Không đủ mana' });
            }
            if (playerCooldowns[skillId] && playerCooldowns[skillId] > 0) {
                return res.status(400).json({ error: `Skill đang hồi (còn ${playerCooldowns[skillId]} lượt)` });
            }

            // Deduct mana
            playerMana -= skillData.manaCost;

            // Calculate damage
            const playerSkill: Skill = {
                id: skillData.id,
                name: skillData.name,
                element: skillData.element,
                manaCost: skillData.manaCost,
                damageMultiplier: skillData.damageMultiplier,
                effects: skillData.effects ? JSON.parse(skillData.effects) : undefined
            };

            const playerStatsWithBuffs = applyBuffsToStats(playerStats, playerBuffs);
            const damageResult = calculateDamage(playerStatsWithBuffs, enemyStats, playerSkill, true);

            enemyHp -= damageResult.damage;

            // Apply skill effects
            if (playerSkill.effects) {
                const { updatedBuffs } = applySkillEffects(playerStats, playerSkill.effects, playerBuffs);
                playerBuffs = updatedBuffs;
            }

            // Set cooldown
            if (skillData.cooldown > 0) {
                playerCooldowns[skillId] = skillData.cooldown;
            }

            playerActionLog = {
                ...playerActionLog,
                action: 'skill',
                skillName: skillData.name,
                damage: damageResult.damage,
                isCrit: damageResult.isCrit,
                isDodge: damageResult.isDodge,
                elementAdvantage: damageResult.elementAdvantage,
                message: damageResult.isDodge
                    ? `Bạn dùng ${skillData.name} nhưng ${enemy.name} né tránh!`
                    : `Bạn dùng ${skillData.name} gây ${damageResult.damage} sát thương${damageResult.isCrit ? ' (BÁO KÍCH!)' : ''}!`
            };

        } else if (action === 'flee') {
            // Flee attempt (50% success)
            const fleeSuccess = Math.random() < 0.5;
            if (fleeSuccess) {
                // Penalty: Lose 5% current EXP
                const expLoss = Math.floor(user.cultivationExp * 0.05);
                await db.update(users)
                    .set({ cultivationExp: Math.max(0, user.cultivationExp - expLoss) })
                    .where(eq(users.id, user.id));

                await db.update(combatSessions)
                    .set({ state: 'fled' })
                    .where(eq(combatSessions.id, sessionId));

                return res.json({
                    result: 'fled',
                    message: `Bạn trốn thoát thành công! Mất ${expLoss} EXP.`,
                    expLost: expLoss
                });
            } else {
                playerActionLog = {
                    ...playerActionLog,
                    action: 'flee_failed',
                    message: `Bạn cố trốn nhưng thất bại!`
                };
                // Enemy gets free attack
            }
        }

        combatLog.push(playerActionLog);

        // === CHECK ENEMY DEFEAT ===
        if (enemyHp <= 0) {
            enemyHp = 0;
            await db.update(combatSessions)
                .set({ state: 'victory' })
                .where(eq(combatSessions.id, sessionId));

            // Calculate rewards
            const rewards = calculateCombatRewards(1, 'normal', user.cultivationLevel || 0);
            const skillBookDrop = generateSkillBookDrop('normal', enemy.element, []); // Need to pass all skill books

            // Update user
            await db.update(users).set({
                gold: user.gold + rewards.gold,
                cultivationExp: user.cultivationExp + rewards.exp
            }).where(eq(users.id, user.id));

            return res.json({
                result: 'victory',
                playerHp,
                playerMana,
                enemyHp: 0,
                rewards: {
                    gold: rewards.gold,
                    exp: rewards.exp,
                    skillBook: skillBookDrop
                },
                combatLog,
                message: `Bạn đã chiến thắng! Nhận ${rewards.gold} gold, ${rewards.exp} EXP!`
            });
        }

        // === ENEMY TURN ===
        // Fetch enemy skills
        const enemySkillConfigs = await db.query.enemySkills.findMany({
            where: eq(enemySkills.enemyId, enemy.id),
            with: { skill: true }
        });

        const enemySkillsForAI: EnemySkillConfig[] = enemySkillConfigs.map(es => ({
            skill: {
                id: es.skill.id,
                name: es.skill.name,
                element: es.skill.element,
                manaCost: es.skill.manaCost,
                damageMultiplier: es.skill.damageMultiplier,
                effects: es.skill.effects ? JSON.parse(es.skill.effects) : undefined
            },
            usageRate: es.usageRate,
            minTurn: es.minTurn
        }));

        const aiDecision = decideEnemyAction(
            enemyStats,
            playerStats,
            enemySkillsForAI,
            session.turn,
            enemy.aiPattern as AIPattern || 'balanced',
            enemyCooldowns
        );

        let enemyActionLog: any = { turn: session.turn, actor: 'enemy' };

        if (aiDecision.action === 'attack') {
            const enemyStatsWithBuffs = applyBuffsToStats(enemyStats, enemyBuffs);
            const damageResult = calculateDamage(enemyStatsWithBuffs, playerStats, null, false);

            playerHp -= damageResult.damage;
            enemyActionLog = {
                ...enemyActionLog,
                action: 'attack',
                damage: damageResult.damage,
                isCrit: damageResult.isCrit,
                isDodge: damageResult.isDodge,
                message: damageResult.isDodge
                    ? `${enemy.name} tấn công nhưng bạn né tránh!`
                    : `${enemy.name} tấn công gây ${damageResult.damage} sát thương${damageResult.isCrit ? ' (BÁO KÍCH!)' : ''}!`
            };

        } else if (aiDecision.action === 'skill' && aiDecision.skillId) {
            const enemySkill = enemySkillsForAI.find(es => es.skill.id === aiDecision.skillId)?.skill;
            if (enemySkill) {
                enemyMana -= enemySkill.manaCost;

                const enemyStatsWithBuffs = applyBuffsToStats(enemyStats, enemyBuffs);
                const damageResult = calculateDamage(enemyStatsWithBuffs, playerStats, enemySkill, false);

                playerHp -= damageResult.damage;

                if (enemySkill.effects) {
                    const { updatedBuffs } = applySkillEffects(enemyStats, enemySkill.effects, enemyBuffs);
                    enemyBuffs = updatedBuffs;
                }

                enemyActionLog = {
                    ...enemyActionLog,
                    action: 'skill',
                    skillName: enemySkill.name,
                    damage: damageResult.damage,
                    isCrit: damageResult.isCrit,
                    isDodge: damageResult.isDodge,
                    message: damageResult.isDodge
                        ? `${enemy.name} dùng ${enemySkill.name} nhưng bạn né tránh!`
                        : `${enemy.name} dùng ${enemySkill.name} gây ${damageResult.damage} sát thương${damageResult.isCrit ? ' (BÁO KÍCH!)' : ''}!`
                };
            }
        }

        combatLog.push(enemyActionLog);

        // === CHECK PLAYER DEFEAT ===
        if (playerHp <= 0) {
            playerHp = 0;
            await db.update(combatSessions)
                .set({ state: 'defeat' })
                .where(eq(combatSessions.id, sessionId));

            // Penalty: Lose 10% EXP
            const expLoss = Math.floor(user.cultivationExp * 0.10);
            await db.update(users).set({
                cultivationExp: Math.max(0, user.cultivationExp - expLoss),
                currentHealth: user.maxHealth // Respawn with full HP
            }).where(eq(users.id, user.id));

            return res.json({
                result: 'defeat',
                playerHp: 0,
                enemyHp,
                combatLog,
                expLost: expLoss,
                message: `Bạn đã thua! Mất ${expLoss} EXP và hồi sinh tại làng.`
            });
        }

        // === DECREMENT COOLDOWNS & BUFFS ===
        for (const key in playerCooldowns) {
            playerCooldowns[key] = Math.max(0, playerCooldowns[key] - 1);
        }
        for (const key in enemyCooldowns) {
            enemyCooldowns[key] = Math.max(0, enemyCooldowns[key] - 1);
        }
        playerBuffs = decrementBuffDurations(playerBuffs);
        enemyBuffs = decrementBuffDurations(enemyBuffs);

        // === UPDATE SESSION ===
        await db.update(combatSessions).set({
            turn: session.turn + 1,
            playerHp,
            playerMana,
            enemyHp,
            enemyMana,
            playerBuffs: JSON.stringify(playerBuffs),
            playerCooldowns: JSON.stringify(playerCooldowns),
            enemyBuffs: JSON.stringify(enemyBuffs),
            enemyCooldowns: JSON.stringify(enemyCooldowns),
            combatLog: JSON.stringify(combatLog),
            updatedAt: new Date()
        }).where(eq(combatSessions.id, sessionId));

        return res.json({
            result: 'continue',
            turn: session.turn + 1,
            playerHp,
            playerMana,
            enemyHp,
            enemyMana,
            playerBuffs,
            enemyBuffs,
            playerCooldowns,
            enemyCooldowns,
            combatLog: combatLog.slice(-10), // Last 10 entries
            message: 'Combat continues...'
        });

    } catch (error) {
        console.error('processCombatAction error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ===================================
// GET /game/combat/state/:sessionId
// Get current combat state
// ===================================
export const getCombatState = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        const session = await db.query.combatSessions.findFirst({
            where: eq(combatSessions.id, sessionId)
        });

        if (!session) {
            return res.status(404).json({ error: 'Combat session not found' });
        }

        return res.json({
            sessionId: session.id,
            state: session.state,
            turn: session.turn,
            playerHp: session.playerHp,
            playerMana: session.playerMana,
            enemyHp: session.enemyHp,
            enemyMana: session.enemyMana,
            playerBuffs: JSON.parse(session.playerBuffs || '[]'),
            enemyBuffs: JSON.parse(session.enemyBuffs || '[]'),
            playerCooldowns: JSON.parse(session.playerCooldowns || '{}'),
            enemyCooldowns: JSON.parse(session.enemyCooldowns || '{}'),
            combatLog: JSON.parse(session.combatLog || '[]')
        });

    } catch (error) {
        console.error('getCombatState error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
