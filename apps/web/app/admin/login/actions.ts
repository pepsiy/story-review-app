"use server";

import { cookies } from "next/headers";

export async function verifyAdminLogin(user: string, pass: string) {
    const validUsername = process.env.ADMIN_USERNAME || "admin";
    const validPassword = process.env.ADMIN_PASSWORD || "admin";

    if (user === validUsername && pass === validPassword) {
        // Set the session cookie securely on the server
        cookies().set("admin_session", "true", {
            path: "/",
            maxAge: 86400,
            sameSite: "strict"
        });
        return { success: true };
    }

    return { success: false, error: "Tài khoản hoặc mật khẩu không chính xác!" };
}
