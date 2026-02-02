"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Eye, TrendingUp, ExternalLink } from "lucide-react";

export default function AnalyticsPage() {
    const [stats, setStats] = useState({
        totalViews: 0,
        totalWorks: 0,
        totalUsers: 0
    });

    useEffect(() => {
        // Fetch basic stats from API
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/admin/stats`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error("Error fetching stats:", err));
    }, []);

    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">📊 Thống Kê & Phân Tích</h1>
                {gaId && (
                    <Button
                        variant="outline"
                        onClick={() => window.open(`https://analytics.google.com/analytics/web/#/p${gaId.replace('G-', '')}/`, '_blank')}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Mở Google Analytics
                    </Button>
                )}
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
                            <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
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

            {/* Google Analytics Embed */}
            {!gaId && (
                <Card className="p-8 text-center">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Google Analytics chưa được cấu hình</h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Thêm <code className="bg-slate-100 px-2 py-1 rounded">NEXT_PUBLIC_GA_MEASUREMENT_ID</code> vào biến môi trường để kích hoạt tracking.
                    </p>
                    <Button variant="outline" onClick={() => window.location.href = "/admin/settings"}>
                        Cài đặt
                    </Button>
                </Card>
            )}

            {gaId && (
                <Card className="p-4">
                    <h3 className="font-semibold mb-4">📈 Google Analytics Dashboard</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        ID: <code className="bg-slate-100 px-2 py-1 rounded text-xs">{gaId}</code>
                    </p>
                    <p className="text-xs text-slate-500 italic">
                        Để xem chi tiết traffic, hãy truy cập trực tiếp Google Analytics dashboard.
                    </p>
                </Card>
            )}
        </div>
    );
}
