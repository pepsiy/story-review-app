# 📋 Kế Hoạch Triển Khai: Neon Rotation & Sheets Backup (HA Strategy)

## 1. Mục tiêu (Objective)
Cấu trúc một hệ thống High Availability (HA) cơ bản với 0đ chi phí database Serverless:
- Sử dụng **2 database Neon (Neon 1 & Neon 2)** chạy luân phiên (Active-Standby).
- Sử dụng **Google Sheets** làm kho chứa (Backup / Event Log) để luân chuyển dữ liệu.
- Giữ tốc độ Load/Tải trang web chính ở mức tối đa như bình thường, mọi tác vụ đồng bộ đều chạy rảnh rỗi ở Background (Cronjob/Worker).

---

## 2. Kiến trúc Data Flow (Mô hình hoạt động)

### 2.1 Các thành phần (Components)
1. **Primary Database (Active):** Ví dụ Neon 1. Nơi Web App đọc/ghi trực tiếp realtime cực nhanh.
2. **Backup Storage (Log):** Google Sheets. Nơi chứa mọi Insert/Update mới nhất từ Primary.
3. **Standby Database (Idle):** Ví dụ Neon 2. Chờ để lên thay thế Primary.
4. **Worker / Cronjob Server:** Một service nhỏ (có thể host trên Render) chạy định kỳ để điều phối dữ liệu.
5. **Config Manager:** Nơi lưu trữ Connection String (`DATABASE_URL`) đang trỏ vào Neon nào.

### 2.2 Quy trình Đồng bộ (Sync Process)
- **Bước 1 (Delta Sync):** Cứ mỗi 15-30 phút, `Worker` tìm trên Primary DB các record có `updated_at > last_sync_time`. Nối (Append) các dòng này vào Google Sheets.
  - *Kết quả:* Sheet luôn được bơm data mới gọn gàng, không bị phình to đột ngột.
- **Bước 2 (Pre-warm / Chạy đà):** Cứ mỗi 1 tiếng, `Worker` kiểm tra API của Neon xem "Số giờ CU của Neon 1 đã đạt 90h chưa?". (Hoặc Neon 1 chỉ còn 10h).
  - *Nếu đạt:* Khởi động việc đọc Data dư từ Sheets và `UPSERT` vào Neon 2. Neon 2 lúc này đang "làm nóng" (Pre-warm) để sẵn sàng thay thế.
- **Bước 3 (Failover / Chuyển giao):** Khi Neon 1 cạn kiệt dứt điểm 100h CU (hoặc báo lỗi 503).
  - `Worker` thực hiện lệnh Sync khẩn cấp 1 lần cuối (vét những giây phút cuối).
  - Cập nhật biến môi trường `DATABASE_URL` (ví dụ trên Vercel/Render) sang Neon 2.
  - Neon 2 chính thức thành Primary. Vòng lặp đảo ngược: Neon 2 -> Sheet -> Neon 3 (hoặc Neon 1 của tháng sau).

---

## 3. Thiết kế Cấu trúc Database (Chuẩn bị)

Mọi Bảng dữ liệu (Tables) BẮT BUỘC phải tuân thủ nghiêm ngặt 2 cột sau:
- `id`: Khóa chính (Primary Key).
- `updated_at`: Timestamp (Cập nhật tự động mỗi khi có thay đổi).

> ⚠️ **Quy tắc Vàng:** KHÔNG ĐƯỢC Hard Delete (Xóa cứng). Phải dùng Soft Delete (thêm cột `deleted_at`, hoặc `is_deleted = true`). Nếu xóa cứng, dòng đó sẽ biến mất khỏi DB và Worker không thể cập nhật hành động xóa đó sang Sheet.

---

## 4. Đánh giá Hiệu năng (Performance Impact)
- **Tốc độ Web App chính:** 🚀 **100% Tối ưu**. Trang web vẫn gọi trực tiếp vào Postgres (Neon) như bình thường. Không đợi Google Sheets thao tác xong mới phản hồi.
- **Downtime ở Phase Chuyển giao:** Rất thấp (khoảng vài chục giây đến 1 phút) nếu bạn làm bước "Pre-warm" tốt. Mọi data đã qua Neon 2 từ trước, lúc đó cờ chỉ việc gạt sang.

---

## 5. Các Phase Triển Khai (Dự kiến thực thi bởi các Agents)

1. **Phase 1: Database Setup & Service (`database-architect`, `backend-specialist`)**
   - Thiết kế lược đồ (Schema) đảm bảo có `updated_at`, `deleted_at` ở mọi bảng.
   - Setup credentials Google Sheets Service Account.
2. **Phase 2: Worker Development (`backend-specialist`)**
   - Viết API / Script tính Delta lấy data (Neon -> Sheets).
   - Viết API / Script đọc Sheets và gen lệnh `UPSERT ON CONFLICT (id) DO UPDATE` (Sheets -> Neon).
3. **Phase 3: Connection & Failover Switch (`devops-engineer`)**
   - Viết logic bắt Request lỗi từ Neon, tự động gọi API đổi `DATABASE_URL` bên Vercel/Render.
   - Thêm cờ khóa (Lock) API trong lúc đang thực thi quá trình vét data Sync cuối cùng để tránh rác data.

---

> Kế hoạch này tối ưu hóa bài toán giới hạn Free-Tier qua hệ thống "câu giờ tuần hoàn", đạt mức miễn phí vĩnh viễn với hiệu năng nguyên bản.
