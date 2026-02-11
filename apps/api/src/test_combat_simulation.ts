import "dotenv/config";
import { db } from '@repo/db';
import { users, beasts, combatSessions, userSkills, enemySkills } from '@repo/db';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import {
    calculateDamage as calcDmg,
    applyBuffsToStats as applyBuffs,
    CombatStats as CStats
} from './services/damageCalculator';
import { decideEnemyAction as decideAI, AIPattern as APattern, EnemySkillConfig as ESkillConf } from './services/enemyAI';

async function main() {
    console.log("⚔️ Starting Combat Simulation...");

    // 1. Get User
    const user = await db.query.users.findFirst();
    if (!user) {
        console.error("❌ No user found in DB. Run seed first.");
        return;
    }
    console.log(`👤 User: ${user.name || 'Unknown'} (HP: ${user.currentHealth}/${user.maxHealth})`);

    // 2. Get Beast
    const beast = await db.query.beasts.findFirst();
    if (!beast) {
        console.error("❌ No beast found in DB. Run seed first.");
        return;
    }
    console.log(`🐺 Beast: ${beast.name} (HP: ${beast.health})`);

    // 3. Init Stats
    let playerHp = user.currentHealth || user.maxHealth || 100;
    let enemyHp = beast.health;

    // Ensure stats are not null
    const playerStats: CStats = {
        hp: playerHp,
        maxHp: user.maxHealth || 100,
        mana: user.mana || 100,
        maxMana: user.maxMana || 100,
        attack: (user.statStr || 10) * 2,
        defense: user.statVit || 5,
        critRate: user.critRate || 5,
        critDamage: user.critDamage || 150,
        dodgeRate: user.dodgeRate || 5,
        element: user.element || 'FIRE'
    };

    const enemyStats: CStats = {
        hp: enemyHp,
        maxHp: beast.health,
        mana: beast.mana || 100,
        maxMana: beast.maxMana || 100,
        attack: beast.attack,
        defense: beast.defense,
        critRate: beast.critRate || 5,
        critDamage: 150,
        dodgeRate: beast.dodgeRate || 5,
        element: beast.element || 'WIND'
    };

    console.log("\n🏁 Battle Start!");

    // 4. Simulate Turns
    for (let turn = 1; turn <= 10; turn++) {
        console.log(`\n--- Turn ${turn} ---`);

        // Player Attack
        const pDmg = calcDmg(playerStats, enemyStats, null, true);
        enemyHp -= pDmg.damage;
        enemyStats.hp = enemyHp;
        console.log(`User attacks! Damage: ${pDmg.damage} ${pDmg.isCrit ? '(CRIT!)' : ''} -> Enemy HP: ${enemyHp}`);

        if (enemyHp <= 0) {
            console.log("🎉 VICTORY! Enemy defeated.");
            break;
        }

        // Enemy Turn
        const eSkills: ESkillConf[] = [];
        const decision = decideAI(enemyStats, playerStats, eSkills, turn, (beast.aiPattern as APattern) || 'balanced', {});

        if (decision.action === 'attack') {
            const eDmg = calcDmg(enemyStats, playerStats, null, false);
            playerHp -= eDmg.damage;
            playerStats.hp = playerHp;
            console.log(`Enemy attacks! Damage: ${eDmg.damage} ${eDmg.isCrit ? '(CRIT!)' : ''} -> Player HP: ${playerHp}`);
        } else {
            console.log(`Enemy uses ${decision.action} (Not fully simulated in script)`);
        }

        if (playerHp <= 0) {
            console.log("💀 DEFEAT! You died.");
            break;
        }
    }

    console.log("\n✅ Simulation Complete.");
    process.exit(0);
}

main().catch(console.error);
