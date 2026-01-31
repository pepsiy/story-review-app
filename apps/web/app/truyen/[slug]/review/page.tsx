import { db } from "@repo/db";
import { works } from "@repo/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const { slug } = params;
    const work = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
    if (!work[0]) return { title: "Không tìm thấy review" };
    return {
        title: `Review chi tiết truyện ${work[0].title}`,
        description: `Phân tích cốt truyện, nhân vật và đánh giá truyện ${work[0].title}.`,
    };
}

export default async function ReviewPage({ params }: { params: { slug: string } }) {
    const { slug } = params;
    const workList = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
    const work = workList[0];

    if (!work) notFound();

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Breadcrumb */}
            <div className="bg-white border-b py-3">
                <div className="container mx-auto px-4 text-sm text-slate-500">
                    <Link href="/" className="hover:text-indigo-600">Trang chủ</Link>
                    <span className="mx-2">/</span>
                    <Link href={`/truyen/${slug}`} className="hover:text-indigo-600">{work.title}</Link>
                    <span className="mx-2">/</span>
                    <span className="font-medium text-slate-800">Review Chi Tiết</span>
                </div>
            </div>

            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="bg-white rounded-xl shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-6 border-b pb-4">
                        Review Truyện: {work.title}
                    </h1>

                    <div className="prose max-w-none text-slate-800 space-y-8">
                        <section>
                            <h3 className="text-xl font-bold text-indigo-700 mb-2">1. Bối Cảnh Chính</h3>
                            <p>
                                (Nội dung đang được cập nhật bởi đội ngũ Reviewer...) <br />
                                <i>Đây là không gian huyền ảo nơi các đấu khí sư thống trị...</i>
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-indigo-700 mb-2">2. Nhân Vật Nổi Bật</h3>
                            <p>
                                (Nội dung đang được cập nhật bởi đội ngũ Reviewer...) <br />
                                <i>Nhân vật chính kiên cường, thông minh...</i>
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-indigo-700 mb-2">3. Diễn Biến Chính</h3>
                            <p>
                                (Nội dung đang được cập nhật bởi đội ngũ Reviewer...)
                            </p>
                        </section>

                        <section className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                            <h3 className="text-xl font-bold text-indigo-800 mb-2">4. Kết Luận (AI)</h3>
                            <p>
                                {work.description}
                            </p>
                        </section>
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-center">
                        <Link href={`/truyen/${slug}`}>
                            <Button variant="outline" className="mr-4">Quay lại trang truyện</Button>
                        </Link>
                        <Link href={`/truyen/${slug}/1`}>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Đọc ngay Chương 1</Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
