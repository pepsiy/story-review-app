import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <nav className="bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="text-xl font-bold text-gray-800">Admin Dashboard</Link>
                    <Link href="/" className="text-sm text-gray-500 hover:text-indigo-600">View Site</Link>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/admin/works/create">
                        <Button>+ Thêm Truyện Mới</Button>
                    </Link>
                </div>
            </nav>
            <main className="p-6">
                {children}
            </main>
        </div>
    );
}
