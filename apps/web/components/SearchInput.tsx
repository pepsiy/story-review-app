"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchInput() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Tìm truyện..."
                className="w-full pl-4 pr-10 py-2 border rounded-full bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearch}
            />
            <button
                onClick={() => searchTerm.trim() && router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-indigo-600"
            >
                🔍
            </button>
        </div>
    );
}
