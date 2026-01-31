import { auth } from "@/auth";
import { db, favorites, works } from "@repo/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json([], { status: 401 });
    }

    const userFavorites = await db.query.favorites.findMany({
        where: eq(favorites.userId, session.user.id),
        with: {
            work: true // Include work details
        },
        orderBy: [desc(favorites.createdAt)]
    });

    // Flatten structure for frontend
    const result = userFavorites.map(f => f.work);
    return NextResponse.json(result);
}
