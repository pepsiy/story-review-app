"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReadingHistory {
    workSlug: string;
    workTitle: string;
    chapterNumber: number;
    timestamp: number;
}

export function ReadingHistoryWidget() {
    const [history, setHistory] = useState<ReadingHistory[]>([]);

    useEffect(() => {
        // Load reading history from localStorage
        const stored = localStorage.getItem("readingHistory");
        if (stored) {
            try {
                const parsed: ReadingHistory[] = JSON.parse(stored);
                // Sort by timestamp (most recent first) and take top 5
                const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
                setHistory(sorted);
            } catch (e) {
                console.error("Failed to parse reading history", e);
            }
        }
    }, []);

    if (history.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-5">
                <h3 className="font-bold text-base text-slate-800 mb-4 uppercase border-b pb-2">
                    Truyện Đang Đọc
                </h3>
                <p className="text-sm text-slate-500 italic">Chưa có lịch sử đọc truyện</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="font-bold text-base text-slate-800 mb-4 uppercase border-b pb-2">
                Truyện Đang Đọc
            </h3>
            <div className="space-y-3">
                {history.map((item, idx) => (
                    <Link
                        key={idx}
                        href={`/truyen/${item.workSlug}/${item.chapterNumber}`}
                        className="block group"
                    >
                        <div className="flex items-start justify-between gap-2 hover:bg-slate-50 p-2 rounded transition-colors">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 font-medium truncate group-hover:text-blue-600">
                                    ❯ {item.workTitle}
                                </p>
                            </div>
                            <span className="text-xs text-blue-600 font-semibold whitespace-nowrap">
                                Đọc tiếp C{item.chapterNumber}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
