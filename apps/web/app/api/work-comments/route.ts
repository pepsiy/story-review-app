import { auth } from "@/auth";
import { db, comments, users, chapters } from "@repo/db";
import { eq, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/work-comments?workId=X
// Returns all comments for a work: work-level comments + all chapter comments
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const workIdStr = searchParams.get("workId");

    if (!workIdStr) return NextResponse.json({ error: "Missing workId" }, { status: 400 });
    const workId = parseInt(workIdStr);

    try {
        // Get all chapter IDs for this work
        const chapterList = await db
            .select({ id: chapters.id, chapterNumber: chapters.chapterNumber })
            .from(chapters)
            .where(eq(chapters.workId, workId));

        const chapterMap: Record<number, number> = {};
        chapterList.forEach(c => { chapterMap[c.id] = c.chapterNumber; });
        const chapterIds = chapterList.map(c => c.id);

        // Fetch work-level comments (workId = X, chapterId = null)
        const workComments = await db
            .select({
                id: comments.id,
                content: comments.content,
                createdAt: comments.createdAt,
                chapterId: comments.chapterId,
                workId: comments.workId,
                user: {
                    name: users.name,
                    image: users.image,
                },
            })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(eq(comments.workId, workId))
            .orderBy(desc(comments.createdAt));

        // Fetch chapter comments for this work
        let chapterComments: typeof workComments = [];
        if (chapterIds.length > 0) {
            chapterComments = await db
                .select({
                    id: comments.id,
                    content: comments.content,
                    createdAt: comments.createdAt,
                    chapterId: comments.chapterId,
                    workId: comments.workId,
                    user: {
                        name: users.name,
                        image: users.image,
                    },
                })
                .from(comments)
                .leftJoin(users, eq(comments.userId, users.id))
                .where(inArray(comments.chapterId, chapterIds))
                .orderBy(desc(comments.createdAt));
        }

        // Merge and sort by createdAt desc, add chapterNumber
        const allComments = [
            ...workComments.map(c => ({ ...c, chapterNumber: null })),
            ...chapterComments.map(c => ({
                ...c,
                chapterNumber: c.chapterId ? chapterMap[c.chapterId] ?? null : null,
            })),
        ].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

        return NextResponse.json(allComments);
    } catch (e: any) {
        console.error("work-comments GET error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST /api/work-comments?workId=X
// Post a work-level comment
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workIdStr = searchParams.get("workId");
    if (!workIdStr) return NextResponse.json({ error: "Missing workId" }, { status: 400 });

    try {
        const { content } = await req.json();
        if (!content?.trim()) return NextResponse.json({ error: "Missing content" }, { status: 400 });

        const newComment = await db.insert(comments).values({
            userId: session.user.id,
            workId: parseInt(workIdStr),
            content: content.trim(),
        }).returning();

        return NextResponse.json(newComment[0]);
    } catch (e: any) {
        console.error("work-comments POST error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
