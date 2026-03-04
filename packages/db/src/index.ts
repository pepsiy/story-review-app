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

console.log(`[DB-HA] Booting Up... URLs present -> NEON 1: ${!!url1}, NEON 2: ${!!url2}, NEON 3: ${!!url3}`);
if (!url3) {
    console.warn("⚠️ [DB-HA] WARNING: NEON_DATABASE_URL_3 is NOT SET in the Environment Variables! Please add it on Render!");
}

const getCleanUrl = (url?: string) => {
    if (!url) return "postgresql://dummy:dummy@127.0.0.1/dummy?sslmode=require";
    return url.replace("&channel_binding=require", "");
};

const pool1 = url1 ? new Pool({ connectionString: getCleanUrl(url1) }) : null;
const pool2 = url2 ? new Pool({ connectionString: getCleanUrl(url2) }) : null;
const pool3 = url3 ? new Pool({ connectionString: getCleanUrl(url3) }) : null;

const activePools: { id: number, pool: Pool }[] = [];
if (pool1) activePools.push({ id: 1, pool: pool1 });
if (pool2) activePools.push({ id: 2, pool: pool2 });
if (pool3) activePools.push({ id: 3, pool: pool3 });

// Determine starting active index
let activeIndex = 0;
if (activeNeon === '3' && pool3) activeIndex = activePools.findIndex(p => p.id === 3);
else if (activeNeon === '2' && pool2) activeIndex = activePools.findIndex(p => p.id === 2);

// Standardize error reading for Neon Serverless ErrorEvents vs standard JS Errors
const checkQuotaError = (err: any) => {
    // If it's a DOMException/ErrorEvent, Neon wraps exactly like this in browser/Cloudflare runtimes.
    const msg = String(err?.message || err?.error?.message || err).toLowerCase();
    return err?.code === 'XX000' || msg.includes('quota') || msg.includes('exceed') || msg.includes('transfer') || msg.includes('endpoint');
};

// The HA Pool Wrapper Proxy
const currentPool = new Proxy(activePools[activeIndex].pool, {
    get(target, prop) {
        if (prop === 'query' || prop === 'connect') {
            return async (...args: any[]) => {
                let attempts = 0;
                while (attempts < activePools.length) {
                    const current = activePools[activeIndex];
                    try {
                        const method = (current.pool as any)[prop].bind(current.pool);
                        return await method(...args);
                    } catch (err: any) {
                        if (checkQuotaError(err)) {
                            console.error(`🔴 [DB-HA] Pool ${current.id} QUOTA EXCEEDED! Rotating to next...`);
                            activeIndex = (activeIndex + 1) % activePools.length;
                            attempts++;
                        } else {
                            throw err; // Standard Database Syntax or Constraint Error
                        }
                    }
                }
                throw new Error(`🔴 [DB-HA] FATAL ALERT! All ${activePools.length} current Neon DB pools have exhausted their capacity limit!`);
            };
        }

        const value = (activePools[activeIndex].pool as any)[prop];
        if (typeof value === 'function') {
            return value.bind(activePools[activeIndex].pool);
        }
        return value;
    }
});

// Attach silent error listeners to prevent background crash loops
activePools.forEach((item) => {
    item.pool.on('error', (err: any) => {
        if (checkQuotaError(err)) {
            console.warn(`[HA Database] Pool ${item.id} emitted Quota Error Event in background.`);
        } else {
            // Log as string instead of object to unwrap tricky ErrorEvents
            const msg = err?.message || err?.error?.message || "Unknown Error";
            console.error(`[HA Database Pool ${item.id}] Background error:`, msg);
        }
    });
});

export const db = drizzle(currentPool, { schema });
export * from './schema';
