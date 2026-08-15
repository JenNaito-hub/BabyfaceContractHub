import {
  describeFalError,
  extractMediaUrl,
  falHeaders,
  isFalUrl,
  missingKeyResponse,
} from "@/lib/fal";

export const runtime = "nodejs";

/**
 * Client poll route này vài giây một lần thay vì để server chờ.
 * Sinh video mất vài phút — giữ một request mở lâu như vậy sẽ vượt
 * giới hạn thời gian của serverless function.
 */
export async function GET(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) return missingKeyResponse();

  const params = new URL(request.url).searchParams;
  const statusUrl = params.get("statusUrl") ?? "";
  const responseUrl = params.get("responseUrl") ?? "";

  // Chặn SSRF: chỉ gọi được vào hạ tầng fal.
  if (!isFalUrl(statusUrl) || !isFalUrl(responseUrl)) {
    return Response.json(
      { error: "bad_url", message: "URL không thuộc fal.ai" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(statusUrl, { headers: falHeaders(key), cache: "no-store" });
    if (!res.ok) {
      return Response.json(
        { error: "fal_error", message: await describeFalError(res) },
        { status: 502 },
      );
    }

    const status = (await res.json()) as { status?: string; queue_position?: number };
    const state = status.status ?? "IN_QUEUE";

    if (state !== "COMPLETED") {
      return Response.json({ done: false, state, queuePosition: status.queue_position ?? null });
    }

    const resultRes = await fetch(responseUrl, { headers: falHeaders(key), cache: "no-store" });
    if (!resultRes.ok) {
      return Response.json(
        { error: "fal_error", message: await describeFalError(resultRes) },
        { status: 502 },
      );
    }

    const payload = await resultRes.json();
    const mediaUrl = extractMediaUrl(payload);
    if (!mediaUrl) {
      return Response.json(
        {
          error: "no_media",
          message: "Model chạy xong nhưng không tìm thấy file kết quả trong phản hồi.",
        },
        { status: 502 },
      );
    }

    return Response.json({ done: true, state, mediaUrl });
  } catch (err) {
    return Response.json(
      {
        error: "network",
        message: err instanceof Error ? err.message : "Không kiểm tra được trạng thái",
      },
      { status: 502 },
    );
  }
}
