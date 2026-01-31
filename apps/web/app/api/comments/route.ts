
import { auth } from "@/auth";
import { db, comments, users } from "@repo/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId");

    if (!chapterId) return NextResponse.json({ error: "Missing chapterId" }, { status: 400 });

    try {
        const list = await db.select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            user: {
                name: users.name,
                image: users.image,
            }
        })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id)) // Fix relation usage or manual join
            // relations should allow db.query.comments.findMany() which is easier map, but select join is fine
            .where(eq(comments.chapterId, parseInt(chapterId)))
            .orderBy(desc(comments.createdAt));

        return NextResponse.json(list);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { chapterId, content } = await req.json();
        if (!chapterId || !content) return NextResponse.json({ error: "Missing data" }, { status: 400 });

        const newComment = await db.insert(comments).values({
            userId: session.user.id,
            chapterId: parseInt(chapterId),
            content,
        }).returning();

        return NextResponse.json(newComment[0]);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
