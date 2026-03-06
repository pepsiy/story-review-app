import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { db, users } from "@repo/db";

async function seedAdmin() {
    try {
        console.log("Seeding Admin on NEON", process.env.ACTIVE_NEON);

        const emails = ["admin@tomtat.com.vn", "tomtat.com.vn@gmail.com", "admin@tomtat.com"];

        for (const email of emails) {
            try {
                await db.insert(users).values({
                    email: email,
                    name: "System Admin",
                    role: "admin",
                    gold: 99999,
                    cultivationLevel: "Tiên Nhân",
                    cultivationExp: 9999,
                    bio: "System Administrator"
                });
                console.log(`✅ Seeded ${email}`);
            } catch (err: any) {
                console.log(`Skipped ${email}:`, err.message);
            }
        }

    } catch (e) {
        console.error("General Error", e);
    }
    process.exit(0);
}
seedAdmin();
