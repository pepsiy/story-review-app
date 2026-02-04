import { db } from "@repo/db";
import { works, chapters } from "@repo/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { CommentSection } from "@/components/CommentSection";
import { SaveReadingHistory } from "@/components/SaveReadingHistory";
import { ChapterNavigation } from "@/components/ChapterNavigation";

interface PageProps {
    params: {
        slug: string;
        chapterNumber: string;
    };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; chapterNumber: string }> }): Promise<Metadata> {
    const { slug, chapterNumber } = await params;
    const chapterNum = parseInt(chapterNumber);
    if (isNaN(chapterNum)) return {};

    // Join lookup could be optimized but keeping simple for now
    const work = await db.query.works.findFirst({ where: eq(works.slug, slug) });
    if (!work) return {};

    const chapter = await db.query.chapters.findFirst({
        where: and(
            eq(chapters.workId, work.id),
            eq(chapters.chapterNumber, chapterNum)
        )
    });

    if (!chapter) return { title: "Không tìm thấy chương" };

    return {
        title: `Chương ${chapter.chapterNumber}: ${chapter.title || ""} - ${work.title}`,
        description: chapter.summary || `Đọc tóm tắt Chương ${chapter.chapterNumber} truyện ${work.title}.`,
    };
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string; chapterNumber: string }> }) {
    const { slug, chapterNumber } = await params;
    const session = await auth();
    const chapterNum = parseInt(chapterNumber);
    if (isNaN(chapterNum)) notFound();

    // 1. Fetch Work info
    const work = await db.query.works.findFirst({
        where: eq(works.slug, slug),
    });

    if (!work) notFound();

    // 2. Fetch Current Chapter (Including AI-generated review content for public)
    const chapter = await db.query.chapters.findFirst({
        where: and(
            eq(chapters.workId, work.id),
            eq(chapters.chapterNumber, chapterNum)
        ),
        columns: {
            id: true,
            chapterNumber: true,
            title: true,
            aiText: true, // AI-generated review content (public)
            summary: true,
            youtubeId: true, // Video ID
            sourceChapterRange: true,
            createdAt: true,
        }
    });

    if (!chapter) notFound();

    // 3. Navigation (Prev/Next) logic
    const prevChapter = await db.query.chapters.findFirst({
        where: and(eq(chapters.workId, work.id), eq(chapters.chapterNumber, chapterNum - 1)),
        columns: { chapterNumber: true }
    });

    const nextChapter = await db.query.chapters.findFirst({
        where: and(eq(chapters.workId, work.id), eq(chapters.chapterNumber, chapterNum + 1)),
        columns: { chapterNumber: true }
    });

    // 4. Fetch all chapters for dropdown
    const allChapters = await db.query.chapters.findMany({
        where: eq(chapters.workId, work.id),
        columns: { chapterNumber: true, title: true },
        orderBy: asc(chapters.chapterNumber)
    });

    return (
        <div className="container mx-auto py-6 px-4 max-w-5xl">
            <SaveReadingHistory workSlug={work.slug} workTitle={work.title} chapterNumber={chapter.chapterNumber} />
            {/* Breadcrumb */}
            <div className="mb-6 text-sm text-gray-500">
                <Link href="/" className="hover:underline">Trang chủ</Link>
                <span className="mx-2">/</span>
                <Link href={`/truyen/${work.slug}`} className="hover:underline">{work.title}</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Chương {chapter.chapterNumber}</span>
            </div>

            {/* Top Navigation */}
            <div className="mb-6">
                <ChapterNavigation
                    workSlug={work.slug}
                    currentChapter={chapter.chapterNumber}
                    prevChapter={prevChapter?.chapterNumber || null}
                    nextChapter={nextChapter?.chapterNumber || null}
                    allChapters={allChapters}
                />
            </div>

            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">Chương {chapter.chapterNumber}: {chapter.title}</h1>
                <p className="text-slate-500 text-sm">Cập nhật: {new Date(chapter.createdAt!).toLocaleDateString('vi-VN')}</p>
                {chapter.sourceChapterRange && (() => {
                    const [start, end] = chapter.sourceChapterRange.split(',').map((n: string) => n.trim());
                    return (
                        <p className="text-sm text-slate-600 italic mt-1">
                            📖 Tóm tắt từ chương {start} đến {end} của bản gốc
                        </p>
                    );
                })()}
            </div>

            {/* SEO Summary Section */}
            {chapter.summary && (
                <div className="bg-amber-50 border border-amber-100 p-6 rounded-lg mb-8">
                    <h2 className="text-lg font-bold text-amber-800 mb-2 flex items-center">
                        📌 Tóm Tắt / Điểm Chính
                    </h2>
                    <p className="text-amber-900 italic leading-relaxed">{chapter.summary}</p>
                </div>
            )}

            {/* Voice/Video Section */}
            {chapter.youtubeId ? (
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg mb-8 aspect-video">
                    <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${chapter.youtubeId}`}
                        title="Chapter Video Review"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            ) : (
                /* Fallback if no video configured */
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔊</span>
                        <div>
                            <p className="font-semibold text-indigo-900">Nghe đọc Voice AI</p>
                            <p className="text-xs text-indigo-600">Chưa có video cho chương này</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Top */}
            <div className="flex justify-between mb-8">
                {prevChapter ? (
                    <Link href={`/truyen/${work.slug}/${prevChapter.chapterNumber}`}>
                        <Button variant="outline" className="border-slate-300">← Chương trước</Button>
                    </Link>
                ) : <div />}

                {nextChapter ? (
                    <Link href={`/truyen/${work.slug}/${nextChapter.chapterNumber}`}>
                        <Button variant="outline" className="border-slate-300">Chương sau →</Button>
                    </Link>
                ) : <div />}
            </div>

            {/* Content */}
            <div className="chapter-content prose prose-lg max-w-none bg-white p-8 md:p-12 rounded-xl shadow-sm border border-slate-100 text-slate-900 text-[17px] leading-relaxed font-sans">
                {chapter.aiText ? (
                    <div dangerouslySetInnerHTML={{ __html: chapter.aiText.replace(/\n/g, '<br/>') }} />
                ) : (
                    <p className="text-center text-slate-400 italic">Nội dung tóm tắt đang được AI cập nhật...</p>
                )}
            </div>

            {/* Navigation Bottom */}
            <div className="flex justify-between mt-8">
                {prevChapter ? (
                    <Link href={`/truyen/${work.slug}/${prevChapter.chapterNumber}`}>
                        <Button variant="outline">← Chương trước</Button>
                    </Link>
                ) : <div />}

                {nextChapter ? (
                    <Link href={`/truyen/${work.slug}/${nextChapter.chapterNumber}`}>
                        <Button>Chương sau →</Button>
                    </Link>
                ) : <div />}
            </div>

            {/* Bottom Navigation */}
            <div className="mt-8 mb-6">
                <ChapterNavigation
                    workSlug={work.slug}
                    currentChapter={chapter.chapterNumber}
                    prevChapter={prevChapter?.chapterNumber || null}
                    nextChapter={nextChapter?.chapterNumber || null}
                    allChapters={allChapters}
                />
            </div>

            {/* Comment Section */}
            <CommentSection chapterId={chapter.id} user={session?.user} />
        </div>
    );
}
