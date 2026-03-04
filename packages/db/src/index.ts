import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const activeNeon = process.env.ACTIVE_NEON || '1';
const url1 = process.env.NEON_DATABASE_URL_1 || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const url2 = process.env.NEON_DATABASE_URL_2;
const url3 = process.env.NEON_DATABASE_URL_3;

if (!url1 && !url2 && !url3) {
    console.warn("⚠️  NEON_DATABASE_URL is missing! Using dummy connection string for build.");
}

const getCleanUrl = (url?: string) => {
    if (!url) return "postgresql://dummy:dummy@127.0.0.1/dummy?sslmode=require";
    return url.replace("&channel_binding=require", "");
};

const pool1 = new Pool({ connectionString: getCleanUrl(url1) });
const pool2 = url2 ? new Pool({ connectionString: getCleanUrl(url2) }) : null;
const pool3 = url3 ? new Pool({ connectionString: getCleanUrl(url3) }) : null;

// The HA Pool Wrapper
let isFailingOver = false;
let currentPool = pool1;
if (activeNeon === '3' && pool3) {
    currentPool = pool3;
} else if (activeNeon === '2' && pool2) {
    currentPool = pool2;
}

// Prevent unhandled errors from crashing the Node instance
pool1.on('error', (err: any) => {
    const isQuotaError = err?.code === 'XX000' || err?.message?.includes('endpoint is currently disabled') || err?.message?.includes('quota');
    if (isQuotaError && pool2 && !isFailingOver) {
        console.warn(`[HA Database] NEON 1 Pool emitted Quota Error! Auto-failing over to NEON 2...`);
        isFailingOver = true;
        // CRITICAL: End the broken pool so it stops retrying and crashing the app in the background
        pool1.end().catch(e => console.error('Error ending crashed pool1:', e));
    } else {
        console.error('[HA Database Pool 1] Unexpected background error:', err?.message || err);
    }
});

if (pool2) {
    pool2.on('error', (err: any) => {
        console.error('[HA Database Pool 2] Unexpected background error:', err?.message || err);
    });
}

// Override query to add HA Failover directly on the instance (to preserve prototype chain)
const originalQuery = currentPool.query.bind(currentPool);

(currentPool as any).query = async (textOrConfig: any, values?: any[]) => {
    try {
        if (isFailingOver && pool2) {
            return values ? await pool2.query(textOrConfig, values) : await pool2.query(textOrConfig);
        }
        return values ? await originalQuery(textOrConfig, values) : await originalQuery(textOrConfig);
    } catch (error: any) {
        // Check if error is Neon rate limit / compute limit (often XX000 or 503)
        const isQuotaError = error?.code === 'XX000' || error?.message?.includes('endpoint is currently disabled') || error?.message?.includes('quota');

        if (isQuotaError && pool2 && currentPool === pool1 && !isFailingOver) {
            console.warn(`[HA Database] NEON 1 query failed with Quota! Failing over...`);
            isFailingOver = true;
            pool1.end().catch(() => { }); // end quietly
            return values ? await pool2.query(textOrConfig, values) : await pool2.query(textOrConfig);
        }
        throw error;
    }
};

export const db = drizzle(currentPool, { schema });
export * from './schema';
