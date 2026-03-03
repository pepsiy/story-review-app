import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';
config();

const getCleanUrl = (url) => url ? url.replace('&channel_binding=require', '') : url;

async function check() {
    const p2 = new Pool({ connectionString: getCleanUrl(process.env.NEON_DATABASE_URL_2) });

    try {
        const r2 = await p2.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'genres'");
        console.log("NEON 2 genres columns:", r2.rows.map(x => x.column_name));
    } catch (e) {
        console.error("Lỗi P2:", e);
    }
    await p2.end();
}
check();
