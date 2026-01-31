import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="container mx-auto px-4 text-center">
                <h3 className="text-xl font-bold text-slate-200 mb-4">Tóm Tắt Truyện</h3>
                <p className="mb-6 max-w-lg mx-auto text-sm leading-relaxed">
                    Nền tảng đánh giá và tóm tắt truyện hàng đầu.
                    Chúng tôi review và viết lại nội dung theo văn phong mới,
                    đảm bảo tôn trọng bản quyền và mang lại trải nghiệm đọc mới lạ.
                </p>
                <div className="flex justify-center gap-8 text-sm font-medium">
                    <Link href="/gioi-thieu" className="hover:text-indigo-400 transition-colors">Giới thiệu</Link>
                    <Link href="/dmca" className="hover:text-indigo-400 transition-colors">DMCA</Link>
                    <Link href="/lien-he" className="hover:text-indigo-400 transition-colors">Liên hệ</Link>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-600">
                    <p>© 2026 Tóm Tắt Truyện. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
