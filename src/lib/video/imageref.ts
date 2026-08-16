"use client";

// Chuẩn bị ảnh tham chiếu để gửi lên server (Claude vision / fal image-to-video).
// Ảnh gốc từ máy ảnh có thể 5–10MB; gửi thẳng là vượt giới hạn body của
// serverless function. Thu nhỏ và nén lại trước khi gửi.

import { getAsset, getBlob } from "./db";

export type RefImage = {
  assetId: string;
  name: string;
  /** "image/jpeg" — luôn là jpeg sau khi nén. */
  mediaType: string;
  /** base64 thuần, không có tiền tố data: */
  data: string;
};

const MAX_EDGE = 1024;
const QUALITY = 0.82;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không đọc được ảnh"));
    img.src = url;
  });
}

/** Thu nhỏ 1 asset ảnh thành base64 jpeg đủ nhỏ để gửi qua API. */
export async function assetToRefImage(assetId: string): Promise<RefImage> {
  const [asset, blob] = await Promise.all([getAsset(assetId), getBlob(assetId)]);
  if (!asset || !blob) throw new Error("Không tìm thấy ảnh trong thư viện");
  if (asset.kind !== "image") throw new Error(`"${asset.name}" không phải ảnh`);

  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(MAX_EDGE / img.naturalWidth, MAX_EDGE / img.naturalHeight, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas");
    // Nền trắng: ảnh PNG trong suốt chuyển sang jpeg sẽ thành đen nếu không có.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    return {
      assetId,
      name: asset.name,
      mediaType: "image/jpeg",
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function assetsToRefImages(assetIds: string[]): Promise<RefImage[]> {
  const out: RefImage[] = [];
  for (const id of assetIds) {
    try {
      out.push(await assetToRefImage(id));
    } catch {
      // Ảnh hỏng/đã xoá thì bỏ qua, không chặn cả yêu cầu.
    }
  }
  return out;
}

export function toDataUrl(ref: RefImage): string {
  return `data:${ref.mediaType};base64,${ref.data}`;
}
