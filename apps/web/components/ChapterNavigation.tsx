"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ChapterNavigationProps {
    workSlug: string;
    currentChapter: number;
    prevChapter: number | null;
    nextChapter: number | null;
    allChapters: Array<{ chapterNumber: number; title: string | null }>;
}

export function ChapterNavigation({
    workSlug,
    currentChapter,
    prevChapter,
    nextChapter,
    allChapters,
}: ChapterNavigationProps) {
    const router = useRouter();

    const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        router.push(`/truyen/${workSlug}/${e.target.value}`);
    };

    return (
        <div className="flex items-center justify-center gap-4 py-4 bg-white border rounded-lg shadow-sm">
            {/* Previous Button */}
            {prevChapter ? (
                <Link href={`/truyen/${workSlug}/${prevChapter}`}>
                    <Button variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                        ◄ Chương trước
                    </Button>
                </Link>
            ) : (
                <Button disabled variant="outline" className="opacity-50">
                    ◄ Chương trước
                </Button>
            )}

            {/* Chapter Dropdown */}
            <select
                value={currentChapter}
                onChange={handleChapterChange}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white border-green-600 rounded-md font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400"
            >
                {allChapters.map((ch) => (
                    <option key={ch.chapterNumber} value={ch.chapterNumber} className="bg-white text-slate-900">
                        Chương {ch.chapterNumber}{ch.title ? `: ${ch.title}` : ""}
                    </option>
                ))}
            </select>

            {/* Next Button */}
            {nextChapter ? (
                <Link href={`/truyen/${workSlug}/${nextChapter}`}>
                    <Button variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                        Chương tiếp ►
                    </Button>
                </Link>
            ) : (
                <Button disabled variant="outline" className="opacity-50">
                    Chương tiếp ►
                </Button>
            )}
        </div>
    );
}
