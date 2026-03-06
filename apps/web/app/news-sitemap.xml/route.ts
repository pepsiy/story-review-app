export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 mins
import { db, works } from "@repo/db";
import { desc, gte } from "drizzle-orm";

export async function GET() {
    // Only include works created within the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const recentWorks = await db.select({
        slug: works.slug,
        title: works.title,
        coverImage: works.coverImage,
        createdAt: works.createdAt,
    })
        .from(works)
        .where(gte(works.createdAt, fortyEightHoursAgo))
        .orderBy(desc(works.createdAt))
        .limit(1000); // Google News sitemap limit is usually 1000

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://storyreview.com';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    for (const work of recentWorks) {
        const url = `${baseUrl}/truyen/${work.slug}`;
        const publishDate = work.createdAt ? work.createdAt.toISOString() : new Date().toISOString();
        const titleEscaped = work.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        xml += `
    <url>
        <loc>${url}</loc>
        <news:news>
            <news:publication>
                <news:name>StoryReview</news:name>
                <news:language>vi</news:language>
            </news:publication>
            <news:publication_date>${publishDate}</news:publication_date>
            <news:title>${titleEscaped}</news:title>
        </news:news>`;

        if (work.coverImage) {
            xml += `
        <image:image>
            <image:loc>${work.coverImage}</image:loc>
            <image:title>${titleEscaped}</image:title>
        </image:image>`;
        }

        xml += `
    </url>`;
    }

    xml += `
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 's-maxage=1800, stale-while-revalidate',
        },
    });
}
