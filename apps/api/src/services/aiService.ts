import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, systemSettings } from "../../../../packages/db/src";
import { eq } from "drizzle-orm";

// Load keys from DB or Env
const getApiKeys = async (): Promise<string[]> => {
    try {
        // Try DB first
        const dbKey = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, "GEMINI_API_KEY")
        });

        if (dbKey && dbKey.value) {
            console.log("🔑 Using GEMINI_API_KEY from Database");
            return dbKey.value.split(",").map(k => k.trim()).filter(k => k.length > 0);
        }
    } catch (e) {
        console.warn("⚠️ Failed to fetch key from DB, falling back to Env:", e);
    }

    // Fallback to Env
    const keys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
    return keys.split(",").map(k => k.trim()).filter(k => k.length > 0);
};

let currentKeyIndex = 0;

export const generateText = async (prompt: string): Promise<string> => {
    const keys = await getApiKeys();

    if (keys.length === 0) {
        throw new Error("No GEMINI_API_KEYS found in Database or Environment variables.");
    }

    const maxRetries = keys.length;
    let attempt = 0;

    // Reset index if out of bounds (keys changed)
    if (currentKeyIndex >= keys.length) currentKeyIndex = 0;

    while (attempt < maxRetries) {
        try {
            const key = keys[currentKeyIndex];
            console.log(`🔑 Using Gemini Key [${currentKeyIndex + 1}/${keys.length}]: ${key.slice(0, 4)}...`);

            const genAI = new GoogleGenerativeAI(key);

            // User requested "Gemini 2.5 Flash"
            const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error(`❌ AI Generation Error (Attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Check for quota/rate limit errors (429 usually)
            if (error.message?.includes("429") || error.status === 429 || error.message?.includes("quota")) {
                console.warn("⚠️ Quota exceeded for current key. Switching key...");
                currentKeyIndex = (currentKeyIndex + 1) % keys.length; // Rotate
                attempt++;
            } else {
                throw error;
            }
        }
    }

    throw new Error("All API keys exhausted or failed.");
};
