import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { db, works } from "@repo/db";

async function test() {
    try {
        console.log("Testing DB connection. Active NEON:", process.env.ACTIVE_NEON);
        const res = await db.select().from(works).limit(1);
        console.log("Success! works count:", res.length);
    } catch (e: any) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

test();
