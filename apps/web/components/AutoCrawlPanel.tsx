"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Play, Pause, PlayCircle, Square } from "lucide-react";

type CrawlJob = {
    id: number;
    workId: number | null;
    sourceUrl: string;
    status: string;
    totalChapters: number;
    crawledChapters: number;
    summarizedChapters: number;
    failedChapters: number;
    autoMode: boolean;
    batchSize: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    lastProcessedAt: string | null;
    lastError: string | null;
};

type FailedChapter = {
    id: number;
    chapterNumber: number;
    title: string | null;
    error: string | null;
    retryCount: number;
};

export function AutoCrawlPanel({ workId, workTitle }: { workId: string; workTitle: string }) {
    const [sourceUrl, setSourceUrl] = useState("");
    const [job, setJob] = useState<CrawlJob | null>(null);
    const [failedChapters, setFailedChapters] = useState<FailedChapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        checkExistingJob();
        const interval = setInterval(() => {
            if (job) refreshJobStatus();
        }, 5000); // Refresh every 5s

        return () => clearInterval(interval);
    }, [workId, job?.id]);

    const checkExistingJob = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/crawl/active`);
            if (res.ok) {
                const jobs = await res.json();
                const existing = jobs.find((j: CrawlJob) => j.workId === parseInt(workId));
                if (existing) {
                    setJob(existing);
                    await refreshJobStatus(existing.id);
                }
            }
        } catch (error) {
            console.error("Error checking job:", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshJobStatus = async (jobId?: number) => {
        if (!jobId && !job) return;
        const id = jobId || job?.id;

        try {
            const res = await fetch(`${API_URL}/admin/crawl/${id}/status`);
            if (res.ok) {
                const data = await res.json();
                setJob(data.job);
                setFailedChapters(data.failedChapters || []);
            }
        } catch (error) {
            console.error("Error refreshing status:", error);
        }
    };

    const initCrawl = async () => {
        if (!sourceUrl.trim()) {
            toast.error("Vui lòng nhập Source URL!");
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/admin/crawl/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workId: parseInt(workId), sourceUrl })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`✅ Bắt đầu crawl! Job ID: ${data.jobId}`);
                setTimeout(() => refreshJobStatus(data.jobId), 2000);
            } else {
                toast.error(`❌ Lỗi: ${data.error}`);
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi kết nối: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const processBatch = async (count: number) => {
        if (!job) return;

        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/admin/crawl/${job.id}/process-batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ count })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`🤖 Đang xử lý ${count} chapters...`);
                setTimeout(() => refreshJobStatus(), 1000);
            } else {
                toast.error(`❌ Lỗi: ${data.error}`);
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const toggleAutoMode = async () => {
        if (!job) return;

        try {
            const res = await fetch(`${API_URL}/admin/crawl/${job.id}/toggle-auto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ autoMode: !job.autoMode })
            });

            if (res.ok) {
                toast.success(`${!job.autoMode ? "✅ Bật" : "⏸️ Tắt"} Auto Mode`);
                refreshJobStatus();
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi: ${error.message}`);
        }
    };

    const pauseJob = async () => {
        if (!job) return;

        try {
            const res = await fetch(`${API_URL}/admin/crawl/${job.id}/pause`, { method: "POST" });
            if (res.ok) {
                toast.success("⏸️ Job paused");
                refreshJobStatus();
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi: ${error.message}`);
        }
    };

    const resumeJob = async () => {
        if (!job) return;

        try {
            const res = await fetch(`${API_URL}/admin/crawl/${job.id}/resume`, { method: "POST" });
            if (res.ok) {
                toast.success("▶️ Job resumed");
                refreshJobStatus();
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi: ${error.message}`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Đang kiểm tra crawl jobs...</div>;
    }

    if (!job) {
        return (
            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">🤖 Auto-Crawl & AI Summarization</h3>
                    <p className="text-sm text-blue-700">
                        Tự động crawl nội dung từ website nguồn và dùng AI tóm tắt từng chương.
                        Hệ thống sẽ xử lý 5 chapters/lần với rate limiting an toàn.
                    </p>
                </div>

                <div>
                    <Label htmlFor="sourceUrl">Source URL</Label>
                    <p className="text-sm text-gray-500 mb-2">
                        Ví dụ: https://truyenfull.vision/tien-nghich
                    </p>
                    <Input
                        id="sourceUrl"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://truyenfull.vision/..."
                        className="font-mono text-sm"
                    />
                </div>

                <Button
                    onClick={initCrawl}
                    disabled={processing}
                    className="w-full"
                >
                    {processing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang khởi tạo...
                        </>
                    ) : (
                        <>🚀 Initialize Crawl Job</>
                    )}
                </Button>
            </div>
        );
    }

    const progress = job.totalChapters > 0
        ? (job.summarizedChapters / job.totalChapters) * 100
        : 0;

    const statusColors: Record<string, string> = {
        initializing: "bg-yellow-100 text-yellow-800",
        crawling: "bg-blue-100 text-blue-800",
        ready: "bg-green-100 text-green-800",
        processing: "bg-indigo-100 text-indigo-800 animate-pulse",
        paused: "bg-gray-100 text-gray-800",
        completed: "bg-emerald-100 text-emerald-800",
        failed: "bg-red-100 text-red-800"
    };

    return (
        <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Crawl Job #{job.id}</h3>
                    <p className="text-sm text-gray-500">{job.sourceUrl}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[job.status] || 'bg-gray-100'}`}>
                    {job.status.toUpperCase()}
                </span>
            </div>

            {/* Progress Bar */}
            <div>
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Progress</span>
                    <span className="text-gray-600">
                        {job.summarizedChapters}/{job.totalChapters} ({progress.toFixed(1)}%)
                    </span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                    <div className="text-2xl font-bold text-blue-700">{job.totalChapters}</div>
                    <div className="text-xs text-blue-600">Total</div>
                </div>
                <div className="bg-indigo-50 p-3 rounded">
                    <div className="text-2xl font-bold text-indigo-700">{job.crawledChapters}</div>
                    <div className="text-xs text-indigo-600">Crawled</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                    <div className="text-2xl font-bold text-green-700">{job.summarizedChapters}</div>
                    <div className="text-xs text-green-600">Summarized</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                    <div className="text-2xl font-bold text-red-700">{job.failedChapters}</div>
                    <div className="text-xs text-red-600">Failed</div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 flex-wrap items-center bg-gray-50 p-3 rounded-lg border">
                <div className="flex gap-2 mr-auto">
                    <Button
                        onClick={() => processBatch(job.batchSize || 5)}
                        disabled={processing || job.status === 'processing' || job.status === 'completed'}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        Chạy Ngay ({job.batchSize || 5} Chương)
                    </Button>

                    {job.status === 'processing' ? (
                        <Button onClick={pauseJob} variant="destructive" size="sm">
                            <Pause className="mr-2 h-4 w-4" /> Dừng
                        </Button>
                    ) : job.status === 'paused' ? (
                        <Button onClick={resumeJob} variant="outline" size="sm">
                            <Play className="mr-2 h-4 w-4" /> Tiếp Tục
                        </Button>
                    ) : null}
                </div>

                <div className="flex items-center gap-2 border-l pl-4">
                    <span className="text-sm font-medium text-gray-700">Tự Động Chạy:</span>
                    <Button
                        onClick={toggleAutoMode}
                        variant={job.autoMode ? "default" : "outline"}
                        size="sm"
                        className={job.autoMode ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {job.autoMode ? "ON (Bật)" : "OFF (Tắt)"}
                    </Button>
                </div>
            </div>

            {/* Auto mode notice */}
            {job.autoMode && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Hệ thống đang tự động chạy nền (Mỗi 2 phút xử lý {job.batchSize || 5} chương). Bạn có thể làm việc khác.
                </div>
            )}

            {/* Failed Chapters Log */}
            {failedChapters.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                        ⚠️ Log Lỗi ({failedChapters.length} chương)
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {failedChapters.map(ch => (
                            <div key={ch.id} className="bg-white p-3 rounded border border-red-100 shadow-sm flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-red-900">
                                        Chương {ch.chapterNumber}: {ch.title || "No Title"}
                                    </div>
                                    <div className="text-xs text-red-600 mt-1">{ch.error}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-200 hover:bg-red-50 text-red-700"
                                    onClick={() => window.open(`/admin/works/${workId}/chapters/create?chapter=${ch.chapterNumber}`, '_blank')}
                                >
                                    Sửa Thủ Công
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Last Error */}
            {job.lastError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    <strong>Last Error:</strong> {job.lastError}
                </div>
            )}
        </div>
    );
}
