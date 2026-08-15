import {
  FAL_QUEUE,
  MODELS,
  describeFalError,
  falHeaders,
  missingKeyResponse,
} from "@/lib/fal";

export const runtime = "nodejs";

type Kind = "image" | "video";

type Body = {
  kind?: Kind;
  prompt?: string;
  /** Tỉ lệ khung hình của project, ví dụ "9:16". */
  aspect?: string;
  /** Có ảnh nguồn → dùng model image-to-video thay vì text-to-video. */
  imageUrl?: string;
  /** Giây, chỉ áp dụng cho video. */
  duration?: number;
};

/** fal dùng tên preset cho kích thước ảnh chứ không nhận số pixel tuỳ ý. */
function imageSizeFor(aspect: string): string {
  switch (aspect) {
    case "9:16":
      return "portrait_16_9";
    case "16:9":
      return "landscape_16_9";
    case "4:5":
      return "portrait_4_3";
    default:
      return "square_hd";
  }
}

export async function POST(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) return missingKeyResponse();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json", message: "Body không hợp lệ" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return Response.json(
      { error: "missing_prompt", message: "Cần có prompt mô tả cảnh" },
      { status: 400 },
    );
  }

  const kind: Kind = body.kind === "video" ? "video" : "image";
  const aspect = body.aspect ?? "9:16";

  const model =
    kind === "image"
      ? MODELS.image
      : body.imageUrl
        ? MODELS.imageToVideo
        : MODELS.video;

  // Mỗi model nhận tham số hơi khác nhau; đây là tập chung nhất.
  const input: Record<string, unknown> =
    kind === "image"
      ? { prompt, image_size: imageSizeFor(aspect), num_images: 1 }
      : {
          prompt,
          aspect_ratio: aspect,
          duration: String(Math.max(5, Math.round(body.duration ?? 5))),
          ...(body.imageUrl ? { image_url: body.imageUrl } : {}),
        };

  try {
    const res = await fetch(`${FAL_QUEUE}/${model}`, {
      method: "POST",
      headers: falHeaders(key),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      return Response.json(
        { error: "fal_error", message: await describeFalError(res) },
        { status: res.status === 429 ? 429 : 502 },
      );
    }

    const data = (await res.json()) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
    };

    // Dùng URL do fal trả về, không tự ghép: model có subpath
    // (vd fal-ai/flux/dev) thì đường status nằm ở base path khác.
    if (!data.status_url || !data.response_url) {
      return Response.json(
        {
          error: "unexpected_response",
          message: "fal.ai không trả về status_url/response_url như mong đợi.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      requestId: data.request_id ?? "",
      statusUrl: data.status_url,
      responseUrl: data.response_url,
      model,
      kind,
    });
  } catch (err) {
    return Response.json(
      {
        error: "network",
        message: err instanceof Error ? err.message : "Không gọi được fal.ai",
      },
      { status: 502 },
    );
  }
}
