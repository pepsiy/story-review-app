import { GoogleGenerativeAI } from "@google/generative-ai";

// Load keys from env
const getApiKeys = () => {
    const keys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
    return keys.split(",").map(k => k.trim()).filter(k => k.length > 0);
};

let currentKeyIndex = 0;

const getNextClient = (): GoogleGenerativeAI => {
    const keys = getApiKeys();
    if (keys.length === 0) {
        throw new Error("No GEMINI_API_KEYS found in environment variables.");
    }

    // Simple round-robin or just pick current
    const key = keys[currentKeyIndex];
    console.log(`🔑 Using Gemini Key [${currentKeyIndex + 1}/${keys.length}]: ${key.slice(0, 4)}...`);

    return new GoogleGenerativeAI(key);
};

const rotateKey = () => {
    const keys = getApiKeys();
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`🔄 Rotating to next API Key... (Index: ${currentKeyIndex})`);
};

export const generateText = async (prompt: string): Promise<string> => {
    const maxRetries = getApiKeys().length; // Try each key once
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const genAI = getNextClient();
            // User requested "Gemini 2.5 Flash"
            const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error(`❌ AI Generation Error (Attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Check for quota/rate limit errors (429 usually)
            // Gemini SDK errors might be wrapped, checking typical Google API error status
            if (error.message?.includes("429") || error.status === 429 || error.message?.includes("quota")) {
                console.warn("⚠️ Quota exceeded for current key. Switching key...");
                rotateKey();
                attempt++;
            } else {
                // If it's another error (like 400 Bad Request), throwing might be better than rotating
                // But for robustness, we can try one more time or just throw
                throw error;
            }
        }
    }

    throw new Error("All API keys exhausted or failed.");
};
