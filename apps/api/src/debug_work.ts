
import "dotenv/config";
import { db } from "../../../packages/db/src";
import { works } from "../../../packages/db/src";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking Work ID 7...");
    const work = await db.query.works.findFirst({
        where: eq(works.id, 7)
    });
    console.log("Result:", work);
    process.exit(0);
}

main();
