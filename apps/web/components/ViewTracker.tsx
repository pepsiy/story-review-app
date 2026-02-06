"use client";

import { useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function ViewTracker({ workId }: { workId: number }) {
    const hasIncremented = useRef(false);

    useEffect(() => {
        if (hasIncremented.current) return;
        hasIncremented.current = true;

        const incrementView = async () => {
            try {
                await fetch(`${API_URL}/admin/works/${workId}/view`, {
                    method: "POST",
                });
            } catch (error) {
                console.error("Failed to increment view", error);
            }
        };

        incrementView();
    }, [workId]);

    return null; // This component handles logic only, no UI
}
