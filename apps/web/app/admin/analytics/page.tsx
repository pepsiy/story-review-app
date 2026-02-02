"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Eye, TrendingUp, ExternalLink, Settings } from "lucide-react";

type TopWork = {
    title: string;
    views: number;
    slug: string;
};

export default function AnalyticsPage() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalViews: 0,
        totalWorks: 0,
        totalUsers: 0
    });
    const [topWorks, setTopWorks] = useState<TopWork[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        // Fetch basic stats
        fetch(`${API_URL}/admin/stats`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error("Error fetching stats:", err));

        // Fetch top works
        fetch(`${API_URL}/admin/top-works`)
            .then(res => res.json())
            .then(data => setTopWorks(data))
            .catch(err => console.error("Error fetching top works:", err))
            .finally(() => setLoading(false));
    }, []);

    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">📊 Thống Kê & Phân Tích</h1>
                <div className="flex gap-2">
                    {!gaId && (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/admin/settings")}
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Cấu hình GA
                        </Button>
                    )}
                    {gaId && (
                        <Button
                            variant="outline"
                            onClick={() => window.open(`https://analytics.google.com/`, '_blank')}
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Mở Google Analytics
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Eye className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Lượt Xem</p>
                            <p className="text-2xl font-bold">{stats.totalViews.toLocaleString('vi-VN')}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Tổng Truyện</p>
                            <p className="text-2xl font-bold">{stats.totalWorks}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Người Dùng</p>
                            <p className="text-2xl font-bold">{stats.totalUsers}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Top Views Section */}
            <Card className="p-6">
                <h3 className="font-semibold mb-4 text-gray-700 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Truyện xem nhiều nhất
                </h3>
                {loading ? (
                    <div className="h-48 flex items-center justify-center text-gray-400">
                        Đang tải...
                    </div>
                ) : topWorks.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                        Chưa có dữ liệu
                    </div>
                ) : (
                    <div className="space-y-2">
                        {topWorks.map((work, index) => (
                            <div key={work.slug} className="flex items-center justify-between p-3 bg-slate-50 rounded hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-slate-400 w-6">#{index + 1}</span>
                                    <button
                                        onClick={() => router.push(`/truyen/${work.slug}`)}
                                        className="text-sm font-medium text-slate-700 hover:text-blue-600 text-left"
                                    >
                                        {work.title}
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                    <Eye className="w-4 h-4" />
                                    <span className="font-mono">{work.views.toLocaleString('vi-VN')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Google Analytics Status */}
            {!gaId ? (
                <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200">
                    <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Google Analytics chưa được cấu hình</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Kích hoạt Google Analytics để theo dõi chi tiết lượng truy cập từ người dùng thực.
                    </p>
                    <Button onClick={() => router.push("/admin/settings")} className="bg-blue-600 hover:bg-blue-700">
                        <Settings className="w-4 h-4 mr-2" />
                        Hướng dẫn cài đặt
                    </Button>
                </Card>
            ) : (
                <Card className="p-6 bg-green-50 border-green-200">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-green-900 mb-1">Google Analytics đang hoạt động</h3>
                            <p className="text-sm text-green-700 mb-2">
                                Measurement ID: <code className="bg-white px-2 py-1 rounded text-xs font-mono">{gaId}</code>
                            </p>
                            <p className="text-xs text-green-600">
                                Dữ liệu chi tiết có sẵn trên Google Analytics dashboard.
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
