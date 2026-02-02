"use client";

import { useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/admin";

export function ViewTracker({ workId }: { workId: number }) {
    const hasIncremented = useRef(false);

    useEffect(() => {
        if (hasIncremented.current) return;
        hasIncremented.current = true;

        const incrementView = async () => {
            try {
                // Determine the base URL. If API_URL ends with /admin, we use it directly or strip it if the endpoint is different.
                // Our route is /admin/works/:id/view because we mounted admin routes at /admin in index.ts
                // wait, in index.ts: app.use("/admin", adminRoutes);
                // So the route is /admin/works/:id/view.

                await fetch(`${API_URL}/works/${workId}/view`, {
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
