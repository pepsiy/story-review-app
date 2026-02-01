"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/settings`);
            if (res.ok) {
                const data = await res.json();
                // Find GEMINI_API_KEY in the list of settings
                const geminiKey = data.find((s: any) => s.key === "GEMINI_API_KEY");
                if (geminiKey) setApiKey(geminiKey.value);
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
                body: JSON.stringify({
                    "GEMINI_API_KEY": apiKey
                }),
            });

            if (res.ok) {
                alert("Đã lưu cấu hình thành công! ✅");
            } else {
                alert("Lỗi khi lưu cấu hình!");
            }
        } catch (error) {
            alert("Lỗi kết nối server!");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Đang tải cấu hình...</div>;

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-6 text-indigo-700 border-b pb-2">⚙️ Cấu Hình Hệ Thống</h1>

            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <Label htmlFor="geminiKey" className="text-base">Gemini API Key (Google AI)</Label>
                    <p className="text-sm text-gray-500 mb-2">
                        Nhập nhiều key cách nhau bởi dấu phẩy (key1, key2) để tự động xoay vòng khi hết quota.
                    </p>
                    <Input
                        id="geminiKey"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="font-mono text-sm"
                    />
                </div>

                <div className="pt-4">
                    <Button type="submit" disabled={saving} className="w-full md:w-auto">
                        {saving ? "Đang lưu..." : "💾 Lưu Cấu Hình"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
