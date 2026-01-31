import { db, works } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

function WorkCard({ work, rank, badge, badgeColor }: { work: any, rank?: number, badge?: string, badgeColor?: string }) {
    return (
        <Link href={`/truyen/${work.slug}`} className="group relative block h-full">
            <Card className="h-full overflow-hidden border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
                <div className="aspect-[2/3] relative overflow-hidden bg-slate-200">
                    <img
                        src={work.coverImage || "https://placehold.co/400x600?text=No+Cover"}
                        alt={work.title}
                        // Use plain img tag for simplicity or Image component if configured
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {badge && (
                        <span className={`absolute top-2 right-2 ${badgeColor} text-white text-xs font-bold px-2 py-1 rounded shadow-lg`}>
                            {badge}
                        </span>
                    )}
                    {/* Rank Badge */}
                    {rank && (
                        <div className={`absolute top-0 left-0 w-8 h-8 flex items-center justify-center font-bold text-white shadow-lg
                    ${rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-slate-400' : rank === 3 ? 'bg-amber-600' : 'bg-slate-800/80'}
               `}>
                            {rank}
                        </div>
                    )}

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

export default async function RankingsPage() {
    // Fetch Top Views (Top 10)
    const topViews = await db.select().from(works).orderBy(desc(works.views)).limit(10);

    // Fetch Hot Stories (Top 10) - reused from existing logic
    const hotWorks = await db.select().from(works).where(eq(works.isHot, true)).orderBy(desc(works.updatedAt)).limit(10);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8 space-y-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">🏆 Bảng Xếp Hạng</h1>
                    <p className="text-slate-600">Top những truyện được đọc nhiều nhất và yêu thích nhất.</p>
                </div>

                {/* Section: Top Views */}
                <section>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
                        <h2 className="text-2xl font-bold text-yellow-800 mb-6 flex items-center gap-2">
                            👑 Top Xem Nhiều Nhất
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {topViews.map((work, index) => (
                                <WorkCard key={work.id} work={work} rank={index + 1} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* Section: Hot Stories */}
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        🔥 Truyện Hot Đề Cử
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {hotWorks.map((work, index) => (
                            <WorkCard key={work.id} work={work} badge="HOT" badgeColor="bg-red-500" />
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
