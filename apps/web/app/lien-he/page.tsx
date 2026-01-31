import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function LienHePage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-2xl text-slate-800 font-sans">
            <h1 className="text-4xl font-bold mb-8 text-center text-indigo-700">Liên Hệ Với Chúng Tôi</h1>
            <p className="text-center text-slate-500 mb-12">
                Bạn có câu hỏi, góp ý hoặc muốn hợp tác? Hãy để lại lời nhắn cho đội ngũ phát triển.
            </p>

            <div className="bg-white p-8 rounded-xl shadow border border-slate-100">
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="font-medium text-sm">Họ và tên</label>
                            <Input placeholder="Nguyễn Văn A" />
                        </div>
                        <div className="space-y-2">
                            <label className="font-medium text-sm">Email</label>
                            <Input type="email" placeholder="email@example.com" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-medium text-sm">Chủ đề</label>
                        <Input placeholder="Hợp tác / Báo lỗi / Góp ý..." />
                    </div>

                    <div className="space-y-2">
                        <label className="font-medium text-sm">Nội dung</label>
                        <Textarea rows={5} placeholder="Chi tiết nội dung bạn muốn gửi..." />
                    </div>

                    <Button className="w-full h-12 text-base">Gửi Tin Nhắn 🚀</Button>
                </form>
            </div>

            <div className="mt-12 text-center text-sm text-slate-500">
                <p>Email trực tiếp: <span className="font-medium text-slate-900">contact@tomtattruyen.com</span></p>
                <p className="mt-1">Địa chỉ: Hà Nội, Việt Nam</p>
            </div>
        </div>
    );
}
