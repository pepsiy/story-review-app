import { db } from "@repo/db";
import { works, chapters } from "@repo/db";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LikeButton } from "@/components/LikeButton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const work = await db.select().from(works).where(eq(works.slug, slug)).limit(1);

    if (!work[0]) return { title: "Không tìm thấy truyện" };

    return {
        title: `${work[0].title} - Review & Tóm Tắt | StoryReview`,
        description: work[0].description || `Đọc review truyện ${work[0].title} của tác giả ${work[0].author}.`,
    };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Query work and chapters
    const workList = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
    const work = workList[0];

    if (!work) notFound();

    const chapterList = await db.select({
        id: chapters.id,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        status: chapters.status,
        sourceChapterRange: chapters.sourceChapterRange,
    })
        .from(chapters)
        .where(eq(chapters.workId, work.id))
        .orderBy(asc(chapters.chapterNumber));

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Breadcrumb */}
            <div className="bg-white border-b py-2">
                <div className="container mx-auto px-4 max-w-6xl text-sm text-slate-600">
                    <Link href="/" className="hover:text-blue-600 transition-colors">Trang chủ</Link>
                    <span className="mx-2 text-slate-400">/</span>
                    <span className="text-slate-900">{work.title}</span>
                </div>
            </div>

            <main className="container mx-auto px-4 py-6 max-w-6xl">
                {/* Compact Info Section */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col md:flex-row p-5 gap-5 mb-6">
                    {/* Smaller Cover Image */}
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
                        {/* Compact Title & Metadata */}
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1.5 leading-tight">{work.title}</h1>
                        <p className="text-base text-slate-600 mb-3">
                            Tác giả: <span className="text-blue-600 font-medium">{work.author || "Unknown"}</span>
                        </p>

                        {/* Compact Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                                {work.genre || "Truyện Chữ"}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${work.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>
                                {work.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang ra'}
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

                        {/* Action Buttons - Compact */}
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
                                <Button disabled className="bg-slate-300 px-4 py-2 text-sm">Đang Cập Nhật</Button>
                            )}
                            <div className="ml-auto">
                                <LikeButton workId={work.id} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Chapter List */}
                    <div className="lg:col-span-2">
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
                                                ({ch.sourceChapterRange.replace(',', '-')})
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right: Sidebar */}
                    <div className="space-y-5">
                        <div className="bg-white p-5 rounded-lg shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-3 text-base">Cùng Thể Loại</h3>
                            <div className="space-y-2">
                                <p className="text-sm text-slate-500 italic">Đang cập nhật...</p>
                            </div>
                        </div>
                    </div>

                </div>

            </main>
        </div>
    );
}
