import { generateText } from "./aiService";
import { db, seoMeta } from "../../../../packages/db/src";
import { and, eq } from "drizzle-orm";

export const generateAndSaveSeoMeta = async (
    entityType: 'WORK' | 'CHAPTER',
    entityId: number,
    title: string,
    contentSummary: string,
    author?: string
) => {
    const prompt = `Bạn là chuyên gia SEO xuất sắc. Hãy tạo siêu dữ liệu SEO (Metadata) cho nội dung sau:
Tên: "${title}"
Tác giả: ${author || 'Không rõ'}
Mô tả/Tóm tắt: ${contentSummary.substring(0, 3000)}

YÊU CẦU ĐẦU RA:
Trả về duy nhất một object JSON hợp lệ có 2 trường sau:
1. "seoTitle": Tiêu đề bài viết chuẩn SEO (Long-tail keywords), hấp dẫn, BẮT BUỘC DƯỚI 65 KÝ TỰ.
2. "seoDescription": Mô tả Meta (Meta Description), tóm tắt lôi cuốn, có chứa Call-to-action (CTA) nhẹ nhàng, CHIỀU DÀI TỪ 140 ĐẾN 155 KÝ TỰ.

CHỈ TRẢ VỀ CHUỖI JSON, KHÔNG KÈM THEO BẤT KỲ VĂN BẢN HAY MARKDOWN NÀO KHÁC.`;

    try {
        console.log(`[SEO-GEN] Đang tạo Meta SEO cho ${entityType} ${entityId}...`);
        const result = await generateText(prompt);
        let parsed;
        try {
            parsed = JSON.parse(result.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
        } catch (e) {
            console.error("[SEO-GEN] Không thể parse JSON từ AI:", result);
            return;
        }

        const seoTitle = parsed.seoTitle?.substring(0, 65) || title.substring(0, 65);
        const seoDesc = parsed.seoDescription?.substring(0, 155) || contentSummary.substring(0, 155);

        // Check if exists because schema doesn't have unique constraint on entityType + entityId
        const existing = await db.query.seoMeta.findFirst({
            where: and(eq(seoMeta.entityType, entityType), eq(seoMeta.entityId, entityId))
        });

        if (existing) {
            await db.update(seoMeta).set({
                title: seoTitle,
                description: seoDesc,
                updatedAt: new Date()
            }).where(eq(seoMeta.id, existing.id));
            console.log(`[SEO-GEN] Đã cập nhật Meta SEO cho ${entityType} ${entityId}`);
        } else {
            await db.insert(seoMeta).values({
                entityType,
                entityId,
                title: seoTitle,
                description: seoDesc,
                updatedAt: new Date()
            });
            console.log(`[SEO-GEN] Đã tạo mới Meta SEO cho ${entityType} ${entityId}`);
        }

    } catch (e) {
        console.error("[SEO-GEN] Lỗi khi tạo meta SEO:", e);
    }
};
