import { auth } from "@/auth";
import { db, favorites, works } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workId = parseInt(params.id);
    if (isNaN(workId)) return NextResponse.json({ error: "Invalid Work ID" }, { status: 400 });

    const existing = await db.query.favorites.findFirst({
        where: and(
            eq(favorites.userId, session.user.id),
            eq(favorites.workId, workId)
        )
    });

    if (existing) {
        // Unfavorite
        await db.delete(favorites).where(eq(favorites.id, existing.id));
        return NextResponse.json({ favorited: false });
    } else {
        // Favorite
        await db.insert(favorites).values({
            userId: session.user.id,
            workId: workId
        });
        return NextResponse.json({ favorited: true });
    }
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ favorited: false });
    }

    const workId = parseInt(params.id);
    const existing = await db.query.favorites.findFirst({
        where: and(
            eq(favorites.userId, session.user.id),
            eq(favorites.workId, workId)
        )
    });

    return NextResponse.json({ favorited: !!existing });
}
