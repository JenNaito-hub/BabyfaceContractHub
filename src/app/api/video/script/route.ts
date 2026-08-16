import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

/** Schema ràng buộc output — Claude buộc phải trả đúng hình dạng này. */
const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Tên ngắn gọn cho video" },
    logline: { type: "string", description: "Một câu tóm tắt toàn bộ video" },
    hook: { type: "string", description: "Mô tả cụ thể 3 giây đầu phải làm gì" },
    voiceover: {
      type: "array",
      items: { type: "string" },
      description: "Các câu voiceover / lời thoại, mỗi phần tử là một câu",
    },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          shot: { type: "string", description: "Số thứ tự + tên cảnh, ví dụ '1. Hook'" },
          description: { type: "string", description: "Nội dung diễn ra trong cảnh" },
          camera: { type: "string", description: "Cỡ cảnh và chuyển động máy" },
          duration: { type: "string", description: "Thời lượng, ví dụ '3s'" },
          audio: { type: "string", description: "Âm thanh / nhạc / lời trong cảnh" },
          aiPrompt: {
            type: "string",
            description:
              "Prompt tiếng Anh dùng cho công cụ sinh video AI (Veo, Runway, Sora), mô tả hình ảnh, ánh sáng, chuyển động máy",
          },
        },
        required: ["shot", "description", "camera", "duration", "audio", "aiPrompt"],
        additionalProperties: false,
      },
    },
    cta: { type: "string", description: "Kêu gọi hành động ở cuối video" },
  },
  required: ["title", "logline", "hook", "voiceover", "shots", "cta"],
  additionalProperties: false,
} as const;

const SYSTEM = `Bạn là copywriter kiêm đạo diễn của Babyface — công ty sản xuất nội dung và quản lý talent tại Việt Nam.

Nhiệm vụ: từ brief của khách, viết kịch bản video kèm shotlist quay được ngay tại hiện trường.

Nguyên tắc:
- Viết bằng ngôn ngữ người dùng yêu cầu. Riêng trường aiPrompt luôn viết bằng tiếng Anh.
- Shotlist phải cụ thể: nói rõ cỡ cảnh, chuyển động máy, ai làm gì. Không viết chung chung kiểu "quay đẹp".
- Tổng thời lượng các cảnh phải khớp thời lượng yêu cầu.
- Hook chiếm 3 giây đầu và phải có lý do cụ thể khiến người xem dừng lại.
- Voiceover viết như người nói, không như văn bản quảng cáo.
- Bám sát brief. Nếu brief thiếu thông tin, chọn phương án hợp lý nhất thay vì hỏi lại.

Khi có ảnh tham chiếu kèm theo:
- Nhìn kỹ ảnh rồi mới viết. Ảnh là sự thật về sản phẩm/talent/bối cảnh, brief chỉ là mô tả.
- Mô tả đúng những gì thấy trong ảnh: màu sắc, kiểu dáng, bao bì, trang phục, không gian.
  Đừng bịa chi tiết trái với ảnh.
- Trường aiPrompt phải tả lại đặc điểm nhìn thấy được (màu, chất liệu, hình dáng) để công cụ
  sinh video dựng ra đúng thứ đó, chứ không phải một sản phẩm chung chung.`;

type RefImage = { name?: string; mediaType?: string; data?: string };

type Body = {
  brief?: string;
  platform?: string;
  durationSec?: number;
  tone?: string;
  language?: string;
  shotCount?: number;
  /** Ảnh sản phẩm / talent / bối cảnh để Claude nhìn rồi viết. */
  images?: RefImage[];
};

/** Trần an toàn cho phần ảnh — body request có giới hạn dung lượng. */
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_key",
        message:
          "Server chưa có ANTHROPIC_API_KEY. App sẽ dùng bản sinh kịch bản offline.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Body không hợp lệ" }, { status: 400 });
  }

  const brief = (body.brief ?? "").trim();
  if (!brief) {
    return NextResponse.json(
      { error: "missing_brief", message: "Cần nhập brief" },
      { status: 400 },
    );
  }

  const platform = body.platform ?? "reels";
  const durationSec = clamp(body.durationSec ?? 30, 5, 600);
  const tone = body.tone ?? "năng lượng";
  const language = body.language ?? "Tiếng Việt";
  const shotCount = clamp(body.shotCount ?? 6, 3, 16);

  const images = (body.images ?? [])
    .filter(
      (img): img is Required<RefImage> =>
        typeof img?.data === "string" &&
        img.data.length > 0 &&
        ALLOWED_IMAGE_TYPES.has(img.mediaType ?? ""),
    )
    // base64 nở ~4/3 so với bytes gốc — quy đổi lại để so với trần.
    .filter((img) => (img.data.length * 3) / 4 <= MAX_IMAGE_BYTES)
    .slice(0, MAX_IMAGES);

  const prompt = [
    `Brief: ${brief}`,
    `Nền tảng: ${platform}`,
    `Thời lượng: ${durationSec} giây`,
    `Tông giọng: ${tone}`,
    `Ngôn ngữ kịch bản: ${language}`,
    `Số cảnh: đúng ${shotCount} cảnh`,
    images.length
      ? `\nCó ${images.length} ảnh tham chiếu kèm theo${
          images.some((i) => i.name) ? ` (${images.map((i) => i.name).join(", ")})` : ""
        }. Nhìn ảnh rồi viết cho khớp.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Ảnh đặt trước chữ — Claude đọc hình rồi mới tới yêu cầu.
  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType as "image/jpeg", data: img.data },
      }),
    ),
    { type: "text", text: prompt },
  ];

  const client = new Anthropic({ apiKey });

  const params = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCRIPT_SCHEMA },
    },
    messages: [{ role: "user", content }],
  };

  try {
    const response = await createWithFallback(client, params);

    // Bộ lọc an toàn có thể từ chối — phải kiểm tra trước khi đọc content.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "refusal",
          message: "Claude từ chối brief này. Thử diễn đạt lại nội dung.",
        },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error: "truncated",
          message: "Kịch bản dài quá giới hạn. Giảm số cảnh rồi thử lại.",
        },
        { status: 502 },
      );
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (!text) {
      return NextResponse.json(
        { error: "empty", message: "Claude không trả về nội dung" },
        { status: 502 },
      );
    }

    return NextResponse.json({ script: JSON.parse(text) });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream", message: describe(err) },
      { status: statusOf(err) },
    );
  }
}

/**
 * Gọi Claude kèm server-side fallback: nếu bộ phân loại an toàn từ chối,
 * request tự chạy lại trên Opus 4.8 thay vì trả lỗi cho người dùng.
 * Nếu tài khoản chưa bật beta này thì gọi lại bản thường.
 */
async function createWithFallback(
  client: Anthropic,
  params: Record<string, unknown>,
): Promise<Anthropic.Message> {
  try {
    const beta = client.beta.messages.create as unknown as (
      p: Record<string, unknown>,
    ) => Promise<Anthropic.Message>;
    return await beta.call(client.beta.messages, {
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof NotFoundError) {
      const plain = client.messages.create as unknown as (
        p: Record<string, unknown>,
      ) => Promise<Anthropic.Message>;
      return await plain.call(client.messages, params);
    }
    throw err;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function statusOf(err: unknown): number {
  if (err instanceof RateLimitError) return 429;
  if (err instanceof AuthenticationError) return 401;
  if (err instanceof APIError && typeof err.status === "number") {
    return err.status >= 500 ? 502 : err.status;
  }
  return 502;
}

function describe(err: unknown): string {
  if (err instanceof RateLimitError) {
    return "Đang bị giới hạn tốc độ, thử lại sau ít phút.";
  }
  if (err instanceof AuthenticationError) {
    return "ANTHROPIC_API_KEY không hợp lệ.";
  }
  if (err instanceof APIConnectionError) {
    return "Không kết nối được tới Claude API.";
  }
  if (err instanceof APIError) return err.message;
  if (err instanceof SyntaxError) return "Claude trả về JSON không đọc được.";
  return err instanceof Error ? err.message : "Lỗi không xác định";
}
