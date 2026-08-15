"use client";

// Sinh media bằng AI (fal.ai) rồi nạp thẳng vào thư viện.
// Poll từ phía client: sinh video mất vài phút, giữ một request server
// mở lâu như vậy sẽ vượt giới hạn thời gian của serverless function.

import { importFile } from "./db";
import type { Asset } from "./types";

export type GenerateKind = "image" | "video";

export type GenerateOptions = {
  kind: GenerateKind;
  prompt: string;
  /** Tỉ lệ khung hình của project, ví dụ "9:16". */
  aspect: string;
  durationSec?: number;
  /** Đặt tên file cho dễ tìm lại trong thư viện. */
  label?: string;
  onStage?: (stage: string) => void;
  signal?: AbortSignal;
};

/** Lỗi có thông điệp đã dịch sẵn để hiện thẳng lên UI. */
export class GenerateError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GenerateError";
  }
}

async function readError(res: Response, fallback: string): Promise<GenerateError> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return new GenerateError(data.error ?? "unknown", data.message ?? fallback);
  } catch {
    return new GenerateError("unknown", fallback);
  }
}

const POLL_MS = 3000;
/** Trần an toàn: video dài nhất cũng hiếm khi quá 10 phút. */
const MAX_WAIT_MS = 10 * 60 * 1000;

export function aspectOf(width: number, height: number): string {
  const r = width / height;
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 16 / 9) < 0.05) return "16:9";
  if (Math.abs(r - 4 / 5) < 0.05) return "4:5";
  if (Math.abs(r - 1) < 0.05) return "1:1";
  return r < 1 ? "9:16" : "16:9";
}

/**
 * Chạy trọn vòng: gửi yêu cầu → chờ fal xử lý → tải file → lưu vào IndexedDB.
 * Trả về Asset đã sẵn sàng gắn vào clip.
 */
export async function generateAsset(opts: GenerateOptions): Promise<Asset> {
  const { kind, prompt, aspect, durationSec, onStage, signal } = opts;

  onStage?.("Đang gửi yêu cầu tới fal.ai…");
  const submitRes = await fetch("/api/video/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, prompt, aspect, duration: durationSec }),
    signal,
  });
  if (!submitRes.ok) throw await readError(submitRes, "Không gửi được yêu cầu");

  const job = (await submitRes.json()) as { statusUrl: string; responseUrl: string };

  const query = new URLSearchParams({
    statusUrl: job.statusUrl,
    responseUrl: job.responseUrl,
  });

  const started = Date.now();
  let mediaUrl = "";

  while (!mediaUrl) {
    if (signal?.aborted) throw new GenerateError("aborted", "Đã huỷ");
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new GenerateError("timeout", "Chờ quá 10 phút mà chưa xong — thử lại sau.");
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
    if (signal?.aborted) throw new GenerateError("aborted", "Đã huỷ");

    const statusRes = await fetch(`/api/video/generate/status?${query}`, { signal });
    if (!statusRes.ok) throw await readError(statusRes, "Mất liên lạc khi chờ kết quả");

    const status = (await statusRes.json()) as {
      done: boolean;
      state?: string;
      queuePosition?: number | null;
      mediaUrl?: string;
    };

    if (status.done && status.mediaUrl) {
      mediaUrl = status.mediaUrl;
      break;
    }

    const elapsed = Math.round((Date.now() - started) / 1000);
    const queue =
      typeof status.queuePosition === "number" && status.queuePosition > 0
        ? ` · đứng thứ ${status.queuePosition} trong hàng đợi`
        : "";
    onStage?.(`${status.state === "IN_PROGRESS" ? "Đang dựng" : "Đang chờ"} ${elapsed}s${queue}`);
  }

  onStage?.("Đang tải file về…");
  const fileRes = await fetch(`/api/video/generate/fetch?url=${encodeURIComponent(mediaUrl)}`, {
    signal,
  });
  if (!fileRes.ok) throw await readError(fileRes, "Không tải được file kết quả");

  const blob = await fileRes.blob();
  const ext = kind === "video" ? "mp4" : "png";
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const base = (opts.label || prompt).slice(0, 40).replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim();
  const name = `AI ${base || kind} ${stamp}.${ext}`;

  onStage?.("Đang lưu vào thư viện…");
  const file = new File([blob], name, {
    type: blob.type || (kind === "video" ? "video/mp4" : "image/png"),
  });
  return importFile(file);
}
