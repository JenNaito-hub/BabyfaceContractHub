// Tiện ích dùng chung cho các server route gọi fal.ai.
// Chỉ chạy phía server — FAL_KEY không bao giờ ra tới client.

export const FAL_QUEUE = "https://queue.fal.run";

/**
 * Model mặc định. fal đổi/ bổ sung model liên tục nên cho phép ghi đè bằng
 * biến môi trường — đổi model không cần sửa code, không cần deploy lại code.
 */
export const MODELS = {
  image: process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
  video: process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v1/standard/text-to-video",
  imageToVideo:
    process.env.FAL_IMAGE_TO_VIDEO_MODEL ||
    "fal-ai/kling-video/v1/standard/image-to-video",
} as const;

/**
 * Chỉ cho phép gọi tới hạ tầng của fal.
 * Không có bước này thì client gửi URL bất kỳ là biến server thành proxy
 * đi quét mạng nội bộ (SSRF).
 */
export function isFalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  return (
    host === "queue.fal.run" ||
    host === "fal.run" ||
    host === "fal.media" ||
    host.endsWith(".fal.media") ||
    host.endsWith(".fal.run")
  );
}

/**
 * Model sinh video của fal chỉ nhận vài mốc thời lượng cố định — phổ biến là
 * 5 và 10 giây. Clip trên timeline có thể dài tới 30s; gửi thẳng con số đó là
 * bị model từ chối (422). Quy về mốc gần nhất mà model chấp nhận.
 */
export function videoDuration(requested?: number): string {
  const wanted = Number.isFinite(requested) ? Number(requested) : 5;
  return wanted > 7 ? "10" : "5";
}

export function falHeaders(key: string): HeadersInit {
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

export function missingKeyResponse() {
  return Response.json(
    {
      error: "missing_key",
      message:
        "Server chưa có FAL_KEY. Thêm biến môi trường FAL_KEY rồi deploy lại để dùng tính năng sinh media bằng AI.",
    },
    { status: 503 },
  );
}

/** fal trả lỗi kèm body — chuyển nguyên văn ra để biết đường sửa. */
export async function describeFalError(res: Response): Promise<string> {
  let detail = "";
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      detail = json.detail
        ? typeof json.detail === "string"
          ? json.detail
          : JSON.stringify(json.detail)
        : text;
    } catch {
      detail = text;
    }
  } catch {
    detail = "(không đọc được nội dung lỗi)";
  }

  if (res.status === 401 || res.status === 403) {
    return `FAL_KEY không hợp lệ hoặc không đủ quyền (${res.status}). ${detail}`.trim();
  }
  if (res.status === 404) {
    return `Không tìm thấy model — kiểm tra lại FAL_IMAGE_MODEL / FAL_VIDEO_MODEL. ${detail}`.trim();
  }
  if (res.status === 422) {
    return `Model từ chối tham số đầu vào. ${detail}`.trim();
  }
  if (res.status === 429) {
    return `fal.ai đang giới hạn tốc độ, thử lại sau ít phút. ${detail}`.trim();
  }
  return `fal.ai trả lỗi ${res.status}. ${detail}`.trim();
}

/**
 * Rút URL file kết quả. Mỗi model trả một hình dạng khác nhau nên dò vài kiểu
 * phổ biến thay vì cứng nhắc một đường.
 */
export function extractMediaUrl(payload: unknown): string | null {
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number): string | null => {
    if (!node || typeof node !== "object" || depth > 6 || seen.has(node)) return null;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const obj = node as Record<string, unknown>;
    // { url: "https://..." } là hình dạng fal dùng cho cả ảnh lẫn video.
    if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url;

    // Ưu tiên các khoá hay gặp trước khi quét toàn bộ.
    for (const key of ["video", "image", "images", "output", "data", "files", "audio"]) {
      if (key in obj) {
        const found = walk(obj[key], depth + 1);
        if (found) return found;
      }
    }
    for (const value of Object.values(obj)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(payload, 0);
}
