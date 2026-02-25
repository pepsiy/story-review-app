import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" }); // Load env from root

const activeNeon = process.env.ACTIVE_NEON || '1';
const dbUrl = activeNeon === '2'
    ? process.env.NEON_DATABASE_URL_2
    : (process.env.NEON_DATABASE_URL_1 || process.env.NEON_DATABASE_URL);

export default {
    schema: "./src/schema.ts",
    out: "./drizzle",
    driver: "pg",
    dbCredentials: {
        connectionString: dbUrl!,
    },
} satisfies Config;
