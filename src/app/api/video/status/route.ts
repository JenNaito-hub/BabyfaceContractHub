import { MODELS } from "@/lib/fal";

export const runtime = "nodejs";
// Luôn đọc env lúc chạy, không cache — cắm key xong refresh là thấy đổi ngay.
export const dynamic = "force-dynamic";

/**
 * Cho biết server đã có key nào chưa.
 *
 * Chỉ trả về true/false và tên model (không phải bí mật) — tuyệt đối không
 * trả về giá trị key, kể cả một phần.
 */
export async function GET() {
  return Response.json(
    {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      fal: Boolean(process.env.FAL_KEY),
      models: {
        image: MODELS.image,
        video: MODELS.video,
        imageToVideo: MODELS.imageToVideo,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
