import { auth } from "@/auth";
import { db, users, comments } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user details + stats
    // We use findFirst because 'email' or 'id' is unique
    const user = await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
        // Include relations if needed, or count manually
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count stats (example: comments)
    // Drizzle doesn't have easy count relations yet without extensions or SQL
    const commentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.userId, user.id));

    return NextResponse.json({
        ...user,
        stats: {
            following: 0, // Placeholder
            followers: 0, // Placeholder
            likes: 0, // Placeholder
            comments: Number(commentCount[0]?.count || 0)
        }
    });
}

export async function PUT(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, bio } = body;

    // Validation
    if (!name || name.length < 2) {
        return NextResponse.json({ error: "Name too short" }, { status: 400 });
    }

    // Update
    await db.update(users)
        .set({ name, bio, image: body.image }) // Allow image update if passed
        .where(eq(users.email, session.user.email));

    return NextResponse.json({ success: true });
}
