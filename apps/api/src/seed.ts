import "dotenv/config";
import { db } from "../../../packages/db/src";
import { works, chapters } from "../../../packages/db/src";

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

    console.log("🎉 Seeding completed!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
