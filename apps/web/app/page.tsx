import { db } from "@repo/db";
import { works, chapters } from "@repo/db";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ReadingHistoryWidget } from "@/components/ReadingHistoryWidget";
import { GenresWidget } from "@/components/GenresWidget";

export default async function Home() {
  let hotWorks: any[] = [], newWorks: any[] = [];

  try {
    // Fetch hot works + chapter count for each
    const rawHot = await db.select().from(works).where(eq(works.isHot, true)).limit(12);
    const rawNew = await db.select().from(works).orderBy(desc(works.updatedAt)).limit(12);

    // Attach chapter count to each work
    const addChapterCount = async (workList: any[]) => {
      return Promise.all(workList.map(async (w) => {
        const res = await db.select({ count: sql<number>`count(*)` })
          .from(chapters)
          .where(eq(chapters.workId, w.id));
        return { ...w, chapterCount: Number(res[0]?.count || 0) };
      }));
    };

    [hotWorks, newWorks] = await Promise.all([
      addChapterCount(rawHot),
      addChapterCount(rawNew),
    ]);
  } catch (error) {
    console.warn("⚠️ Failed to fetch data:", error);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-8">

            {/* ===== SECTION: TRUYỆN HOT ===== */}
            <section>
              <div className="flex items-center justify-between mb-4 border-b-2 border-red-500 pb-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  🔥 Truyện Hot Hôm Nay
                </h2>
                <Link href="/truyen?hot=true" className="text-sm text-slate-500 hover:text-red-500 font-medium transition-colors">
                  TẤT CẢ &rsaquo;
                </Link>
              </div>

              {/* Grid phong cách image 2: ảnh bìa lớn, tile cuối có title overlay */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                {hotWorks.map((work) => (
                  <HotWorkCard key={work.id} work={work} />
                ))}
                {hotWorks.length === 0 && (
                  <div className="col-span-6 py-8 text-center text-slate-400">Chưa có truyện hot</div>
                )}
              </div>
            </section>

            {/* ===== SECTION: MỚI CẬP NHẬT ===== */}
            <section>
              <div className="flex items-center justify-between mb-0 border-b-2 border-blue-500 pb-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  MỚI CẬP NHẬT <span className="text-slate-400 font-normal">›</span>
                </h2>
                <Link href="/truyen" className="text-sm text-slate-500 hover:text-blue-500 font-medium transition-colors">
                  TẤT CẢ
                </Link>
              </div>

              {/* 2-column list phong cách image 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y divide-slate-100">
                {newWorks.map((work, idx) => (
                  <NewWorkRow key={work.id} work={work} index={idx} />
                ))}
                {newWorks.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-slate-400">Chưa có truyện</div>
                )}
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

// ============================================================
//  HotWorkCard — card bìa lớn với title overlay ở bottom
// ============================================================
function HotWorkCard({ work }: { work: any }) {
  return (
    <Link href={`/truyen/${work.slug}`} className="group relative block">
      <div className="relative aspect-[2/3] rounded overflow-hidden bg-slate-200">
        {/* Ảnh bìa */}
        <img
          src={work.coverImage || "https://placehold.co/200x300?text=No+Cover"}
          alt={work.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Checkmark icon (top-left) */}
        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Play button icon (top-right) */}
        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-500/90 flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2 drop-shadow">
            {work.title}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
//  NewWorkRow — list item 2-column phong cách image 1
// ============================================================
function NewWorkRow({ work, index }: { work: any; index: number }) {
  // Alternating: odd items have a divider on the right for 2-column effect
  const timeAgo = getTimeAgo(work.updatedAt);

  // Parse genres from comma-separated string
  const genreTags = work.genre
    ? work.genre.split(",").map((g: string) => g.trim()).filter(Boolean).slice(0, 2)
    : [];

  return (
    <Link
      href={`/truyen/${work.slug}`}
      className={`flex items-start gap-3 px-3 py-3 hover:bg-blue-50/60 transition-colors group border-slate-100 ${index % 2 === 0 ? "md:border-r" : ""
        }`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-[54px] h-[72px] rounded overflow-hidden bg-slate-200">
        <img
          src={work.coverImage || "https://placehold.co/108x144?text=No"}
          alt={work.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Text info */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight mb-0.5">
          {work.title}
        </h3>

        {/* Chapter info */}
        <p className="text-xs text-blue-600 font-medium mb-0.5">
          Chương {work.chapterCount || "—"}
        </p>

        {/* Genres + Author row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
          {genreTags.map((g: string) => (
            <span key={g} className="text-[11px] text-slate-500 flex items-center gap-0.5">
              <span className="text-slate-400">✏</span>
              {g}
            </span>
          ))}
          {work.author && (
            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
              <span>✏</span>
              {work.author}
            </span>
          )}
        </div>
      </div>

      {/* Time on far right */}
      <div className="flex-shrink-0 text-[11px] text-slate-400 whitespace-nowrap pt-0.5">
        {timeAgo}
      </div>
    </Link>
  );
}

// ============================================================
//  Helper: relative time
// ============================================================
function getTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "vừa xong";
  if (diffMins < 60) return `${diffMins} phút`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày`;

  // Format date for older entries
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
