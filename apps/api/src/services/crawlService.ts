import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ChapterInfo {
    number: number;
    title: string;
    url: string;
}

type CrawlSource = 'truyenfull' | 'xtruyen';

function detectSource(url: string): CrawlSource {
    if (url.includes('xtruyen.vn')) return 'xtruyen';
    return 'truyenfull'; // default
}

export class CrawlService {
    private readonly baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
    };

    private readonly xtruyenHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Referer': 'https://xtruyen.vn/',
        'Origin': 'https://xtruyen.vn',
    };

    /**
     * Fetch xtruyen.vn page.
     * Strategy: direct fetch → Cloudflare Worker proxy (edge bypass).
     * Env vars on Render: CF_WORKER_URL, CF_WORKER_SECRET
     */
    private async fetchXtruyen(url: string): Promise<string> {
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        };

        // 1. Try direct fetch (works from residential/VN IPs)
        try {
            const res = await (globalThis.fetch as typeof fetch)(url, {
                method: 'GET', headers: browserHeaders, redirect: 'follow',
            } as RequestInit);
            if (res.ok) {
                console.log(`✅ fetchXtruyen direct OK`);
                return res.text();
            }
            console.warn(`⚠️ fetchXtruyen direct got ${res.status}`);
        } catch (err: any) {
            console.warn(`⚠️ fetchXtruyen direct error: ${err.message}`);
        }

        // Helper: call a proxy that accepts { url, secret } POST → { html }
        const callProxy = async (proxyUrl: string, secret: string, name: string): Promise<string | null> => {
            try {
                console.log(`📡 fetchXtruyen via ${name}...`);
                const r = await (globalThis.fetch as typeof fetch)(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, secret }),
                } as RequestInit);
                if (r.ok) {
                    const { html } = await r.json() as { html: string };
                    if (html) { console.log(`✅ fetchXtruyen via ${name} OK (${html.length} bytes)`); return html; }
                }
                console.warn(`⚠️ ${name} returned ${r.status}`);
            } catch (err: any) {
                console.warn(`⚠️ ${name} error: ${err.message}`);
            }
            return null;
        };

        // 2. Cloudflare Worker (runs on CF edge network — bypasses datacenter IP block)
        const cfUrl = process.env.CF_WORKER_URL;
        const cfSecret = process.env.CF_WORKER_SECRET;
        if (cfUrl && cfSecret) {
            const html = await callProxy(cfUrl, cfSecret, 'CF Worker');
            if (html) return html;
        }

        throw new Error(`Cannot fetch ${url}: blocked by Cloudflare. Set CF_WORKER_URL + CF_WORKER_SECRET on Render.`);
    }

    /**
     * Parse thông tin truyện từ URL (auto-detect source)
     */
    async extractWorkInfo(url: string): Promise<{
        title: string;
        author: string;
        genre: string;
        description: string;
        coverImage: string;
        status: string;
    }> {
        const source = detectSource(url);
        console.log(`📡 extractWorkInfo: source=${source}, url=${url}`);

        if (source === 'xtruyen') {
            return this.extractWorkInfo_xtruyen(url);
        }
        return this.extractWorkInfo_truyenfull(url);
    }

    /**
     * Crawl danh sách tất cả chapters từ trang truyện (auto-detect source)
     */
    async crawlChapterList(sourceUrl: string): Promise<ChapterInfo[]> {
        const source = detectSource(sourceUrl);
        console.log(`📡 crawlChapterList: source=${source}`);

        if (source === 'xtruyen') {
            return this.crawlChapterList_xtruyen(sourceUrl);
        }
        return this.crawlChapterList_truyenfull(sourceUrl);
    }

    /**
     * Crawl nội dung của 1 chapter (auto-detect source)
     */
    async crawlChapterContent(chapterUrl: string): Promise<string> {
        const source = detectSource(chapterUrl);

        if (source === 'xtruyen') {
            return this.crawlChapterContent_xtruyen(chapterUrl);
        }
        return this.crawlChapterContent_truyenfull(chapterUrl);
    }

    // ============================================================
    //  TRUYENFULL.VISION implementation
    // ============================================================

    private async extractWorkInfo_truyenfull(url: string) {
        try {
            const response = await axios.get(url, { headers: this.baseHeaders, timeout: 30000 });
            const $ = cheerio.load(response.data);

            const title = $('h3.title[itemprop="name"]').text().trim() || $('h1').text().trim();
            const author = $('a[itemprop="author"]').text().trim();
            const genre = $('a[itemprop="genre"]')
                .map((i, el) => $(el).text().trim())
                .get()
                .join(', ');
            const coverImage = $('.book img').attr('src') || '';
            const description = $('.desc-text').html()?.trim() || '';
            const status = $('.info .text-success').text().trim() === 'Full' ? 'COMPLETED' : 'ONGOING';

            return { title, author, genre, description, coverImage, status };
        } catch (error: any) {
            console.error('❌ Error extracting work info (truyenfull):', error.message);
            throw new Error(`Failed to extract work info: ${error.message}`);
        }
    }

    private async crawlChapterList_truyenfull(sourceUrl: string): Promise<ChapterInfo[]> {
        const chapters: ChapterInfo[] = [];
        try {
            const firstPage = await axios.get(sourceUrl, { headers: this.baseHeaders, timeout: 30000 });
            const $ = cheerio.load(firstPage.data);

            const totalPages = this.extractTotalPages_truyenfull($);
            console.log(`📊 Truyenfull: ${totalPages} pages`);

            chapters.push(...this.extractChaptersFromPage_truyenfull($));

            for (let page = 2; page <= totalPages; page++) {
                console.log(`📖 Crawling page ${page}/${totalPages}...`);
                const pageUrl = sourceUrl.endsWith('/')
                    ? `${sourceUrl}trang-${page}/`
                    : `${sourceUrl}/trang-${page}/`;
                const response = await axios.get(pageUrl, { headers: this.baseHeaders, timeout: 30000 });
                const $page = cheerio.load(response.data);
                chapters.push(...this.extractChaptersFromPage_truyenfull($page));
                await this.delay(1000);
            }

            console.log(`✅ Truyenfull crawled ${chapters.length} chapters`);
            return chapters;
        } catch (error: any) {
            console.error('❌ Error crawling chapter list (truyenfull):', error.message);
            throw new Error(`Failed to crawl chapter list: ${error.message}`);
        }
    }

    private async crawlChapterContent_truyenfull(chapterUrl: string): Promise<string> {
        try {
            const response = await axios.get(chapterUrl, { headers: this.baseHeaders, timeout: 30000 });
            const $ = cheerio.load(response.data);

            let content = $('#chapter-c').text().replace(/\s+/g, ' ').trim();
            if (!content) content = $('.chapter-content').text().trim();
            if (!content) throw new Error('No content found in chapter');

            return this.cleanRawText(content);
        } catch (error: any) {
            console.error(`❌ Error crawling content (truyenfull) ${chapterUrl}:`, error.message);
            throw new Error(`Failed to crawl chapter content: ${error.message}`);
        }
    }

    private extractChaptersFromPage_truyenfull($: cheerio.CheerioAPI): ChapterInfo[] {
        const chapters: ChapterInfo[] = [];
        $('#list-chapter .list-chapter li a').each((index, element) => {
            const $link = $(element);
            const url = $link.attr('href');
            const fullText = $link.text().trim();
            if (!url) return;

            const match = fullText.match(/Chương\s+(\d+)/i);
            if (match) {
                const number = parseInt(match[1], 10);
                const title = fullText.replace(/Chương\s+\d+:\s*/i, '').trim();
                chapters.push({
                    number,
                    title,
                    url: url.startsWith('http') ? url : `https://truyenfull.vision${url}`
                });
            }
        });
        return chapters;
    }

    private extractTotalPages_truyenfull($: cheerio.CheerioAPI): number {
        const totalPageInput = $('#total-page').val();
        if (totalPageInput) return parseInt(totalPageInput as string, 10);

        let maxPage = 1;
        $('.pagination li a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/trang-(\d+)/);
            if (match) maxPage = Math.max(maxPage, parseInt(match[1], 10));
        });
        return maxPage;
    }

    // ============================================================
    //  XTRUYEN.VN implementation
    // ============================================================

    /**
     * Normalize xtruyen.vn chapter URL.
     * Fixes stored URLs missing /truyen/ prefix, e.g.:
     *   https://xtruyen.vn/con-duong-ba-chu/chuong-1
     * → https://xtruyen.vn/truyen/con-duong-ba-chu/chuong-1/
     */
    private normalizeXtruyenUrl(url: string): string {
        try {
            const u = new URL(url);
            if (u.hostname !== 'xtruyen.vn') return url;
            // Ensure /truyen/ prefix on pathname
            if (!u.pathname.startsWith('/truyen/')) {
                u.pathname = '/truyen' + u.pathname;
            }
            // Ensure trailing slash
            if (!u.pathname.endsWith('/')) u.pathname += '/';
            return u.toString();
        } catch {
            return url;
        }
    }

    private async extractWorkInfo_xtruyen(url: string) {
        try {
            const html = await this.fetchXtruyen(url);
            const $ = cheerio.load(html);

            // Title: <h1> tag
            const title = $('h1').first().text().trim();

            // Author: a[href*="/tacgia/"]
            const author = $('a[href*="/tacgia/"]').first().text().trim();

            // Genres: a[href*="/theloai/"]
            const genre = $('a[href*="/theloai/"]')
                .map((i, el) => $(el).text().trim())
                .get()
                .filter(g => g.length > 0)
                .join(', ');

            // Cover image: .summary_image img is the canonical cover on xtruyen.vn
            const coverImage =
                $('.summary_image img').first().attr('src') ||
                $('.book-detail img').first().attr('src') ||
                $('img[src*="img.xtruyen.vn"]').first().attr('src') ||
                $('img[src*="uploads"]').first().attr('src') ||
                '';

            // Description: .entry-content p or .description or paragraphs near h2.gioi-thieu
            let description = '';
            // Try common selectors
            description = $('.entry-content').first().text().trim();
            if (!description) description = $('.description').text().trim();
            if (!description) description = $('[class*="desc"]').first().text().trim();
            // Trim to reasonable size
            if (description.length > 2000) description = description.substring(0, 2000) + '...';

            // Status: detect from last chapter link text (e.g., "Đang ra" / "Hoàn thành")
            // Look for status indicator in page
            let status = 'ONGOING';
            const statusText = $('*:contains("Hoàn thành")').filter((i, el) => {
                return $(el).children().length === 0; // leaf node
            }).first().text().trim();
            if (statusText.includes('Hoàn thành')) status = 'COMPLETED';

            return { title, author, genre, description, coverImage, status };
        } catch (error: any) {
            console.error('❌ Error extracting work info (xtruyen):', error.message);
            throw new Error(`Failed to extract work info from xtruyen: ${error.message}`);
        }
    }

    private async crawlChapterList_xtruyen(sourceUrl: string): Promise<ChapterInfo[]> {
        const chapters: ChapterInfo[] = [];
        try {
            // xtruyen.vn loads all chapters on the story page (no pagination typically)
            // Or uses AJAX. We'll try scraping all chuong- links from the story page first.
            const html = await this.fetchXtruyen(sourceUrl);
            const $ = cheerio.load(html);

            // Chapter links pattern: href contains /chuong-N/
            const chapterLinks = new Map<number, ChapterInfo>();

            $('a[href*="/chuong-"]').each((i, el) => {
                const href = $(el).attr('href') || '';
                // Extract chapter number from URL: /chuong-123/
                const urlMatch = href.match(/\/chuong-(\d+)\/?$/);
                if (!urlMatch) return;

                const number = parseInt(urlMatch[1], 10);
                if (isNaN(number) || chapterLinks.has(number)) return;

                const linkText = $(el).text().trim();
                // Extract title from link text if it has "Chương N: Title" format
                const titleMatch = linkText.match(/Chương\s+\d+\s*[:\-–]\s*(.+)/i);
                const title = titleMatch ? titleMatch[1].trim() : (linkText || `Chương ${number}`);

                const rawUrl = href.startsWith('http') ? href : `https://xtruyen.vn${href}`;
                chapterLinks.set(number, { number, title, url: this.normalizeXtruyenUrl(rawUrl) });
            });

            chapters.push(...Array.from(chapterLinks.values()).sort((a, b) => a.number - b.number));

            // If no chapters found from listing, try paginated approach
            if (chapters.length === 0) {
                console.log('⚠️ No chapters found on main page, trying paginated approach...');
                const paginatedChapters = await this.crawlChapterList_xtruyen_paginated(sourceUrl, $);
                chapters.push(...paginatedChapters);
            }

            console.log(`✅ xtruyen crawled ${chapters.length} chapters`);
            return chapters;
        } catch (error: any) {
            console.error('❌ Error crawling chapter list (xtruyen):', error.message);
            throw new Error(`Failed to crawl chapter list from xtruyen: ${error.message}`);
        }
    }

    private async crawlChapterList_xtruyen_paginated(sourceUrl: string, $: cheerio.CheerioAPI): Promise<ChapterInfo[]> {
        const chapters: ChapterInfo[] = [];

        // Detect total pages from pagination
        let totalPages = 1;
        $('.pagination a, .wp-pagenavi a, a[href*="page/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/\/page\/(\d+)/);
            if (match) totalPages = Math.max(totalPages, parseInt(match[1], 10));
        });

        // Crawl each page
        for (let page = 1; page <= totalPages; page++) {
            const pageUrl = page === 1 ? sourceUrl : `${sourceUrl.replace(/\/$/, '')}/page/${page}/`;
            const response = await axios.get(pageUrl, { headers: this.baseHeaders, timeout: 30000 });
            const $p = cheerio.load(response.data);

            $p('a[href*="/chuong-"]').each((i, el) => {
                const href = $p(el).attr('href') || '';
                const urlMatch = href.match(/\/chuong-(\d+)\/?$/);
                if (!urlMatch) return;

                const number = parseInt(urlMatch[1], 10);
                if (isNaN(number)) return;

                const linkText = $p(el).text().trim();
                const titleMatch = linkText.match(/Chương\s+\d+\s*[:\-–]\s*(.+)/i);
                const title = titleMatch ? titleMatch[1].trim() : `Chương ${number}`;
                const rawUrl = href.startsWith('http') ? href : `https://xtruyen.vn${href}`;
                chapters.push({ number, title, url: this.normalizeXtruyenUrl(rawUrl) });
            });

            if (page < totalPages) await this.delay(800);
        }

        // Deduplicate and sort
        const unique = new Map<number, ChapterInfo>();
        chapters.forEach(ch => { if (!unique.has(ch.number)) unique.set(ch.number, ch); });
        return Array.from(unique.values()).sort((a, b) => a.number - b.number);
    }

    private async crawlChapterContent_xtruyen(chapterUrl: string): Promise<string> {
        try {
            const normalizedUrl = this.normalizeXtruyenUrl(chapterUrl);
            if (normalizedUrl !== chapterUrl) console.log(`🔧 Normalized URL: ${chapterUrl} → ${normalizedUrl}`);
            const html = await this.fetchXtruyen(normalizedUrl);
            const $ = cheerio.load(html);

            // Remove navigation, ads, and unwanted elements (including inline ads in content)
            $('.chapter-nav, .nav-buttons, .ads, .ad-container, .slider-container, ' +
                '[class*="shopee"], [id*="ads"], [id*="Slider"], script, style').remove();

            // Primary selector: #chapter-reading-content (div.text-left > div#chapter-reading-content)
            // Fallback selectors for future layout changes
            let content = '';
            const selectors = [
                '#chapter-reading-content',
                '.text-left #chapter-reading-content',
                '.reading-content-wrap .content-area',
                '.entry-content',
                '.chapter-content',
            ];

            for (const selector of selectors) {
                const el = $(selector);
                if (el.length > 0) {
                    content = el.text().trim();
                    if (content.length > 100) {
                        console.log(`📖 xtruyen content via "${selector}" (${content.length} chars)`);
                        break;
                    }
                }
            }


            if (!content || content.length < 50) {
                throw new Error('No content found in chapter page');
            }

            return this.cleanRawText(content);
        } catch (error: any) {
            console.error(`❌ Error crawling content (xtruyen) ${chapterUrl}:`, error.message);
            throw new Error(`Failed to crawl chapter content from xtruyen: ${error.message}`);
        }
    }

    // ============================================================
    //  SHARED utilities
    // ============================================================

    private cleanRawText(text: string): string {
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .replace(/ads-\w+/gi, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            // Remove common ad-like phrases in xtruyen
            .replace(/✨[^✨]*Shopee[^✨]*✨/g, '')
            .replace(/Săn Sale Shopee[^\n]*/g, '')
            .replace(/TRUYỆN HAY/g, '')
            .trim();
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const crawlService = new CrawlService();
