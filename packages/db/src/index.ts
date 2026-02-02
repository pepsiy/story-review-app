import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// Sanitize connection string to support both pooled and direct urls
const rawConnectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
    console.warn("⚠️  NEON_DATABASE_URL is missing! Using dummy connection string for build.");
}

// Fallback to dummy string if missing to prevent neon() from throwing during build
const connectionString = rawConnectionString || "postgresql://dummy:dummy@127.0.0.1/dummy?sslmode=require";

// Remove &channel_binding=require if present (causes error in serverless)
const cleanConnectionString = connectionString.replace("&channel_binding=require", "");

const pool = new Pool({ connectionString: cleanConnectionString });
export const db = drizzle(pool, { schema });

export * from './schema';
