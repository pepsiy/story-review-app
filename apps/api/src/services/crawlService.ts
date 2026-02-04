import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ChapterInfo {
    number: number;
    title: string;
    url: string;
}

export class CrawlService {
    private readonly baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    /**
     * Parse thông tin truyện từ URL
     */
    async extractWorkInfo(url: string): Promise<{
        title: string;
        author: string;
        genre: string;
        description: string;
        coverImage: string;
        status: string;
    }> {
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
            const description = $('.desc-text').html()?.trim() || ''; // Use html to preserve <br>

            const status = $('.info .text-success').text().trim() === 'Full' ? 'COMPLETED' : 'ONGOING';

            return {
                title,
                author,
                genre,
                description,
                coverImage,
                status
            };
        } catch (error: any) {
            console.error('❌ Error extracting work info:', error.message);
            throw new Error(`Failed to extract work info: ${error.message}`);
        }
    }

    /**
     * Crawl danh sách tất cả chapters từ trang truyện
     * @param sourceUrl URL truyện (e.g. https://truyenfull.vision/tien-nghich)
     * @returns Array của chapter info
     */
    async crawlChapterList(sourceUrl: string): Promise<ChapterInfo[]> {
        const chapters: ChapterInfo[] = [];

        try {
            // Fetch trang đầu tiên để detect total pages
            const firstPage = await axios.get(sourceUrl, { headers: this.baseHeaders, timeout: 30000 });
            const $ = cheerio.load(firstPage.data);

            // Extract total pages từ pagination
            const totalPages = this.extractTotalPages($);
            console.log(`📊 Detected ${totalPages} pages of chapters`);

            // Crawl page 1
            const page1Chapters = this.extractChaptersFromPage($);
            chapters.push(...page1Chapters);

            // Crawl remaining pages
            for (let page = 2; page <= totalPages; page++) {
                console.log(`📖 Crawling page ${page}/${totalPages}...`);
                const pageUrl = sourceUrl.endsWith('/')
                    ? `${sourceUrl}trang-${page}/`
                    : `${sourceUrl}/trang-${page}/`;

                const response = await axios.get(pageUrl, { headers: this.baseHeaders, timeout: 30000 });
                const $page = cheerio.load(response.data);
                const pageChapters = this.extractChaptersFromPage($page);
                chapters.push(...pageChapters);

                // Delay to avoid rate limiting
                await this.delay(1000);
            }

            console.log(`✅ Crawled ${chapters.length} chapters total`);
            return chapters;
        } catch (error: any) {
            console.error('❌ Error crawling chapter list:', error.message);
            throw new Error(`Failed to crawl chapter list: ${error.message}`);
        }
    }

    /**
     * Crawl nội dung của 1 chapter
     */
    async crawlChapterContent(chapterUrl: string): Promise<string> {
        try {
            const response = await axios.get(chapterUrl, {
                headers: this.baseHeaders,
                timeout: 30000
            });
            const $ = cheerio.load(response.data);

            // Truyenfull.vision: content trong #chapter-c
            let content = $('#chapter-c').text().replace(/\s+/g, ' ').trim();

            if (!content) {
                // Fallback: thử selector khác
                content = $('.chapter-content').text().trim();
            }

            if (!content) {
                throw new Error('No content found in chapter');
            }

            return content;
        } catch (error: any) {
            console.error(`❌ Error crawling ${chapterUrl}:`, error.message);
            throw new Error(`Failed to crawl chapter content: ${error.message}`);
        }
    }

    /**
     * Extract chapters từ một trang HTML
     */
    private extractChaptersFromPage($: cheerio.CheerioAPI): ChapterInfo[] {
        const chapters: ChapterInfo[] = [];

        // Selector cho truyenfull.vision: .list-chapter li a
        $('#list-chapter .list-chapter li a').each((index, element) => {
            const $link = $(element);
            const url = $link.attr('href');
            const fullText = $link.text().trim();

            if (!url) return;

            // Extract chapter number từ text "Chương 1: Ly hương"
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

    /**
     * Extract total pages từ pagination
     */
    private extractTotalPages($: cheerio.CheerioAPI): number {
        // Truyenfull.vision: <input id="total-page" type="hidden" value="40">
        const totalPageInput = $('#total-page').val();
        if (totalPageInput) {
            return parseInt(totalPageInput as string, 10);
        }

        // Fallback: tìm pagination links
        let maxPage = 1;
        $('.pagination li a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/trang-(\d+)/);
            if (match) {
                maxPage = Math.max(maxPage, parseInt(match[1], 10));
            }
        });

        return maxPage;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const crawlService = new CrawlService();
