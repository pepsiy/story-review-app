import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Sanitize connection string to support both pooled and direct urls
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("⚠️  NEON_DATABASE_URL is missing! DB calls will fail.");
}

// Remove &channel_binding=require if present (causes error in serverless)
const cleanConnectionString = connectionString?.replace("&channel_binding=require", "") || "";

const sql = neon(cleanConnectionString);
export const db = drizzle(sql as any, { schema });

export * from './schema';
