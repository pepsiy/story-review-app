import { db } from "@repo/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TestDbPage() {
    let dbStatus = "Checking...";
    let envStatus = "Checking...";
    let errorMsg = "";

    try {
        // Check Env Vars
        const hasDbUrl = !!process.env.DATABASE_URL || !!process.env.NEON_DATABASE_URL;
        const hasAuthSecret = !!process.env.NEXTAUTH_SECRET;

        envStatus = `DB_URL: ${hasDbUrl ? "✅ Found" : "❌ Missing"} | AUTH_SECRET: ${hasAuthSecret ? "✅ Found" : "❌ Missing"}`;

        // Test DB Connection
        await db.execute(sql`SELECT 1`);
        dbStatus = "✅ Connected Successfully to Neon DB!";
    } catch (error: any) {
        dbStatus = "❌ Connection Failed";
        errorMsg = error.message + "\n" + JSON.stringify(error, null, 2);
        console.error("DB Test Error:", error);
    }

    return (
        <div className="p-8 font-mono space-y-4 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold border-b pb-2">🔍 System Diagnostic</h1>

            <div className="p-4 bg-gray-100 rounded border">
                <h2 className="font-bold">1. Environment Variables</h2>
                <p>{envStatus}</p>
            </div>

            <div className={`p-4 rounded border text-white ${errorMsg ? "bg-red-600" : "bg-green-600"}`}>
                <h2 className="font-bold">2. Database Status</h2>
                <p className="font-bold text-lg">{dbStatus}</p>

                {errorMsg && (
                    <pre className="mt-4 p-4 bg-black/50 overflow-auto text-xs">
                        {errorMsg}
                    </pre>
                )}
            </div>

            <div className="text-xs text-gray-500 mt-8">
                Timestamp: {new Date().toISOString()}
            </div>
        </div>
    );
}
