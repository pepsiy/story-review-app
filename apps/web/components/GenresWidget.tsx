"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Genre {
    id: number;
    name: string;
    slug: string;
}

export function GenresWidget() {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                // Use public API endpoint
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                const res = await fetch(`${API_URL}/genres`);
                if (res.ok) {
                    const data = await res.json();
                    setGenres(data);
                }
            } catch (error) {
                console.error("Failed to load genres", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGenres();
    }, []);

    if (loading) return (
        <div className="bg-white p-4 rounded-lg shadow-sm animate-pulse h-40">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="grid grid-cols-2 gap-2">
                <div className="h-3 bg-gray-100 rounded"></div>
                <div className="h-3 bg-gray-100 rounded"></div>
                <div className="h-3 bg-gray-100 rounded"></div>
                <div className="h-3 bg-gray-100 rounded"></div>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 uppercase text-sm border-b pb-2">
                THỂ LOẠI TRUYỆN
            </h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                {genres.length > 0 ? (
                    genres.map((genre) => (
                        <Link
                            key={genre.id}
                            href={`/the-loai/${genre.slug}`}
                            className="text-slate-600 hover:text-indigo-600 text-sm py-1 transition-colors"
                        >
                            {genre.name}
                        </Link>
                    ))
                ) : (
                    <p className="text-gray-400 text-xs col-span-2">Chưa cập nhật thể loại</p>
                )}
            </div>
        </div>
    );
}
