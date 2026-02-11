
import "dotenv/config";
import { db } from '@repo/db';
import { skills, beasts } from '@repo/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("🔍 Checking DB Tables via Count...");

    try {
        const skillCount = await db.select({ count: sql<number>`count(*)` }).from(skills);
        console.log(`✅ Table 'skills' exists. Row count: ${skillCount[0].count}`);
    } catch (e: any) {
        console.log(`❌ Table 'skills' check failed: ${e.message}`);
    }

    try {
        // Check new column 'mana' in beasts by selecting it
        const beast = await db.select({ id: beasts.id, mana: beasts.mana }).from(beasts).limit(1);
        console.log(`✅ Table 'beasts' has 'mana' column. Sample:`, beast[0]);
    } catch (e: any) {
        console.log(`❌ Table 'beasts' column check failed: ${e.message}`);
    }

    process.exit(0);
}

main().catch(console.error);
