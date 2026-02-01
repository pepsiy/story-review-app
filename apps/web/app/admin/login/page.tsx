"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Simple client-side check for demo (ideally server action)
        // User requested: Nzu / Fdmedia123@#$
        if (username === "Nzu" && password === "Fdmedia123@#$") {
            // Set cookie
            document.cookie = "admin_session=true; path=/; max-age=86400; SameSite=Strict";
            router.push("/admin");
        } else {
            setError("Sai tài khoản hoặc mật khẩu!");
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center mb-6 text-indigo-700">Admin Login</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <Label htmlFor="username">Tài khoản</Label>
                        <Input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nhập tài khoản quản trị"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <Button type="submit" className="w-full">Đăng Nhập</Button>
                </form>
            </div>
        </div>
    );
}
