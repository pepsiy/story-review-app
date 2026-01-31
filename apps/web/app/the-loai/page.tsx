import { db, works } from "@repo/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default async function GenrePage() {
    // Fetch all works to extract genres
    // Ideally, we should have a separate Genres table or use distinct query
    // But since genre is just a string column, let's pull all and filter unique
    const allWorks = await db.select({ genre: works.genre }).from(works);

    // Extract unique genres, split by comma if multiple genres are stored in one string?
    // Based on "Tiên Hiệp, Huyền Huyễn", it seems comma separated.
    const genreSet = new Set<string>();

    allWorks.forEach(w => {
        if (w.genre) {
            w.genre.split(',').forEach(g => genreSet.add(g.trim()));
        } else {
            genreSet.add("Truyện Chữ"); // Default
        }
    });

    const genres = Array.from(genreSet).sort();

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <main className="container mx-auto px-4 py-8">
                <div className="bg-white p-8 rounded-xl shadow-sm mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">📂 Danh Sách Thể Loại</h1>
                    <p className="text-slate-600">Khám phá truyện theo các thể loại hấp dẫn.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {genres.map((g, idx) => (
                        <Link key={idx} href={`/search?q=${encodeURIComponent(g)}`} className="block group">
                            <div className="bg-white border rounded-lg p-6 text-center shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group-hover:-translate-y-1">
                                <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-600">{g}</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {genres.length === 0 && (
                    <p className="text-center text-slate-500 py-12">Chưa có thể loại nào.</p>
                )}
            </main>
        </div>
    );
}
