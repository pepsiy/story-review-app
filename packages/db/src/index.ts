import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const activeNeon = process.env.ACTIVE_NEON || '1';
const url1 = process.env.NEON_DATABASE_URL_1 || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const url2 = process.env.NEON_DATABASE_URL_2;

if (!url1 && !url2) {
    console.warn("⚠️  NEON_DATABASE_URL is missing! Using dummy connection string for build.");
}

const getCleanUrl = (url?: string) => {
    if (!url) return "postgresql://dummy:dummy@127.0.0.1/dummy?sslmode=require";
    return url.replace("&channel_binding=require", "");
};

const pool1 = new Pool({ connectionString: getCleanUrl(url1) });
const pool2 = url2 ? new Pool({ connectionString: getCleanUrl(url2) }) : null;

// The HA Pool Wrapper
let isFailingOver = false;
let currentPool = (activeNeon === '2' && pool2) ? pool2 : pool1;

const proxyPool = {
    ...currentPool,
    query: async (text: string, values?: any[]) => {
        try {
            if (isFailingOver && pool2) {
                return await pool2.query(text, values);
            }
            return await currentPool.query(text, values);
        } catch (error: any) {
            // Check if error is Neon rate limit / compute limit (often XX000 or 503)
            const isQuotaError = error?.code === 'XX000' || error?.message?.includes('endpoint is currently disabled') || error?.message?.includes('quota');

            if (isQuotaError && pool2 && currentPool === pool1) {
                console.warn(`[HA Database] NEON 1 failed with Quota Error! Auto-failing over to NEON 2...`);
                isFailingOver = true;
                return await pool2.query(text, values);
            }
            throw error;
        }
    }
} as any;

export const db = drizzle(proxyPool, { schema });
export * from './schema';
