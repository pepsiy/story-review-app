// Seed script for production
async function seedProduction() {
    console.log("Seeding production database at https://tomtat.com.vn...");
    try {
        const res = await fetch('https://tomtat.com.vn/game/admin/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        console.log("✅ Seed Result:", data);
    } catch (e) {
        console.error("❌ Seed Failed:", e);
    }
}

seedProduction();
