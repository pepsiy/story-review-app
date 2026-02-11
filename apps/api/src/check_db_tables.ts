import "dotenv/config";
import { db } from '../../../packages/db/src';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function main() {
    const logParams: string[] = [];
    const log = (...args: any[]) => {
        console.log(...args);
        logParams.push(args.join(' '));
    };
    const error = (...args: any[]) => {
        console.error(...args);
        logParams.push("ERROR: " + args.join(' '));
    };

    log("🔍 Checking Database Tables...");

    // Query to list all tables in the public schema
    const result: any = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    `);

    // Drizzle execute returns different structures based on driver.
    // For postgresjs (which @repo/db seems to use), it returns an array-like object.
    const tables = Array.from(result).map((row: any) => row.table_name);
    log("📂 Found Tables:", tables.join(', '));

    // Check for specific Phase 33 tables
    const expectedTables = ['skills', 'user_skills', 'combat_sessions', 'enemy_skills', 'skill_books'];
    const missingTables = expectedTables.filter(t => !tables.includes(t));

    if (missingTables.length === 0) {
        log("✅ All Phase 33 Combat Tables are present!");
    } else {
        error("❌ Missing Tables:", missingTables);
    }

    // Check for columns in beasts table
    const beastColumns: any = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'beasts';
    `);
    const bCols = Array.from(beastColumns).map((row: any) => row.column_name);
    const expectedCols = ['mana', 'element', 'crit_rate', 'dodge_rate'];
    const missingCols = expectedCols.filter(c => !bCols.includes(c));

    if (missingCols.length === 0) {
        log("✅ 'beasts' table has new combat columns!");
    } else {
        error("❌ 'beasts' table missing columns:", missingCols);
    }

    fs.writeFileSync('db_check.log', logParams.join('\n'));
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    fs.writeFileSync('db_check.log', 'FATAL ERROR: ' + err.message);
});
