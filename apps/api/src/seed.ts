import "dotenv/config";
import { db } from "../../../packages/db/src";
import { works, chapters, gameItems } from "../../../packages/db/src";

async function main() {
    console.log("🌱 Seeding database...");

    // 0. Clean up existing data
    await db.delete(chapters);
    await db.delete(works);
    console.log("🧹 Cleared old data");

    // 1. Create Work
    const insertedWorks = await db.insert(works).values({
        title: "Đấu Phá Thương Khung",
        slug: "dau-pha-thuong-khung",
        author: "Thiên Tàm Thổ Đậu",
        coverImage: "https://upload.wikimedia.org/wikipedia/vi/1/15/%C4%90%E1%BA%A5u_Ph%C3%A1_Th%C6%B0%C6%A1ng_Khung.jpg",
        status: "COMPLETED",
        genre: "Tiên Hiệp",
        description: "Tiêu Viêm, thiên tài tu luyện đấu khí của gia tộc Tiêu, bỗng nhiên trở thành phế vật. Ba năm chịu đựng sự chế giễu, hôn thê hủy hôn, cuối cùng hắn cũng tìm lại được con đường của mình...",
        isHot: true,
        views: 15200
    }).returning();

    const work = insertedWorks[0];
    console.log(`✅ Created Work: ${work.title}`);

    // 2. Create Chapter
    await db.insert(chapters).values({
        workId: work.id,
        chapterNumber: 1,
        title: "Vẫn Lạc Đích Thiên Tài",
        originalText: "Secret original text...",
        aiText: "<p>Tiêu Viêm, từng là thiên tài của gia tộc Tiêu, bỗng nhiên mất hết đấu khí, trở thành phế vật bị người đời chê cười. Hôn thê Nạp Lan Yên Nhiên đến từ Vân Lam Tông cao ngạo đến từ hôn, khiến Tiêu Viêm chịu nỗi nhục nhã lớn. Hắn lập lời thề ba năm sau sẽ lên Vân Lam Tông rửa hận.</p><p>Đây là khởi đầu của hành trình gian nan nhưng đầy vinh quang của Viêm Đế.</p>",
        summary: "Tiêu Viêm bị từ hôn và quyết tâm trả thù.",
        youtubeId: "dQw4w9WgXcQ", // Rick Roll for testing :D
        status: "PUBLISHED"
    });
    console.log("✅ Created Chapter 1");

    // 3. Seed Game Items
    await db.delete(gameItems); // Clean old items

    await db.insert(gameItems).values([
        // Seeds
        {
            id: 'seed_linh_thao',
            name: 'Hạt Linh Thảo',
            type: 'SEED',
            price: 10,
            growTime: 60, // 60s
            icon: '🌿',
            description: 'Hạt giống Linh Thảo cơ bản.'
        },
        {
            id: 'seed_nhan_sam',
            name: 'Hạt Nhân Sâm',
            type: 'SEED',
            price: 50,
            growTime: 300, // 5 mins
            icon: '🥕',
            description: 'Hạt giống Nhân Sâm quý hiếm.'
        },
        // Products (Herbs)
        {
            id: 'herb_linh_thao',
            name: 'Linh Thảo',
            type: 'PRODUCT',
            sellPrice: 15, // Profit 5
            minYield: 1,
            maxYield: 3, // Random 1-3
            icon: '🍃',
            description: 'Linh thảo chứa linh khí cơ bản.'
        },
        {
            id: 'herb_nhan_sam',
            name: 'Nhân Sâm',
            type: 'PRODUCT',
            sellPrice: 80, // Profit 30
            minYield: 1,
            maxYield: 2,
            icon: '🥕',
            description: 'Nhân sâm ngàn năm (fake).'
        },
        // Pills / Consumables
        {
            id: 'pill_truc_co',
            name: 'Trúc Cơ Đan',
            type: 'CONSUMABLE',
            sellPrice: 200,
            exp: 500,
            icon: '💊',
            description: 'Đan dược giúp đột phá Trúc Cơ.',
            ingredients: JSON.stringify([
                { itemId: 'herb_linh_thao', quantity: 10 },
                { itemId: 'herb_nhan_sam', quantity: 2 }
            ])
        }
    ]);
    console.log("✅ Seeded Game Items");

    console.log("🎉 Seeding completed!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
