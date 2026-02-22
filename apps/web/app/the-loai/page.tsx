import { db } from "@repo/db";
import { genres } from "@repo/db";
import { asc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function GenrePage() {
    const genreList = await db.select().from(genres).orderBy(asc(genres.name));

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8">
                <div className="bg-white p-8 rounded-xl shadow-sm mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">📂 Danh Sách Thể Loại</h1>
                    <p className="text-slate-600">Khám phá truyện theo các thể loại hấp dẫn.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {genreList.map((genre) => (
                        <Link key={genre.id} href={`/the-loai/${genre.slug}`} className="block group">
                            <div className="bg-white border rounded-lg p-6 text-center shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group-hover:-translate-y-1">
                                <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-600">{genre.name}</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {genreList.length === 0 && (
                    <p className="text-center text-slate-500 py-12">Chưa có thể loại nào.</p>
                )}
            </main>
        </div>
    );
}
