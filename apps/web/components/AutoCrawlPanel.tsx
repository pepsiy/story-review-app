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
    const [countdown, setCountdown] = useState(0);
    const [mergeRatio, setMergeRatio] = useState(5); // Default 5 chapters -> 1 summary
    const [configBatchSize, setConfigBatchSize] = useState(5);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        checkExistingJob();
        const interval = setInterval(() => {
            if (job) refreshJobStatus();
        }, 5000); // Refresh every 5s

        return () => clearInterval(interval);
    }, [workId, job?.id]);

    // Sync local state when job loads
    useEffect(() => {
        if (job) {
            // Priority: chaptersPerSummary -> batchSize -> 5
            setConfigBatchSize(job.chaptersPerSummary || job.batchSize || 5);
        }
    }, [job?.id, job?.chaptersPerSummary, job?.batchSize]);

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

    // Save Configuration
    const saveConfig = async () => {
        if (!job) return;
        try {
            const res = await fetch(`${API_URL}/admin/crawl/${job.id}/update-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    batchSize: configBatchSize,
                    chaptersPerSummary: configBatchSize // Sync both
                })
            });
            if (res.ok) {
                toast.success("Cập nhật cấu hình thành công!");
                refreshJobStatus(job.id);
            } else {
                toast.error("Lỗi cập nhật cấu hình");
            }
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Lỗi kết nối");
        }
    };

    // Auto-Run Logic
    useEffect(() => {
        if (!job || !job.autoMode) {
            setCountdown(0);
            return;
        }

        // If job is ready and not processing, trigger next batch
        if (job.status === 'ready' && !processing) {
            setCountdown(20); // Start 20s countdown
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        // IMPORTANT: Process 1 "Unit" of summary (which consumes N source chapters)
                        processBatch(1);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [job?.status, job?.autoMode, processing]);

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
            // Defaulting chaptersPerSummary to 1 for now (Single Mode)
            // TODO: Allow user to select Merge Mode (e.g., 5 chars -> 1 summary)
            const res = await fetch(`${API_URL}/admin/crawl/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workId: parseInt(workId),
                    sourceUrl,
                    // Use the configured value for init
                    chaptersPerSummary: configBatchSize,
                    batchSize: configBatchSize
                })
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

    // Add scanGaps function
    const scanGaps = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/admin/crawl/scan-gaps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workId: parseInt(workId) })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.gaps && data.gaps.length > 0) {
                    toast.success(`✅ Tìm thấy ${data.gaps.length} chương thiếu. Đã lên lịch crawl lại!`);
                    setFailedChapters([]); // Clear bad status visual if needed
                    setTimeout(() => refreshJobStatus(), 1000);
                } else {
                    toast.info(data.message || "Không tìm thấy chương thiếu nào.");
                }
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

                {/* Configuration Section (Editable) */}
                <div className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <Settings className="h-4 w-4" /> Cấu hình Batch
                        </h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={saveConfig}
                            disabled={loading || processing}
                        >
                            Lưu cấu hình
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="configBatchSize">Số chương gộp (Batch Size)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    id="configBatchSize"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={configBatchSize}
                                    onChange={(e) => setConfigBatchSize(parseInt(e.target.value) || 5)}
                                    className="w-24"
                                />
                                <span className="text-sm text-gray-500">chương / 1 lần tóm tắt</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Hệ thống sẽ gom {configBatchSize} chương gốc thành 1 bản tóm tắt.
                            </p>
                        </div>
                    </div>
                </div>
                {processing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang khởi tạo...
                    </>
                ) : (
                    <>🚀 Initialize Crawl Job</>
                )}
            </Button>
            </div >
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
                    <div className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-200 rounded-md p-1">
                        <Button
                            onClick={() => processBatch(1)}
                            disabled={processing || job.status === 'processing' || job.status === 'completed'}
                            size="sm"
                            className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-xs"
                            title="Debug: Chạy 1 batch (5 chương)"
                        >
                            {processing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PlayCircle className="mr-1 h-3 w-3" />}
                            1 Batch
                        </Button>
                        <Button
                            onClick={() => processBatch(5)}
                            disabled={processing || job.status === 'processing' || job.status === 'completed'}
                            size="sm"
                            className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-xs"
                            title="Chạy 5 batches (25 chương)"
                        >
                            5
                        </Button>
                        <Button
                            onClick={() => processBatch(10)}
                            disabled={processing || job.status === 'processing' || job.status === 'completed'}
                            size="sm"
                            className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-xs"
                            title="Chạy 10 batches (50 chương)"
                        >
                            10
                        </Button>

                        <Button
                            onClick={scanGaps}
                            disabled={processing}
                            size="sm"
                            variant="secondary"
                            className="h-7 px-3 text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                            title="Quét và tự động điền các chương bị thiếu"
                        >
                            🔍 Scan & Fix Gaps
                        </Button>
                    </div>

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
                    {countdown > 0 ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Đang đợi {countdown}s để tóm tắt tiếp theo (Tránh quá tải API)...
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4 mr-2" />
                            Đang xử lý batch...
                        </>
                    )}
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
