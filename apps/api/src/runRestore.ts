import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { restoreFromSheets } from "./services/restoreFromSheets";

async function main() {
    console.log("Starting DB Restore from Google Sheets...");
    await restoreFromSheets();
    console.log("Process finished.");
    process.exit(0);
}

main().catch(err => {
    console.error("Critical error:", err);
    process.exit(1);
});
