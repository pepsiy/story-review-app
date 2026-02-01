"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface Genre {
    id: number;
    name: string;
    slug: string;
    description?: string;
}

export default function AdminGenresPage() {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const fetchGenres = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/genres`);
            if (res.ok) {
                const data = await res.json();
                setGenres(data);
            }
        } catch (error) {
            console.error("Failed to fetch genres", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGenres();
    }, []);

    // Auto-generate slug
    useEffect(() => {
        const generatedSlug = name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, "-");
        setSlug(generatedSlug);
    }, [name]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/admin/genres`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, slug, description }),
            });

            if (res.ok) {
                setName("");
                setDescription("");
                fetchGenres(); // Refresh list
            } else {
                const err = await res.json();
                alert("Lỗi: " + (err.error || "Không thể tạo thể loại"));
            }
        } catch (e) {
            alert("Lỗi kết nối");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bạn có chắc muốn xóa thể loại này?")) return;
        try {
            const res = await fetch(`${API_URL}/admin/genres/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchGenres();
            } else {
                alert("Lỗi khi xóa");
            }
        } catch (e) {
            alert("Lỗi kết nối");
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Quản Lý Thể Loại</h1>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Form Creation */}
                <div className="md:col-span-1 bg-white p-6 rounded-lg shadow h-fit">
                    <h2 className="text-lg font-semibold mb-4 text-indigo-700">Thêm Mới</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <Label>Tên thể loại</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="VD: Tiên Hiệp"
                                required
                            />
                        </div>
                        <div>
                            <Label>Slug (URL)</Label>
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="tien-hiep"
                                required
                            />
                        </div>
                        <div>
                            <Label>Mô tả (Optional)</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Mô tả ngắn..."
                            />
                        </div>
                        <Button type="submit" disabled={submitting} className="w-full">
                            {submitting ? "Đang lưu..." : "+ Tạo Thể Loại"}
                        </Button>
                    </form>
                </div>

                {/* List */}
                <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tên</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead className="text-right">Hành động</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">Đang tải...</TableCell>
                                </TableRow>
                            ) : genres.length > 0 ? (
                                genres.map((genre) => (
                                    <TableRow key={genre.id}>
                                        <TableCell className="font-medium">{genre.name}</TableCell>
                                        <TableCell className="text-gray-500">{genre.slug}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(genre.id)}
                                            >
                                                🗑️ Xóa
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-gray-400">
                                        Chưa có thể loại nào.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
