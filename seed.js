// Native fetch in Node 18+

async function seed() {
    try {
        const res = await fetch('http://localhost:3001/game/admin/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}

seed();
