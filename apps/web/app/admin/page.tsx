import { db } from "@repo/db";
import { works } from "@repo/db";
import { desc } from "drizzle-orm";
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

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default async function AdminDashboard() {
    const allWorks = await db.select().from(works).orderBy(desc(works.updatedAt));

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Danh Sách Truyện</h1>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Tên Truyện</TableHead>
                            <TableHead>Tác Giả</TableHead>
                            <TableHead>Trạng Thái</TableHead>
                            <TableHead>Cập Nhật</TableHead>
                            <TableHead className="text-right">Hành Động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allWorks.map((work) => (
                            <TableRow key={work.id}>
                                <TableCell className="font-mono text-xs">{work.id}</TableCell>
                                <TableCell className="font-medium">{work.title}</TableCell>
                                <TableCell>{work.author || "N/A"}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${work.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {work.status}
                                    </span>
                                </TableCell>
                                <TableCell>{new Date(work.updatedAt!).toLocaleDateString('vi-VN')}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/admin/works/${work.id}`}>
                                        <Button variant="outline" size="sm">Quản lý</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
