"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";

interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export function UserNavClient({ user, signOutAction }: { user: User, signOutAction: () => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 focus:outline-none hover:opacity-80 transition-opacity"
            >
                <div className="w-9 h-9 relative rounded-full overflow-hidden border border-slate-200">
                    <img
                        src={user.image || "https://placehold.co/100x100?text=U"}
                        alt={user.name || "User"}
                        className="object-cover w-full h-full"
                    />
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-4 py-2 border-b border-slate-50">
                        <p className="text-sm font-semibold truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsOpen(false)}
                    >
                        👤 Hồ sơ cá nhân
                    </Link>

                    <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setIsOpen(false)}
                    >
                        ⭐ Truyện đã thích
                    </Link>

                    <div className="border-t border-slate-50 mt-1">
                        <form action={signOutAction}>
                            <button type="submit" className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                🚪 Đăng xuất
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
