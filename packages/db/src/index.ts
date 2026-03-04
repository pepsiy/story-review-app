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

const pool1 = url1 ? new Pool({ connectionString: getCleanUrl(url1) }) : null;
const pool2 = url2 ? new Pool({ connectionString: getCleanUrl(url2) }) : null;
const pool3 = url3 ? new Pool({ connectionString: getCleanUrl(url3) }) : null;

const pools = [pool1, pool2, pool3].filter(p => p !== null) as Pool[];
let activePoolIndex = 0;
if (activeNeon === '3' && pool3) activePoolIndex = pools.indexOf(pool3);
else if (activeNeon === '2' && pool2) activePoolIndex = pools.indexOf(pool2);
else if (activeNeon === '2' && pool2) activePoolIndex = pools.indexOf(pool2);

// The HA Pool Wrapper Proxy
const currentPool = new Proxy(pools[activePoolIndex], {
    get(target, prop, receiver) {
        if (prop === 'query' || prop === 'connect') {
            return async (...args: any[]) => {
                let attempts = 0;
                while (attempts < pools.length) {
                    const pool = pools[activePoolIndex];
                    try {
                        const method = (pool as any)[prop].bind(pool);
                        return await method(...args);
                    } catch (err: any) {
                        const msg = err.message?.toLowerCase() || '';
                        // Identify quota exhaustion or endpoint suspension
                        if (msg.includes('quota') || msg.includes('exceed') || msg.includes('compute') || msg.includes('endpoint') || msg.includes('transfer')) {
                            console.error(`🔴 [DB-HA] Pool ${activePoolIndex + 1} QUOTA EXCEEDED or DEAD. Rotating...`);
                            activePoolIndex = (activePoolIndex + 1) % pools.length;
                            attempts++;
                        } else {
                            throw err; // Real SQL logic error
                        }
                    }
                }
                throw new Error("🔴 [DB-HA] FATAL: All DB pools exhausted their quotas!");
            };
        }

        const value = (pools[activePoolIndex] as any)[prop];
        if (typeof value === 'function') {
            return value.bind(pools[activePoolIndex]);
        }
        return value;
    }
});

// Prevent unhandled errors from crashing the Node instance
pools.forEach((pool, index) => {
    pool.on('error', (err: any) => {
        const msg = err?.message?.toLowerCase() || '';
        const isQuotaError = err?.code === 'XX000' || msg.includes('endpoint') || msg.includes('quota') || msg.includes('exceed') || msg.includes('transfer');

        if (isQuotaError) {
            console.warn(`[HA Database] NEON ${index + 1} Pool emitted Quota Error in background!`);
            // If it's the active pool, we switch
            if (activePoolIndex === index) {
                console.warn(`[HA Database] Auto-rotating from NEON ${index + 1} to next available pool...`);
                activePoolIndex = (activePoolIndex + 1) % pools.length;
            }
            // Close broken pool to prevent memory leaks / constant retries
            pool.end().catch(e => console.error(`Error ending crashed pool ${index + 1}:`, e));
            pools.splice(index, 1); // Remove from active rotation array
        } else {
            console.error(`[HA Database Pool ${index + 1}] Unexpected background error:`, err?.message || err);
        }
    });
});
export const db = drizzle(currentPool, { schema });
export * from './schema';
