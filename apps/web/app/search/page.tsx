import { db, works } from "@repo/db";
import { ilike, or, like } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

function WorkCard({ work }: { work: any }) {
    return (
        <Link href={`/truyen/${work.slug}`} className="group relative block h-full">
            <Card className="h-full overflow-hidden border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
                <div className="aspect-[2/3] relative overflow-hidden bg-slate-200">
                    <img
                        src={work.coverImage || "https://placehold.co/400x600?text=No+Cover"}
                        alt={work.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="absolute bottom-0 left-0 p-4 w-full">
                        <p className="text-white text-sm font-medium opacity-90 truncate">{work.author || "Unknown Author"}</p>
                    </div>
                </div>
                <CardContent className="p-4">
                    <h3 className="font-bold text-lg text-slate-800 leading-tight mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {work.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
                        <span className="bg-slate-100 px-2 py-1 rounded">{work.genre || "Truyện Chữ"}</span>
                        <span>{work.views?.toLocaleString() || 0} xem</span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
    const { q } = await searchParams;
    const query = q ? decodeURIComponent(q).trim().toLowerCase() : "";

    // Ideally use full-text search or proper ILIKE
    // Drizzle with SQLite/Postgres simple implementation:
    // Fetch all (or subset) and filter in memory if simple, or use ORM operators.
    // Let's use ORM operators if possible.
    // Since 'genre' is comma separated string, we can use LIKE

    // Note: Drizzle 'ilike' is for Postgres. 'like' corresponds to SQL LIKE.
    // Let's assume Postgres (from neon config).

    let results = [];
    if (query) {
        // Simple search: Title contains query OR Genre contains query
        // NOTE: `ilike` is case-insensitive match in Postgres
        results = await db.select().from(works).where(
            or(
                ilike(works.title, `%${query}%`),
                ilike(works.genre, `%${query}%`)
            )
        );
    } else {
        // Empty search shows latest works? or nothing?
        // Let's show latest 20
        results = await db.select().from(works).limit(20);
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8">
                <div className="bg-white p-8 rounded-xl shadow-sm mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        🔍 Kết quả tìm kiếm: <span className="text-indigo-600">"{query}"</span>
                    </h1>
                    <p className="text-slate-600">Tìm thấy {results.length} truyện phù hợp.</p>
                </div>

                {results.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {results.map((work) => (
                            <WorkCard key={work.id} work={work} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-xl text-slate-500 mb-4">Không tìm thấy truyện nào.</p>
                        <Link href="/">
                            <Button>Về Trang Chủ</Button>
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
