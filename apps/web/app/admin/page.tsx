import { db } from "@repo/db";
import { works, genres, users } from "@repo/db";
import { count, sum, sql } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    // 1. Total Works
    const [worksCount] = await db.select({ count: count() }).from(works);

    // 2. Total Genres
    const [genresCount] = await db.select({ count: count() }).from(genres);

    // 3. Total Views (Sum of views column in works)
    const [viewsResult] = await db.select({ total: sum(works.views) }).from(works);

    // 4. Total Users
    const [usersCount] = await db.select({ count: count() }).from(users);

    const stats = [
        {
            title: "Tổng số Truyện",
            value: worksCount?.count || 0,
            icon: "📚",
            color: "bg-blue-500"
        },
        {
            title: "Thể loại",
            value: genresCount?.count || 0,
            icon: "🏷️",
            color: "bg-indigo-500"
        },
        {
            title: "Tổng Lượt xem",
            value: Number(viewsResult?.total || 0).toLocaleString('vi-VN'),
            icon: "👁️",
            color: "bg-green-500"
        },
        {
            title: "Thành viên",
            value: usersCount?.count || 0,
            icon: "👥",
            color: "bg-orange-500"
        }
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">📊 Thống kê Tổng quan</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-lg shadow p-6 flex items-center space-x-4">
                        <div className={`p-4 rounded-full ${stat.color} text-white text-2xl`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-gray-500 text-sm">{stat.title}</p>
                            <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold mb-4 text-gray-700">Truyện xem nhiều nhất (Top Views)</h3>
                    {/* Placeholder for Top Views Chart/List */}
                    <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                        Chưa có dữ liệu chi tiết
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold mb-4 text-gray-700">Hoạt động gần đây</h3>
                    <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                        Chưa có dữ liệu chi tiết
                    </div>
                </div>
            </div>
        </div>
    );
}
