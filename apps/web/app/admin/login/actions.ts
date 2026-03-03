"use server";

import { cookies } from "next/headers";

export async function verifyAdminLogin(user: string, pass: string) {
    // Attempt to load from process.env, with fallbacks. 
    // On Render, these must be set in the Web Service Environment Variables.
    const validUsername = process.env.ADMIN_USERNAME || "admin";
    const validPassword = process.env.ADMIN_PASSWORD || "admin";

    // Debugging logic silently logs to server console
    console.log(`[Admin Login] Attempt with user: ${user}. Expected user length: ${validUsername.length}`);

    if (user === validUsername && pass === validPassword) {
        // Set the session cookie securely on the server
        const cookieStore = await cookies();
        cookieStore.set("admin_session", "true", {
            path: "/",
            maxAge: 86400,
            sameSite: "lax", // Lax is safer for navigation across boundaries from external links
            secure: process.env.NODE_ENV === 'production',
        });
        return { success: true };
    }

    // Special hint mechanism: if they use the local env credentials but Render doesn't have them
    if (user === 'Nzu' && validUsername === 'admin') {
        return { success: false, error: "Tài khoản không chính xác! (Lưu ý: Môi trường Render chưa nhận biến môi trường ADMIN_USERNAME. Vui lòng thử 'admin'/'admin' hoặc thêm biến môi trường trên Render)" };
    }

    return { success: false, error: "Tài khoản hoặc mật khẩu không chính xác!" };
}
