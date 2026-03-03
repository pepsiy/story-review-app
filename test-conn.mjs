import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';
config();

async function testPool() {
    const u1 = process.env.NEON_DATABASE_URL_1 || process.env.DATABASE_URL;
    const u2 = process.env.NEON_DATABASE_URL_2;
    console.log("NEON 1:", u1 ? u1.substring(0, 30) + '...' : 'NULL');
    console.log("NEON 2:", u2 ? u2.substring(0, 30) + '...' : 'NULL');
    console.log("ACTIVE_NEON:", process.env.ACTIVE_NEON);

    const pool = new Pool({ connectionString: process.env.ACTIVE_NEON === '2' ? u2 : u1 });
    try {
        const res = await pool.query('SELECT current_database(), current_schema()');
        console.log("Connected to:", res.rows[0]);
        const test = await pool.query('SELECT * FROM genres LIMIT 1');
        console.log("Genres tested ok");
    } catch (e) {
        console.error("Query Error:", e.message);
    } finally {
        await pool.end();
    }
}
testPool();
