import { Request, Response } from "express";
import * as cheerio from "cheerio";

export const extractUrlContent = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        if (!url.includes("truyenfull.vision")) {
            return res.status(400).json({ error: "Only truyenfull.vision URLs are supported" });
        }

        // Fetch the HTML content
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();

        // Parse HTML using cheerio
        const $ = cheerio.load(html);

        // Extract content from #chapter-c div
        const chapterDiv = $("#chapter-c");

        if (!chapterDiv.length) {
            return res.status(404).json({ error: "Chapter content not found" });
        }

        // Remove ad divs
        chapterDiv.find(".ads-responsive, .ads-mobile, .visible-md, .visible-lg").remove();

        // Get text content with basic formatting preserved
        let content = "";
        chapterDiv.contents().each((_index: number, el: any) => {
            if (el.type === "tag" && el.name === "br") {
                content += "\n";
            } else if (el.type === "text") {
                const text = $(el).text().trim();
                if (text) {
                    content += text + " ";
                }
            } else if (el.type === "tag") {
                const text = $(el).text().trim();
                if (text && !text.includes("ads-")) {
                    content += text + "\n";
                }
            }
        });

        // Clean up the content
        content = content
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .replace(/\n\s*\n/g, "\n")
            .trim();

        res.json({ content });
    } catch (error: any) {
        console.error("Extract URL Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
};
