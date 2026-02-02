import { Request, Response } from "express";
import { db } from "../../../../packages/db/src";
import { works, users } from "../../../../packages/db/src";
import { sql } from "drizzle-orm";

export const getStats = async (req: Request, res: Response) => {
    try {
        // Total views across all works
        const viewsResult = await db.select({ total: sql<number>`COALESCE(SUM(${works.views}), 0)` }).from(works);
        const totalViews = Number(viewsResult[0]?.total || 0);

        // Total works
        const worksResult = await db.select({ count: sql<number>`COUNT(*)` }).from(works);
        const totalWorks = Number(worksResult[0]?.count || 0);

        // Total users
        const usersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
        const totalUsers = Number(usersResult[0]?.count || 0);

        res.json({
            totalViews,
            totalWorks,
            totalUsers
        });
    } catch (error: any) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
