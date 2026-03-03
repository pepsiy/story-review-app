import { db } from "@repo/db";
import { works } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const sParams = await searchParams;
    let title = "Danh Sách Truyện | Tóm Tắt Truyện";
    if (sParams.hot) title = "Truyện Hot | Tóm Tắt Truyện";
    if (sParams.new) title = "Truyện Mới Cập Nhật | Tóm Tắt Truyện";

    return {
        title,
        description: "Danh sách các bộ truyện đang được cập nhật liên tục.",
    };
}

export default async function TruyenListPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const sParams = await searchParams;
    const isHot = sParams.hot === 'true';
    const isNew = sParams.new === '1' || sParams.new === 'true';

    // Base query
    let query = db.select().from(works);

    if (isHot) {
        query = query.where(eq(works.isHot, true)).orderBy(desc(works.views));
    } else if (isNew) {
        query = query.orderBy(desc(works.updatedAt));
    } else {
        query = query.orderBy(desc(works.createdAt));
    }

    // Default limit
    const matchingWorks = await query.limit(50);

    let pageTitle = "Danh Sách Truyện";
    if (isHot) pageTitle = "Truyện Hot";
    if (isNew) pageTitle = "Truyện Mới Cập Nhật";

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <nav className="text-sm text-slate-500 mb-3">
                        <Link href="/" className="hover:text-indigo-600">Trang chủ</Link>
                        <span className="mx-2">/</span>
                        <span className="text-slate-900 font-medium">{pageTitle}</span>
                    </nav>
                    <h1 className="text-3xl font-bold text-slate-900">
                        📚 <span className="text-indigo-600">{pageTitle}</span>
                    </h1>
                    <p className="text-slate-500 mt-1">Đang hiển thị {matchingWorks.length} bộ truyện</p>
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
                        <p className="text-slate-500">Chưa có truyện nào trong danh sách này.</p>
                        <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline text-sm">
                            ← Về trang chủ
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
