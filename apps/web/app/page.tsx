import { db } from "@repo/db";
import { works } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Ensure Input component exists or remove use
import Link from "next/link";
import Image from "next/image";
import { ReadingHistoryWidget } from "@/components/ReadingHistoryWidget";
import { GenresWidget } from "@/components/GenresWidget";

export default async function Home() {
  // Fetch data for 3 sections in parallel
  // Fetch data for 3 sections in parallel with error handling
  let hotWorks: any[] = [], newWorks: any[] = [], completedWorks: any[] = [];

  try {
    [hotWorks, newWorks, completedWorks] = await Promise.all([
      db.select().from(works).where(eq(works.isHot, true)).limit(4),
      db.select().from(works).orderBy(desc(works.updatedAt)).limit(4),
      db.select().from(works).where(eq(works.status, 'COMPLETED')).limit(4),
    ]);
  } catch (error) {
    console.warn("⚠️ Failed to fetch data (likely during build):", error);
    // Return empty arrays to allow build to complete
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-9 space-y-10">

            {/* Section: Hot Stories */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-red-600">
                🔥 Truyện Hot Hôm Nay
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {hotWorks.map((work) => (
                  <WorkCard key={work.id} work={work} badge="HOT" badgeColor="bg-red-500" size="large" />
                ))}
              </div>
            </section>

            {/* Section: New Stories */}
            <section>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-blue-600">
                🆕 Truyện Mới Cập Nhật
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {newWorks.map((work) => (
                  <WorkCard key={work.id} work={work} badge="NEW" badgeColor="bg-blue-500" />
                ))}
              </div>
            </section>

            {/* Section: Completed Stories */}
            <section>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-green-600">
                ✨ Truyện Đã Hoàn Thành
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {completedWorks.map((work) => (
                  <WorkCard key={work.id} work={work} badge="FULL" badgeColor="bg-green-500" />
                ))}
              </div>
            </section>

          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-5">
            <ReadingHistoryWidget />
            <GenresWidget />
          </aside>

        </div>
      </main>


    </div>
  );
}

function WorkCard({ work, badge, badgeColor, size = "small" }: { work: any, badge?: string, badgeColor?: string, size?: "large" | "small" }) {
  const isLarge = size === "large";
  return (
    <Link href={`/truyen/${work.slug}`} className="group relative block h-full cursor-pointer">
      <Card className="h-full overflow-hidden border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white">
        <div className={`${isLarge ? "aspect-[2/3]" : "aspect-[3/4]"} relative overflow-hidden bg-slate-200`}>
          {/* Fallback image if coverImage is invalid or empty */}
          <img
            src={work.coverImage || "https://placehold.co/400x600?text=No+Cover"}
            alt={work.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {badge && (
            <span className={`absolute top-1.5 right-1.5 ${badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow`}>
              {badge}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 p-2 w-full">
            <p className="text-white text-xs font-medium truncate">{work.author || "Unknown"}</p>
          </div>
        </div>
        <CardContent className={isLarge ? "p-4" : "p-3"}>
          <h3 className={`font-bold ${isLarge ? "text-base" : "text-sm"} text-slate-800 leading-tight ${isLarge ? "mb-2" : "mb-1.5"} line-clamp-2 group-hover:text-blue-600 transition-colors`}>
            {work.title}
          </h3>
          <div className={`flex items-center justify-between ${isLarge ? "text-xs" : "text-[10px]"} text-slate-500 ${isLarge ? "mt-3" : "mt-2"}`}>
            <span className="bg-slate-100 px-1.5 py-0.5 rounded truncate">{work.genre || "Truyện"}</span>
            <span className="whitespace-nowrap">{work.views?.toLocaleString() || 0}👁</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
