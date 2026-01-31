"use client";

import { useEffect } from "react";

interface SaveReadingHistoryProps {
    workSlug: string;
    workTitle: string;
    chapterNumber: number;
}

export function SaveReadingHistory({ workSlug, workTitle, chapterNumber }: SaveReadingHistoryProps) {
    useEffect(() => {
        // Save to localStorage
        const history = localStorage.getItem("readingHistory");
        let historyArray: Array<{
            workSlug: string;
            workTitle: string;
            chapterNumber: number;
            timestamp: number;
        }> = [];

        if (history) {
            try {
                historyArray = JSON.parse(history);
            } catch (e) {
                console.error("Failed to parse reading history", e);
            }
        }

        // Remove existing entry for this work if exists
        historyArray = historyArray.filter((item) => item.workSlug !== workSlug);

        // Add new entry at the beginning
        historyArray.unshift({
            workSlug,
            workTitle,
            chapterNumber,
            timestamp: Date.now(),
        });

        // Keep only the last 10 entries
        historyArray = historyArray.slice(0, 10);

        // Save back to localStorage
        localStorage.setItem("readingHistory", JSON.stringify(historyArray));
    }, [workSlug, workTitle, chapterNumber]);

    return null; // This component doesn't render anything
}
