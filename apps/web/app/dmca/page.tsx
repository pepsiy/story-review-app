
export default function DMCAPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl text-slate-800 font-sans leading-relaxed">
            <h1 className="text-4xl font-bold mb-8 text-red-600">Chính Sách Bản Quyền (DMCA)</h1>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-8">
                <p className="font-bold text-yellow-800 mb-2">Tuyên bố miễn trừ trách nhiệm quan trọng:</p>
                <p className="text-yellow-900">
                    Website **Tóm Tắt Truyện** hoạt động dựa trên mô hình **Review & Tóm tắt tác phẩm**.
                    Chúng tôi **KHÔNG** lưu trữ hay đăng tải nguyên văn nội dung (full text) của các tác phẩm được bảo hộ bản quyền.
                </p>
            </div>

            <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">1. Bản chất nội dung</h2>
                <p className="mb-4">
                    Nội dung trên website là các bài viết phân tích, đánh giá và tóm tắt cốt truyện.
                    Các bài viết này được sáng tạo độc lập, sử dụng văn phong riêng biệt và chỉ trích dẫn một phần nhỏ nội dung gốc
                    để phục vụ mục đích bình luận, phê bình (Fair Use).
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Nội dung không thay thế cho trải nghiệm đọc tác phẩm gốc.</li>
                    <li>Chúng tôi luôn khuyến khích độc giả tìm đọc tác phẩm gốc tại các nguồn chính thống để ủng hộ tác giả.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">2. Báo cáo vi phạm (DMCA Takedown)</h2>
                <p className="mb-4">
                    Mặc dù chúng tôi nỗ lực tuân thủ nghiêm ngặt luật bản quyền, sai sót là điều có thể xảy ra.
                    Nếu bạn là chủ sở hữu bản quyền (Tác giả/NXB) và cho rằng nội dung của chúng tôi vi phạm quyền sở hữu trí tuệ của bạn,
                    vui lòng gửi thông báo cho chúng tôi.
                </p>
                <p className="mb-4">Thông báo cần bao gồm:</p>
                <ul className="list-disc pl-6 space-y-2 mb-6 bg-slate-50 p-4 rounded border">
                    <li>Tên tác phẩm và đường dẫn (URL) đến nội dung bị cáo buộc vi phạm trên website của chúng tôi.</li>
                    <li>Bằng chứng chứng minh bạn là chủ sở hữu bản quyền hợp pháp.</li>
                    <li>Thông tin liên hệ của bạn (Email, Số điện thoại).</li>
                </ul>
                <p>
                    Vui lòng gửi yêu cầu về email: <span className="font-bold text-indigo-600">copyright@tomtattruyen.com</span> (Email giả định).
                    Chúng tôi sẽ xem xét và gỡ bỏ nội dung vi phạm trong vòng 24-48 giờ làm việc sau khi xác minh.
                </p>
            </section>
        </div>
    );
}
