import "dotenv/config";
import { db } from "../../../packages/db/src";
import { works, chapters, gameItems, missions } from "../../../packages/db/src";
import { ITEMS, RECIPES, DAILY_MISSIONS } from "./data/gameData";

async function main() {
    console.log("🌱 Seeding database...");

    // 0. Clean up existing data - commented out for safety
    // await db.delete(chapters);
    // await db.delete(works);

    // 3. Seed Game Items (Sync with gameData.ts)
    // Upsert items
    for (const itemKey in ITEMS) {
        const itemDef = ITEMS[itemKey];
        // Resolve recipe if exists
        let recipeIngredients = null;
        if (RECIPES[itemKey]) {
            recipeIngredients = JSON.stringify(RECIPES[itemKey].ingredients);
        }

        await db.insert(gameItems).values({
            id: itemDef.id,
            name: itemDef.name,
            type: itemDef.type,
            price: itemDef.price || 0,
            sellPrice: itemDef.sellPrice || 0,
            growTime: itemDef.growTime || 0,
            exp: itemDef.exp || 0,
            description: itemDef.description,
            icon: '📦', // Default
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
    console.log("✅ Seeded Game Items");

    // 4. Seed Missions
    for (const mission of DAILY_MISSIONS) {
        await db.insert(missions).values({
            id: mission.id,
            title: mission.title,
            description: mission.description,
            type: mission.type,
            requiredAction: mission.requiredAction || null, // Add requiredAction
            rewardGold: mission.rewardGold,
            rewardExp: mission.rewardExp,
            requiredQuantity: mission.requiredCount,
        }).onConflictDoUpdate({
            target: missions.id,
            set: {
                title: mission.title,
                description: mission.description,
                type: mission.type,
                requiredAction: mission.requiredAction || null, // Add requiredAction
                rewardGold: mission.rewardGold,
                rewardExp: mission.rewardExp,
                requiredQuantity: mission.requiredCount
            }
        });
    }
    console.log("✅ Seeded Missions");

    // 5. Seed Beasts
    const { beasts } = await import("../../../packages/db/src");
    const { BEASTS } = await import("./data/gameData");

    for (const beast of BEASTS) {
        await db.insert(beasts).values({
            id: beast.id,
            name: beast.name,
            description: beast.description,
            health: beast.health,
            attack: beast.attack,
            defense: beast.defense,
            icon: beast.icon,
            lootTable: JSON.stringify(beast.lootTable)
        }).onConflictDoUpdate({
            target: beasts.id,
            set: {
                name: beast.name,
                description: beast.description,
                health: beast.health,
                attack: beast.attack,
                defense: beast.defense,
                icon: beast.icon,
                lootTable: JSON.stringify(beast.lootTable)
            }
        });
    }
    console.log("✅ Seeded Beasts");

    console.log("🎉 Seeding completed!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
