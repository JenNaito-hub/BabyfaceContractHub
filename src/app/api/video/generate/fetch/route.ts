import { isFalUrl } from "@/lib/fal";

export const runtime = "nodejs";

/**
 * Tải file kết quả về qua server rồi mới đưa cho trình duyệt.
 * Đi vòng thế này để khỏi phụ thuộc vào cấu hình CORS của CDN fal —
 * client cần đọc được bytes để lưu vào IndexedDB.
 */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";

  if (!isFalUrl(url)) {
    return Response.json(
      { error: "bad_url", message: "URL không thuộc fal.ai" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return Response.json(
        { error: "fetch_failed", message: `Không tải được file (${res.status})` },
        { status: 502 },
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json(
      {
        error: "network",
        message: err instanceof Error ? err.message : "Không tải được file",
      },
      { status: 502 },
    );
  }
}
