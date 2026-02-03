# 🎮 Game Hệ Thống Tu Tiên - Tài Liệu Kỹ Thuật

## 1. Tổng Quan
Hệ thống Game tích hợp (Mini-game) cho phép người dùng vừa đọc truyện vừa tham gia Tu Tiên:
- **Trồng trọt (Farming):** Gieo hạt, chờ đợi, thu hoạch linh dược.
- **Luyện đan (Alchemy):** Chế tạo đan dược từ nguyên liệu.
- **Tu luyện (Cultivation):** Sử dụng vật phẩm để tăng EXP và đột phá cảnh giới.
- **Tương tác xã hội (Social):** Thăm vườn bạn bè, tưới nước hoặc hái trộm.

---

## 2. Cơ Chế Chi Tiết

### A. Trồng Trọt (Farming)
Từ `farm_plots` và `inventory`.
*   **Ô đất:** Mỗi user mặc định có 9 ô (Indices 0-8). Mặc định mở khóa 3 ô đầu.
*   **Gieo hạt (`plantSeed`):** Cần có hạt giống (`seed_`) trong kho.
*   **Sinh trưởng:** Cây lớn dựa trên thời gian thực (`growTime`). Không cần server tick, tính toán khi thu hoạch.
*   **Thu hoạch (`harvestPlant`):**
    *   Kiểm tra thời gian đã trôi qua > `growTime`.
    *   Sản lượng (`yield`): Random từ `minYield` đến `maxYield` (Config).
    *   Logic chuyển đổi: ID hạt giống `seed_X` -> Sản phẩm `herb_X`.
    *   Sau thu hoạch: Ô đất trở về trạng thái trống.

### B. Tu Luyện & Cảnh Giới
Từ `users` table (`cultivation_level`, `cultivation_exp`).
*   **Tăng EXP:** Thông qua việc sử dụng vật phẩm (`useItem`) loại `CONSUMABLE` hoặc `PRODUCT` có chỉ số `exp`.
*   **Đột phá:** Tự động lên cấp khi EXP đạt ngưỡng.

**Danh sách Cảnh Giới (Hiện tại):**
| Cảnh Giới | EXP Yêu Cầu |
| :--- | :--- |
| Phàm Nhân | 0 |
| Luyện Khí | 100 |
| Trúc Cơ | 1,000 |
| Kim Đan | 5,000 |
| Nguyên Anh | 20,000 |
| Hóa Thần | 100,000 |

### C. Luyện Đan (Alchemy/Crafting)
*   **Cơ chế:** Đổi nguyên liệu + Vàng lấy vật phẩm mới.
*   **Công thức (`RECIPES`):** Được định nghĩa trong Code/DB.
*   **Ví dụ hiện tại:**
    *   **Trúc Cơ Đan**: Cần 10 *Linh Thảo* + 2 *Nhân Sâm* + 100 Vàng.

### D. Tương Tác Xã Hội (Social)
Từ `friendships` table. Cơ chế cooldown 24h/người/hành động.
1.  **Tưới Nước (Water):**
    *   Tác dụng: Tăng Hảo Cảm (+5).
    *   (Chưa implement: Giảm thời gian sinh trưởng).
2.  **Hái Trộm (Steal):**
    *   Điều kiện: Cây đã chín (đủ thời gian thu hoạch).
    *   Hậu quả:
        *   Người trộm: Nhận 50% sản lượng.
        *   Nạn nhân: Mất trắng ô đất (Plot bị clear).
        *   Hảo cảm: Giảm mạnh (-10).

---

## 3. Cấu Trúc Dữ Liệu & Config

### Vật Phẩm (Game Items)
Định nghĩa trong `apps/api/src/data/gameData.ts` (hoặc DB `game_items`).

| ID | Tên | Loại | Giá Mua | Giá Bán | Grow Time | EXP | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `seed_linh_thao` | Hạt Linh Thảo | SEED | 10 | - | 60s | - | Test item |
| `seed_nhan_sam` | Hạt Nhân Sâm | SEED | 50 | - | 300s | - | |
| `herb_linh_thao` | Linh Thảo | PRODUCT | - | 5 | - | 5 | Dùng được |
| `herb_nhan_sam` | Nhân Sâm | PRODUCT | - | 20 | - | 30 | Dùng được |
| `pill_truc_co` | Trúc Cơ Đan | CONSUMABLE | 1000 | 200 | - | 500 | |

---

## 4. Danh sách API (Backend Controllers)

**File:** `apps/api/src/controllers/gameController.ts`
*   `POST /game/state`: Lấy thông tin user, đất, kho đồ.
*   `POST /game/plant`: Gieo hạt (`{ userId, plotId, seedId }`).
*   `POST /game/harvest`: Thu hoạch (`{ userId, plotId }`).
*   `POST /game/buy`: Mua shop (`{ userId, itemId, quantity }`).
*   `POST /game/sell`: Bán shop (`{ userId, itemId, quantity }`).
*   `POST /game/combine`: Luyện đan/Chế tạo (`{ userId, itemId }`).
*   `POST /game/use`: Sử dụng vật phẩm/Tu luyện (`{ userId, itemId }`).

**File:** `apps/api/src/controllers/socialController.ts`
*   `POST /game/social/visit`: Xem nhà người khác (`{ userId, targetUserId }`).
*   `POST /game/social/water`: Tưới nước (`{ userId, targetUserId, plotId }`).
*   `POST /game/social/steal`: Hái trộm (`{ userId, targetUserId, plotId }`).

---

## 5. Hướng Phát Triển Tiếp Theo (Suggestions)
Nếu bạn muốn mở rộng, có thể cân nhắc:
1.  **Hiệu ứng Tưới Nước:** Cập nhật DB để giảm `plantedAt` (giả lập trồng sớm hơn) khi được tưới.
2.  **Hệ thống nhiệm vụ (Missions):** Đã có bảng `missions` trong DB nhưng chưa có API Controller logic đầy đủ (Check progress tự động).
3.  **Bảng Xếp Hạng:** API lấy Top Users theo `cultivationExp` hoặc `gold`.
4.  **Log Hoạt Động:** Lưu lịch sử ai đã trộm/tưới nước nhà mình để thông báo (Notification).
S