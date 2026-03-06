import { db } from "@repo/db";
import { works, chapters, seoMeta } from "@repo/db";
import { eq, asc, ilike, ne, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LikeButton } from "@/components/LikeButton";
import { ViewTracker } from "@/components/ViewTracker";
import { WorkCommentSection } from "@/components/WorkCommentSection";
import { auth } from "@/auth";
import { generateArticleJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 60;

// Helper: normalize genre name to slug (same logic as backend)
function genreNameToSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Query work details
    const workList = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
    const work = workList[0];
    if (!work) return { title: "Không tìm thấy truyện" };

    // Query SEO meta from specialized table
    const seoList = await db.select().from(seoMeta).where(and(eq(seoMeta.entityType, "WORK"), eq(seoMeta.entityId, work.id))).limit(1);
    const seo = seoList[0];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://storyreview.com';
    const url = `${baseUrl}/truyen/${slug}`;
    const title = seo?.title || `${work.title} - Review & Tóm Tắt | StoryReview`;
    const description = seo?.description || work.description || `Đọc review truyện ${work.title} mới nhất, chuẩn xác nhất từ đọc giả StoryReview.`;
    const canonicalUrl = url;

    // Choose cover image
    const coverImageUrl = seo?.ogImage || work.coverImage;
    const images = coverImageUrl ? [{ url: coverImageUrl, width: 1200, height: 630, alt: title }] : [];

    const publishedTime = work.createdAt ? work.createdAt.toISOString() : new Date().toISOString();
    const modifiedTime = work.updatedAt ? work.updatedAt.toISOString() : publishedTime;
    const section = work.genre ? work.genre.split(',')[0].trim() : undefined;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title,
            description,
            url,
            siteName: "StoryReview",
            locale: "vi_VN",
            type: "article",
            images,
            publishedTime,
            modifiedTime,
            authors: work.author ? [work.author] : undefined,
            section,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images,
        }
    };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const session = await auth();
    const user = session?.user;

    // Query work
    const workList = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
    const work = workList[0];
    if (!work) notFound();

    // Query chapters
    const chapterList = await db
        .select({
            id: chapters.id,
            title: chapters.title,
            chapterNumber: chapters.chapterNumber,
            status: chapters.status,
            sourceChapterRange: chapters.sourceChapterRange,
        })
        .from(chapters)
        .where(eq(chapters.workId, work.id))
        .orderBy(asc(chapters.chapterNumber));

    // Parse genres: split by comma, trim, deduplicate
    const rawGenres = work.genre || "";
    const genreTags = [...new Set(
        rawGenres.split(",").map(g => g.trim()).filter(g => g.length > 0)
    )];

    // Find related works (same genre, different work)
    let relatedWorks: typeof workList = [];
    if (genreTags.length > 0) {
        // Use the first genre to find related works
        const firstGenre = genreTags[0];
        relatedWorks = await db
            .select({
                id: works.id,
                title: works.title,
                slug: works.slug,
                coverImage: works.coverImage,
                author: works.author,
                genre: works.genre,
                status: works.status,
                views: works.views,
                isHot: works.isHot,
                description: works.description,
                updatedAt: works.updatedAt,
                createdAt: works.createdAt,
                deletedAt: works.deletedAt,
            })
            .from(works)
            .where(and(ilike(works.genre, `%${firstGenre}%`), ne(works.id, work.id)))
            .orderBy(desc(works.views))
            .limit(5);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://storyreview.com';
    const currentUrl = `${baseUrl}/truyen/${slug}`;
    const articleJsonLd = generateArticleJsonLd(work, currentUrl, work.coverImage || "");
    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
        { name: "Trang chủ", url: baseUrl },
        { name: work.title, url: currentUrl },
    ]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            {/* Breadcrumb - Semantic <nav> */}
            <nav aria-label="breadcrumb" className="bg-white border-b py-2">
                <div className="container mx-auto px-4 max-w-6xl text-sm text-slate-600">
                    <Link href="/" className="hover:text-blue-600 transition-colors">Trang chủ</Link>
                    <span className="mx-2 text-slate-400" aria-hidden="true">/</span>
                    <span className="text-slate-900" aria-current="page">{work.title}</span>
                </div>
            </nav>

            <main className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Info Section - Semantic <article> wrapper starts */}
                <article className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col md:flex-row p-5 gap-5 mb-6">
                    {/* Cover Image */}
                    <div className="w-full md:w-44 flex-shrink-0">
                        <div className="aspect-[2/3] relative rounded overflow-hidden shadow bg-slate-200">
                            <img
                                src={work.coverImage || "https://placehold.co/300x450?text=No+Cover"}
                                alt={work.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1.5 leading-tight">
                            {work.title}
                        </h1>

                        {/* Author — clickable link */}
                        <p className="text-base text-slate-600 mb-3">
                            Tác giả:{" "}
                            <Link
                                href={`/search?author=${encodeURIComponent(work.author || "")}`}
                                className="text-blue-600 font-medium hover:underline hover:text-blue-700 transition-colors"
                            >
                                {work.author || "Unknown"}
                            </Link>
                        </p>

                        {/* Genre Tags — split, deduped, each a link */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {genreTags.map((tag) => (
                                <Link
                                    key={tag}
                                    href={`/the-loai/${genreNameToSlug(tag)}`}
                                    className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-colors"
                                >
                                    {tag}
                                </Link>
                            ))}
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${work.status === "COMPLETED"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : "bg-yellow-50 text-yellow-700 border-yellow-100"
                                }`}>
                                {work.status === "COMPLETED" ? "Hoàn thành" : "Đang ra"}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                                {work.views?.toLocaleString() || 0} lượt xem
                            </span>
                        </div>

                        {/* Description */}
                        {work.description && (
                            <div className="prose max-w-none text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded border-l-2 border-blue-500">
                                <p className="leading-relaxed">{work.description}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {chapterList.length > 0 ? (
                                <>
                                    <Link href={`/truyen/${slug}/${chapterList[0].chapterNumber}`}>
                                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm shadow-sm">
                                            Đọc Chương 1
                                        </Button>
                                    </Link>
                                    <Link href={`/truyen/${slug}/${chapterList[chapterList.length - 1].chapterNumber}`}>
                                        <Button variant="outline" className="px-4 py-2 rounded-lg text-sm border-slate-300 hover:bg-slate-50">
                                            Chương Mới Nhất
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <Button disabled className="bg-slate-300 px-4 py-2 text-sm">
                                    Đang Cập Nhật
                                </Button>
                            )}
                            <div className="ml-auto">
                                <LikeButton workId={work.id} />
                            </div>
                        </div>
                    </div>
                </article>

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Chapter List + Comments Tabs */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Chapter List */}
                        <section className="bg-white p-5 rounded-lg shadow-sm" id="chuong">
                            <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b flex items-center justify-between">
                                <span>Danh Sách Chương</span>
                                <span className="text-sm font-normal text-slate-500">{chapterList.length} chương</span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[500px] overflow-y-auto pr-1">
                                {chapterList.map((ch) => (
                                    <Link
                                        key={ch.id}
                                        href={`/truyen/${slug}/${ch.chapterNumber}`}
                                        className="block px-3 py-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-sm text-slate-700 truncate cursor-pointer"
                                    >
                                        <span className="mr-2 font-mono text-slate-400 text-xs">#{ch.chapterNumber}</span>
                                        <span className="font-medium">{ch.title || `Chương ${ch.chapterNumber}`}</span>
                                        {ch.sourceChapterRange && (
                                            <span className="ml-2 text-xs text-slate-500">
                                                ({ch.sourceChapterRange.replace(",", "-")})
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </section>

                        {/* Comments Section */}
                        <WorkCommentSection workId={work.id} workSlug={slug} user={user} />
                    </div>

                    {/* Right: Sidebar - Semantic <aside> */}
                    <aside className="space-y-5">
                        {/* Same Genre */}
                        <div className="bg-white p-5 rounded-lg shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-3 text-base border-b pb-2">
                                📚 Cùng Thể Loại
                            </h3>
                            {relatedWorks.length > 0 ? (
                                <div className="space-y-3">
                                    {relatedWorks.map((rw) => (
                                        <Link
                                            key={rw.id}
                                            href={`/truyen/${rw.slug}`}
                                            className="flex gap-3 group hover:bg-slate-50 rounded-lg p-1.5 transition-colors"
                                        >
                                            <div className="w-12 flex-shrink-0">
                                                <div className="aspect-[2/3] rounded overflow-hidden bg-slate-100">
                                                    <img
                                                        src={rw.coverImage || "https://placehold.co/60x90?text=?"}
                                                        alt={rw.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 leading-tight line-clamp-2 transition-colors">
                                                    {rw.title}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{rw.author}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">Không tìm thấy truyện cùng thể loại.</p>
                            )}
                        </div>
                    </aside>
                </div>

                <ViewTracker workId={work.id} />
            </main>
        </div>
    );
}
