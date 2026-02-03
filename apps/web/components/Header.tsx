import Link from "next/link";
import UserNav from "./UserNav";
import { SearchInput } from "./SearchInput";

export function Header() {
    return (
        <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">

                <Link href="/" className="flex items-center gap-3">
                    {/* Access public assets directly with / */}
                    <img src="/logo.png" alt="Tóm Tắt Truyện Logo" width={56} height={56} className="object-contain" />
                    <span className="text-2xl font-bold text-indigo-700 hidden sm:block">Tóm Tắt Truyện</span>
                </Link>
                <div className="flex-1 max-w-md mx-4 hidden md:block">
                    <SearchInput />
                </div>
                <nav className="hidden md:flex items-center gap-6 font-medium text-slate-600">
                    <Link href="/game" className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors font-bold">
                        <span>🧪</span> Tu Tiên
                    </Link>
                    <Link href="/the-loai" className="hover:text-indigo-600 transition-colors">Thể loại</Link>
                    <Link href="/bxh" className="hover:text-indigo-600 transition-colors">BXH</Link>
                    <UserNav />
                </nav>
            </div>
        </header>
    );
}
