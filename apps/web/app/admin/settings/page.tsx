"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type SettingsData = Record<string, string>;

type GeminiKeyStat = {
    key: string;
    today: string;
    status: string;
};

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<'gemini' | 'telegram' | 'crawl'>('gemini');
    const [settings, setSettings] = useState<SettingsData>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [geminiStats, setGeminiStats] = useState<GeminiKeyStat[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        fetchSettings();
        fetchGeminiStats();
    }, []);

    const fetchGeminiStats = async () => {
        setLoadingStats(true);
        try {
            const res = await fetch(`${API_URL}/admin/gemini/stats`);
            if (res.ok) {
                const data = await res.json();
                setGeminiStats(data.stats || []);
            }
        } catch (e) {
            console.error("Could not load Gemini quota stats", e);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/settings`);
            if (res.ok) {
                const data = await res.json();
                const settingsMap: SettingsData = {};
                data.forEach((s: any) => {
                    settingsMap[s.key] = s.value || '';
                });
                setSettings(settingsMap);
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch(`${API_URL}/admin/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                toast.success("Đã lưu cấu hình thành công! ✅");
            } else {
                const data = await res.json();
                toast.error(`Lỗi: ${data.error || "Không thể lưu cấu hình"}`);
            }
        } catch (error: any) {
            toast.error(`Lỗi kết nối: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const testTelegramConnection = async () => {
        const token = settings.telegram_bot_token;
        const chatId = settings.telegram_chat_id;

        if (!token || !chatId) {
            toast.error("Vui lòng nhập Bot Token và Chat ID trước!");
            return;
        }

        setTesting(true);
        try {
            const res = await fetch(`${API_URL}/admin/telegram/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, chatId }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success("✅ Telegram bot kết nối thành công! Kiểm tra chat của bạn.");
            } else {
                toast.error(`❌ Kết nối thất bại: ${data.message}`);
            }
        } catch (error: any) {
            toast.error(`❌ Lỗi test: ${error.message}`);
        } finally {
            setTesting(false);
        }
    };

    const updateSetting = (key: string, value: string | boolean) => {
        setSettings(prev => ({ ...prev, [key]: value.toString() }));
    };

    if (loading) return <div className="p-8">Đang tải cấu hình...</div>;

    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-6 text-indigo-700 border-b pb-2">⚙️ Cấu Hình Hệ Thống</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('gemini')}
                    className={`px-4 py-2 font-medium transition ${activeTab === 'gemini'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🤖 Gemini AI
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    className={`px-4 py-2 font-medium transition ${activeTab === 'telegram'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📱 Telegram Alerts
                </button>
                <button
                    onClick={() => setActiveTab('crawl')}
                    className={`px-4 py-2 font-medium transition ${activeTab === 'crawl'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🕷️ Auto-Crawl
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Gemini AI Tab */}
                {activeTab === 'gemini' && (
                    <>
                        <div>
                            <Label htmlFor="geminiKey" className="text-base">🔑 Gemini API Keys (Free hoặc Paid)</Label>
                            <p className="text-sm text-gray-500 mb-2">
                                Nhập nhiều key cách nhau bởi dấu phẩy. Mỗi key có giới hạn <strong>40 requests/ngày</strong>, reset lúc 15:00 mỗi ngày.
                            </p>
                            <Input
                                id="geminiKey"
                                value={settings.GEMINI_API_KEY || ''}
                                onChange={(e) => updateSetting('GEMINI_API_KEY', e.target.value)}
                                placeholder="AIzaSy..."
                                className="font-mono text-sm"
                            />
                        </div>

                        <div>
                            <Label htmlFor="geminiPaidKey" className="text-base">🔑 Gemini Extra Keys (Thêm vào pool chung)</Label>
                            <p className="text-sm text-gray-500 mb-2">
                                Keys bổ sung, cùng được gộp vào pool với giới hạn <strong>40 requests/ngày mỗi key</strong>.
                            </p>
                            <Input
                                id="geminiPaidKey"
                                value={settings.GEMINI_PAID_KEYS || ''}
                                onChange={(e) => updateSetting('GEMINI_PAID_KEYS', e.target.value)}
                                placeholder="AIzaSy... (Extra Key)"
                                className="font-mono text-sm border-amber-200 bg-amber-50"
                            />
                        </div>

                        {/* Quota Tracker */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-base text-indigo-700">📊 Quota Tracker (Lượt dùng hôm nay)</Label>
                                <button
                                    type="button"
                                    onClick={fetchGeminiStats}
                                    disabled={loadingStats}
                                    className="text-xs px-3 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                                >
                                    {loadingStats ? "Đang tải..." : "🔄 Refresh"}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Reset tự động lúc <strong>15:00</strong> mỗi ngày. Giới hạn: <strong>40 requests/key/ngày</strong>.</p>
                            {geminiStats.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">{loadingStats ? "Đang tải dữ liệu..." : "Không có key nào hoặc server chưa xử lý request AI nào."}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-600">
                                                <th className="text-left px-3 py-2 border">🔑 Key</th>
                                                <th className="text-left px-3 py-2 border">📈 Hôm nay</th>
                                                <th className="text-left px-3 py-2 border">🔋 Còn lại</th>
                                                <th className="text-left px-3 py-2 border">⚡ Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {geminiStats.map((stat, idx) => {
                                                const [used, total] = stat.today.split('/').map(Number);
                                                const remaining = total - used;
                                                const pct = Math.round((used / total) * 100);
                                                const isReady = stat.status === 'READY';
                                                const isDead = stat.status.includes('DEAD');
                                                return (
                                                    <tr key={idx} className={isDead ? 'bg-red-50' : isReady ? 'bg-green-50' : 'bg-yellow-50'}>
                                                        <td className="px-3 py-2 border font-mono text-xs">{stat.key}</td>
                                                        <td className="px-3 py-2 border">
                                                            <div className="flex items-center gap-2">
                                                                <span>{stat.today}</span>
                                                                <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-16">
                                                                    <div
                                                                        className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className={`px-3 py-2 border font-semibold ${remaining <= 5 ? 'text-red-600' : remaining <= 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                            {remaining} lượt
                                                        </td>
                                                        <td className="px-3 py-2 border">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${isDead ? 'bg-red-100 text-red-700' :
                                                                    isReady ? 'bg-green-100 text-green-700' :
                                                                        'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {stat.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Telegram Tab */}
                {activeTab === 'telegram' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
                            <p className="font-semibold text-blue-800 mb-2">📖 Hướng dẫn setup Telegram Bot:</p>
                            <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                                <li>Mở Telegram, tìm <code className="bg-blue-100 px-1 rounded">@BotFather</code></li>
                                <li>Gửi lệnh <code className="bg-blue-100 px-1 rounded">/newbot</code> và làm theo hướng dẫn</li>
                                <li>Copy <strong>Bot Token</strong> (dạng: 123456:ABC-DEF...)</li>
                                <li>Mở bot của bạn, gửi <code className="bg-blue-100 px-1 rounded">/start</code></li>
                                <li>Truy cập: <code className="bg-blue-100 px-1 rounded text-xs">https://api.telegram.org/bot{'<TOKEN>'}/getUpdates</code></li>
                                <li>Tìm <strong>chat.id</strong> trong JSON response</li>
                            </ol>
                        </div>

                        <div>
                            <Label htmlFor="telegramToken">Bot Token</Label>
                            <Input
                                id="telegramToken"
                                type="password"
                                value={settings.telegram_bot_token || ''}
                                onChange={(e) => updateSetting('telegram_bot_token', e.target.value)}
                                placeholder="123456:ABC-DEF..."
                                className="font-mono text-sm"
                            />
                        </div>

                        <div>
                            <Label htmlFor="telegramChatId">Chat ID</Label>
                            <Input
                                id="telegramChatId"
                                value={settings.telegram_chat_id || ''}
                                onChange={(e) => updateSetting('telegram_chat_id', e.target.value)}
                                placeholder="-1001234567890"
                                className="font-mono text-sm"
                            />
                        </div>

                        <Button
                            type="button"
                            onClick={testTelegramConnection}
                            disabled={testing}
                            variant="outline"
                            className="w-full"
                        >
                            {testing ? "Đang test..." : "🧪 Test Connection"}
                        </Button>

                        <div className="border-t pt-4 space-y-3">
                            <h3 className="font-semibold">Alert Settings</h3>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="alertsEnabled"
                                    checked={settings.telegram_alerts_enabled === 'true'}
                                    onCheckedChange={(checked) => updateSetting('telegram_alerts_enabled', checked)}
                                />
                                <label htmlFor="alertsEnabled" className="text-sm font-medium">
                                    Enable Telegram Alerts
                                </label>
                            </div>

                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="alertError"
                                        checked={settings.telegram_alert_on_error === 'true'}
                                        onCheckedChange={(checked) => updateSetting('telegram_alert_on_error', checked)}
                                    />
                                    <label htmlFor="alertError" className="text-sm">
                                        ❌ Alert on Error
                                    </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="alertComplete"
                                        checked={settings.telegram_alert_on_complete === 'true'}
                                        onCheckedChange={(checked) => updateSetting('telegram_alert_on_complete', checked)}
                                    />
                                    <label htmlFor="alertComplete" className="text-sm">
                                        ✅ Alert on Job Complete
                                    </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="alertProgress"
                                        checked={settings.telegram_alert_on_progress === 'true'}
                                        onCheckedChange={(checked) => updateSetting('telegram_alert_on_progress', checked)}
                                    />
                                    <label htmlFor="alertProgress" className="text-sm">
                                        📊 Progress Updates (every 50 chapters)
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Crawl Settings Tab */}
                {activeTab === 'crawl' && (
                    <div className="space-y-4">
                        <div>
                            <Label>Rate Limit (Requests Per Minute)</Label>
                            <p className="text-sm text-gray-500 mb-2">
                                Giới hạn số request/phút cho Gemini API (Free tier: 15 RPM recommended)
                            </p>
                            <Input
                                type="number"
                                value={settings.crawl_rate_limit_rpm || '10'}
                                onChange={(e) => updateSetting('crawl_rate_limit_rpm', e.target.value)}
                                min="1"
                                max="60"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="globalAuto"
                                checked={settings.crawl_auto_mode_enabled === 'true'}
                                onCheckedChange={(checked) => updateSetting('crawl_auto_mode_enabled', checked)}
                            />
                            <label htmlFor="globalAuto" className="text-sm font-medium">
                                Enable Global Auto Mode (Cron will auto-process jobs)
                            </label>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                            ⚠️ Auto mode sẽ tự động xử lý các crawl jobs có bật auto mode mỗi 2 phút.
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t">
                    <Button type="submit" disabled={saving} className="w-full md:w-auto">
                        {saving ? "Đang lưu..." : "💾 Lưu Cấu Hình"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
