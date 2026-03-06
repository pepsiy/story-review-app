# 📋 Kế Hoạch Triển Khai: SEO Update Web 2026 (BaoSocial Standard) cho Story Review App

## 1. Mục tiêu (Objective)
Cập nhật hệ thống Story Review App theo chuẩn SEO Web 2026 dựa trên tài liệu BaoSocial nhằm tối ưu hóa hiển thị trên các công cụ tìm kiếm, tăng EEAT và thu hút luồng organic traffic tốt nhất.

---

## 2. Các Hạng Mục Triển Khai Phương Án Đề Xuất (Option A - Toàn Diện)

### 2.1. AI SEO Generation (Tự động hóa Meta & Content)
- **Title & Meta Description:** Tích hợp logic AI (Gemini) để sinh tự động `seoTitle` (<65 ký tự) và `seoDescription` (140-155 ký tự).
- **Slug Tối Ưu:** Sinh URL thân thiện từ 3-5 từ cốt lõi.
- **Rewritten Content & FAQ Schema:** Tự động tạo phần hỏi đáp dạng `<details>` và `<summary>` cuối bài, trích xuất cấu trúc dữ liệu Hỏi-Đáp. Tích hợp link Outbound nofollow.

### 2.2. Technical SEO & On-Page (Next.js)
- **Dynamic Metadata:** Áp dụng `generateMetadata` tại các trang `/truyen/[slug]/page.tsx`, `/admin/...` thiết lập Canonical URL, Open Graph (OG Tags) cho Facebook/Zalo (1200x630), Twitter Cards.
- **Structured Data (JSON-LD):** Phát triển utility `generateJsonLd` (Article/NewsArticle) và `generateBreadcrumbJsonLd` nhúng cấu trúc Schema vào DOM.
- **Google News Sitemap:** Viết API `app/news-sitemap.xml/route.ts` bắt rule <= 48h, revalidate định kỳ 30 phút.
- **Semantic HTML:** Đảm bảo Component Hierarchy dùng đúng chuẩn `<h1>`, `<article>`, `<aside>`, `<nav>`.

### 2.3. SEO E-E-A-T
- Hiển thị thông tin tác giả, reviewer, ngày xuất bản ở định dạng mạch lạc trên trang chi tiết truyện.
- Hệ thống Internal Linking mạnh (gợi ý "Truyện liên quan", "Cùng tác giả").

---

## 3. Các Phase Triển Khai (Orchestration Phase 2)
Sau khi Plan này được user phê duyệt (Approval: Y), sẽ khởi động song song (Parallel) các Agents:

1. **`backend-specialist` (Core):**
   - Viết API CMS sinh AI SEO Metadata, FAQ.
   - Viết tính năng sitemap/news-sitemap (`news-sitemap.xml/route.ts`).
2. **`frontend-specialist` (Core):**
   - Cập nhật file `page.tsx` và thêm các module `generateMetadata`, JSON-LD script, Semantic HTML.
3. **`seo-specialist` (Polish):**
   - Review lại toàn bộ code HTML xem chuẩn E-E-A-T và Alt images, Heading outline.
   - Đảm bảo điểm số Core Web Vitals tối ưu.
4. **`test-engineer` (Polish):**
   - Viết script kiểm thử sitemap. Kiểm tra JSON-LD render có hợp lệ không.
