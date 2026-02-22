import { db } from "@repo/db";
import { genres, works } from "@repo/db";
import { eq, ilike } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const genre = await db.select().from(genres).where(eq(genres.slug, slug)).limit(1);
    if (!genre[0]) return { title: "Thể loại không tồn tại" };
    return {
        title: `Truyện ${genre[0].name} | Tóm Tắt Truyện`,
        description: `Danh sách các bộ truyện thể loại ${genre[0].name}`,
    };
}

export default async function GenreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Get genre by slug
    const genreList = await db.select().from(genres).where(eq(genres.slug, slug)).limit(1);
    const genre = genreList[0];

    if (!genre) notFound();

    // Get works that contain this genre name (comma-separated genre field)
    const matchingWorks = await db
        .select({
            id: works.id,
            title: works.title,
            slug: works.slug,
            author: works.author,
            coverImage: works.coverImage,
            genre: works.genre,
            status: works.status,
            views: works.views,
            isHot: works.isHot,
        })
        .from(works)
        .where(ilike(works.genre, `%${genre.name}%`));

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <nav className="text-sm text-slate-500 mb-3">
                        <Link href="/" className="hover:text-indigo-600">Trang chủ</Link>
                        <span className="mx-2">/</span>
                        <Link href="/the-loai" className="hover:text-indigo-600">Thể loại</Link>
                        <span className="mx-2">/</span>
                        <span className="text-slate-900 font-medium">{genre.name}</span>
                    </nav>
                    <h1 className="text-3xl font-bold text-slate-900">
                        📚 Truyện thể loại: <span className="text-indigo-600">{genre.name}</span>
                    </h1>
                    <p className="text-slate-500 mt-1">{matchingWorks.length} bộ truyện</p>
                </div>

                {/* Works Grid */}
                {matchingWorks.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {matchingWorks.map((work) => (
                            <Link key={work.id} href={`/truyen/${work.slug}`} className="group block">
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all group-hover:-translate-y-1">
                                    <div className="aspect-[2/3] relative bg-slate-200 overflow-hidden">
                                        <img
                                            src={work.coverImage || "https://placehold.co/200x300?text=No+Cover"}
                                            alt={work.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {work.isHot && (
                                            <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                HOT
                                            </span>
                                        )}
                                        <span className={`absolute bottom-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${work.status === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'} text-white`}>
                                            {work.status === 'COMPLETED' ? 'Full' : 'Đang ra'}
                                        </span>
                                    </div>
                                    <div className="p-2.5">
                                        <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">
                                            {work.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{work.author || "Chưa rõ"}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm">
                        <p className="text-5xl mb-4">📭</p>
                        <p className="text-slate-500">Chưa có truyện nào trong thể loại này.</p>
                        <Link href="/the-loai" className="mt-4 inline-block text-indigo-600 hover:underline text-sm">
                            ← Xem các thể loại khác
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
