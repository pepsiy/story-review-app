"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        // Skip check on login page
        if (pathname === "/admin/login") {
            setAuthorized(true);
            return;
        }

        const cookies = document.cookie.split(';');
        const isAdmin = cookies.some(c => c.trim().startsWith("admin_session="));

        if (!isAdmin) {
            router.push("/admin/login");
        } else {
            setAuthorized(true);
        }
    }, [pathname, router]);

    if (!authorized) return null; // Or loading spinner

    // If on login page, render only children (login form), no sidebar
    if (pathname === "/admin/login") return <>{children}</>;

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-md flex-shrink-0 hidden md:block">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-indigo-700">Admin Dashboard</h2>
                </div>
                <nav className="p-4 space-y-2">
                    <Link href="/admin" className="block px-4 py-2 rounded hover:bg-indigo-50 text-gray-700 font-medium">
                        📊 Thống kê
                    </Link>
                    <Link href="/admin/works" className="block px-4 py-2 rounded hover:bg-indigo-50 text-gray-700 font-medium">
                        📚 Quản lý Truyện
                    </Link>
                    <Link href="/admin/genres" className="block px-4 py-2 rounded hover:bg-indigo-50 text-gray-700 font-medium">
                        🏷️ Quản lý Thể loại
                    </Link>
                    <div className="pt-4 border-t mt-4">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                                document.cookie = "admin_session=; path=/; max-age=0";
                                router.push("/admin/login");
                            }}
                        >
                            🚪 Đăng xuất
                        </Button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                {children}
            </main>
        </div>
    );
}
