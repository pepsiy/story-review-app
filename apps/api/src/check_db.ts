import "dotenv/config";
import { db } from "../../../packages/db/src";
import { works } from "@repo/db";

async function main() {
    const allWorks = await db.select().from(works);
    console.log("Current Data in DB:", JSON.stringify(allWorks, null, 2));
    process.exit(0);
}

main();
