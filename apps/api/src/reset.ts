import "dotenv/config";
import { db } from "@repo/db";
import { users, works, chapters, gameItems, missions, reviews } from "@repo/db";

async function main() {
    console.log("🔄 Resetting database (clearing works, chapters, reviews)...");

    try {
        // Delete in correct order (foreign keys)
        await db.delete(reviews);
        console.log("✅ Cleared reviews");

        await db.delete(chapters);
        console.log("✅ Cleared chapters");

        await db.delete(works);
        console.log("✅ Cleared works");

        console.log("🎉 Database reset completed!");
        console.log("ℹ️  User accounts, settings, and genres are preserved.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
}

main();
