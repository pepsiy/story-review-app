
import dotenv from "dotenv";
import path from "path";
// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { db } from "../../../packages/db/src";
import { gameItems } from "../../../packages/db/src";
import { ITEMS, RECIPES } from "./data/gameData";

async function seed() {
    console.log("Seeding Game Data...");
    try {
        for (const itemKey in ITEMS) {
            const itemDef = ITEMS[itemKey];

            // Resolve recipe if exists
            let recipeIngredients = null;
            if (RECIPES[itemKey]) {
                recipeIngredients = JSON.stringify(RECIPES[itemKey].ingredients);
            }

            console.log(`Upserting ${itemDef.name}...`);

            // Upsert
            await db.insert(gameItems).values({
                id: itemDef.id,
                name: itemDef.name,
                type: itemDef.type,
                price: itemDef.price || 0,
                sellPrice: itemDef.sellPrice || 0,
                growTime: itemDef.growTime || 0,
                exp: itemDef.exp || 0,
                description: itemDef.description,
                icon: '📦',
                ingredients: recipeIngredients
            }).onConflictDoUpdate({
                target: gameItems.id,
                set: {
                    name: itemDef.name,
                    price: itemDef.price || 0,
                    sellPrice: itemDef.sellPrice || 0,
                    growTime: itemDef.growTime || 0,
                    exp: itemDef.exp || 0,
                    description: itemDef.description,
                    ingredients: recipeIngredients
                }
            });
        }
        console.log("Seeding Complete!");
        process.exit(0);
    } catch (e) {
        console.error("Seeding Failed", e);
        process.exit(1);
    }
}

seed();
