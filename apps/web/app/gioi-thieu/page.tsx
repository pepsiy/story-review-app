
export default function GioiThieuPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl text-slate-800 font-sans leading-relaxed">
            <h1 className="text-4xl font-bold mb-8 text-indigo-700">Giới Thiệu Về Tóm Tắt Truyện</h1>

            <section className="mb-12">
                <h2 className="text-2xl font-bold mb-4">🎯 Mục Tiêu Dự Án</h2>
                <p className="mb-4">
                    **Tóm Tắt Truyện** ra đời với sứ mệnh mang đến cho cộng đồng độc giả một cách tiếp cận mới mẻ với thế giới văn học mạng.
                    Thay vì đăng tải nguyên văn tác phẩm, chúng tôi tập trung vào việc **Review (Đánh giá)**, **Phân tích**, và **Tóm tắt cốt truyện**.
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                    <li>Hỗ trợ độc giả nắm bắt nhanh nội dung các bộ truyện dài.</li>
                    <li>Cung cấp góc nhìn phân tích đa chiều về nhân vật và cốt truyện.</li>
                    <li>Kết hợp trải nghiệm đọc và nghe (Voice AI) tiện lợi.</li>
                </ul>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold mb-4">💡 Sự Khác Biệt</h2>
                <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                    <p className="mb-4 font-medium">
                        Chúng tôi KHÔNG phải là web truyện dịch/copy thông thường.
                    </p>
                    <p>
                        Toàn bộ nội dung trên **Tóm Tắt Truyện** được viết lại (rewrite) hoàn toàn mới,
                        sử dụng giọng văn kể chuyện lôi cuốn, có lồng ghép cảm nhận cá nhân và phân tích sâu sắc.
                        Điều này đảm bảo tính độc bản (unique) của nội dung và mang lại giá trị gia tăng thực sự cho người đọc.
                    </p>
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">🚀 Định Hướng Phát Triển</h2>
                <p>
                    Trong tương lai, Tóm Tắt Truyện sẽ mở rộng sang nền tảng Video (YouTube) với định dạng
                    Voice đọc truyền cảm kết hợp hình ảnh minh họa sống động, tạo nên một hệ sinh thái nội dung số
                    đa dạng xoay quanh các tác phẩm văn học mạng hấp dẫn.
                </p>
            </section>
        </div>
    );
}
