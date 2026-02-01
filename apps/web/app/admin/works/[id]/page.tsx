"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface WorkDetail {
    id: number;
    title: string;
    chapters: {
        id: number;
        chapterNumber: number;
        title: string;
        status: string;
    }[];
}

export default function AdminWorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [work, setWork] = useState<WorkDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        fetch(`${API_URL}/admin/works/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => setWork(data))
            .catch(err => {
                console.error(err);
                // Handle error UI if needed
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div>Loading...</div>;
    if (!work) return <div>Work not found</div>;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{work.title}</h1>
                    <p className="text-gray-500">Quản lý danh sách chương</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/admin/works/${id}/edit`}>
                        <Button variant="outline">✏️ Sửa Truyện</Button>
                    </Link>
                    <Button
                        variant="destructive"
                        onClick={async () => {
                            if (confirm(`Bạn có chắc chắn muốn XÓA truyện "${work.title}" và toàn bộ chương không? Hành động này không thể hoàn tác!`)) {
                                try {
                                    const res = await fetch(`${API_URL}/admin/works/${id}`, { method: "DELETE" });
                                    if (res.ok) {
                                        alert("Đã xóa thành công!");
                                        window.location.href = "/admin"; // Force reload
                                    } else {
                                        const err = await res.json();
                                        alert("Lỗi: " + (err.error || "Unknown"));
                                    }
                                } catch (e) {
                                    alert("Lỗi kết nối server");
                                }
                            }
                        }}
                    >
                        🗑️ Xóa Truyện
                    </Button>
                    <Link href={`/admin/works/${id}/chapters/create`}>
                        <Button>+ Thêm Chương</Button>
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Số chương</TableHead>
                            <TableHead>Tiêu đề</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {work.chapters && work.chapters.length > 0 ? (
                            work.chapters.map((chapter) => (
                                <TableRow key={chapter.id}>
                                    <TableCell>#{chapter.chapterNumber}</TableCell>
                                    <TableCell>{chapter.title}</TableCell>
                                    <TableCell>{chapter.status}</TableCell>
                                    <TableCell className="text-right flex gap-2 justify-end">
                                        <Link href={`/admin/works/${id}/chapters/${chapter.id}/edit`}>
                                            <Button variant="outline" size="sm">✏️ Sửa</Button>
                                        </Link>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={async () => {
                                                if (confirm(`Xóa chương #${chapter.chapterNumber}?\nHành động này không thể hoàn tác!`)) {
                                                    try {
                                                        const res = await fetch(`${API_URL}/admin/chapters/${chapter.id}`, {
                                                            method: "DELETE",
                                                        });
                                                        if (res.ok) {
                                                            window.location.reload();
                                                        } else {
                                                            alert("Lỗi khi xóa chương!");
                                                        }
                                                    } catch (e) {
                                                        alert("Lỗi kết nối!");
                                                    }
                                                }
                                            }}
                                        >
                                            🗑️ Xóa
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                                    Chưa có chương nào. Hãy thêm chương mới.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div >
    );
}
