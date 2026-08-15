// Template dựng showreel tự động + bản sinh kịch bản offline (khi chưa có API key).

import { uid } from "./db";
import type {
  Asset,
  Caption,
  Clip,
  Project,
  ScriptDoc,
  ScriptRequest,
  Transition,
  VideoTalent,
} from "./types";

export type ShowreelTemplate = {
  id: string;
  name: string;
  desc: string;
  /** Số giây mỗi clip. */
  perClip: number;
  transition: Transition;
  zoom: number;
  background: string;
  caption: {
    size: number;
    color: string;
    background: string;
    x: number;
    y: number;
    align: Caption["align"];
  };
  /** Có thẻ tên talent ở clip đầu không. */
  intro: boolean;
};

export const SHOWREEL_TEMPLATES: ShowreelTemplate[] = [
  {
    id: "casting",
    name: "Casting Card",
    desc: "Thẻ tên + vai ở mỗi clip, nền tối, chuyển mờ. Hợp gửi client duyệt talent.",
    perClip: 2.5,
    transition: "fade",
    zoom: 1.08,
    background: "#1A1A1A",
    caption: {
      size: 5.5,
      color: "#EFEEEA",
      background: "rgba(26,26,26,0.72)",
      x: 50,
      y: 86,
      align: "center",
    },
    intro: true,
  },
  {
    id: "punch",
    name: "Punch Reel",
    desc: "Cắt nhanh 1.2s/clip, chữ vàng lime nổi bật, chuyển trượt. Hợp Reels/TikTok.",
    perClip: 1.2,
    transition: "slide",
    zoom: 1.15,
    background: "#000000",
    caption: {
      size: 7,
      color: "#D7F205",
      background: "",
      x: 50,
      y: 80,
      align: "center",
    },
    intro: true,
  },
  {
    id: "lookbook",
    name: "Lookbook",
    desc: "Chậm 3.5s/clip, zoom nhẹ, chữ nhỏ góc dưới trái. Hợp profile/portfolio.",
    perClip: 3.5,
    transition: "fade",
    zoom: 1.06,
    background: "#EFEEEA",
    caption: {
      size: 3.6,
      color: "#1A1A1A",
      background: "rgba(239,238,234,0.85)",
      x: 22,
      y: 90,
      align: "left",
    },
    intro: false,
  },
  {
    id: "clean",
    name: "Clean Cut",
    desc: "Không chữ, chuyển mờ, giữ nguyên khung. Để tự thêm chữ sau trong Editor.",
    perClip: 2,
    transition: "fade",
    zoom: 1,
    background: "#000000",
    caption: {
      size: 5,
      color: "#FFFFFF",
      background: "",
      x: 50,
      y: 85,
      align: "center",
    },
    intro: false,
  },
];

export type ShowreelInput = {
  name: string;
  width: number;
  height: number;
  template: ShowreelTemplate;
  talents: VideoTalent[];
  /** Tra cứu asset để biết clip là video hay ảnh và dài bao nhiêu. */
  assets: Map<string, Asset>;
  musicAssetId?: string;
  /** Tối đa bao nhiêu media của mỗi talent. */
  perTalent: number;
};

/** Dựng project showreel từ danh sách talent đã chọn. */
export function buildShowreel(input: ShowreelInput): Project {
  const { template: tpl, assets } = input;
  const clips: Clip[] = [];

  for (const talent of input.talents) {
    const media = talent.mediaIds
      .map((id) => assets.get(id))
      .filter((a): a is Asset => !!a && a.kind !== "audio")
      .slice(0, Math.max(1, input.perTalent));

    media.forEach((asset, i) => {
      // Video ngắn hơn thời lượng template thì lấy đúng độ dài thật.
      const duration =
        asset.kind === "video" && asset.duration > 0
          ? Math.min(tpl.perClip, asset.duration)
          : tpl.perClip;

      const showLabel = tpl.intro && i === 0;
      const caption: Caption | undefined = showLabel
        ? {
            text: talent.name,
            sub: [talent.role, talent.note].filter(Boolean).join(" · "),
            align: tpl.caption.align,
            x: tpl.caption.x,
            y: tpl.caption.y,
            size: tpl.caption.size,
            color: tpl.caption.color,
            background: tpl.caption.background,
            delay: 0.2,
            hold: Math.max(1, duration - 0.4),
          }
        : undefined;

      clips.push({
        id: uid("clip"),
        assetId: asset.id,
        trimStart: 0,
        duration,
        fit: "cover",
        zoom: tpl.zoom,
        transition: clips.length === 0 ? "none" : tpl.transition,
        muted: true, // showreel chạy nhạc nền, tắt tiếng gốc
        volume: 1,
        caption,
      });
    });
  }

  const now = Date.now();
  return {
    id: uid("prj"),
    name: input.name,
    width: input.width,
    height: input.height,
    fps: 30,
    background: tpl.background,
    clips,
    music: input.musicAssetId
      ? { assetId: input.musicAssetId, volume: 0.85, fadeOut: 1.5 }
      : undefined,
    createdAt: now,
    updatedAt: now,
    origin: "showreel",
  };
}

/** Project rỗng cho Editor. */
export function emptyProject(name: string, width: number, height: number): Project {
  const now = Date.now();
  return {
    id: uid("prj"),
    name,
    width,
    height,
    fps: 30,
    background: "#000000",
    clips: [],
    createdAt: now,
    updatedAt: now,
    origin: "editor",
  };
}

/** "5s" · "3-4s" · "khoảng 2 giây" → số giây. Không đọc được thì trả về mặc định. */
function parseSeconds(raw: string, fallback: number): number {
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return fallback;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60) : fallback;
}

/**
 * Dựng project storyboard từ shotlist: mỗi cảnh thành 1 clip placeholder
 * (chưa có media) mang sẵn chữ mô tả. Ráp footage vào sau trong Editor.
 */
export function projectFromScript(
  doc: ScriptDoc,
  width: number,
  height: number,
): Project {
  const fallback = doc.shots.length > 0 ? doc.durationSec / doc.shots.length : 3;

  const clips: Clip[] = doc.shots.map((shot, i) => ({
    id: uid("clip"),
    assetId: "", // placeholder — Editor sẽ hỏi gắn media
    trimStart: 0,
    duration: parseSeconds(shot.duration, fallback),
    fit: "cover",
    zoom: 1,
    transition: i === 0 ? "none" : "fade",
    muted: true,
    volume: 1,
    aiPrompt: shot.aiPrompt,
    caption: {
      text: shot.shot,
      sub: shot.description,
      align: "center",
      x: 50,
      y: 50,
      size: 5,
      color: "#FFFFFF",
      background: "rgba(26,26,26,0.7)",
      delay: 0,
      hold: 0,
    },
  }));

  const now = Date.now();
  return {
    id: uid("prj"),
    name: doc.title,
    width,
    height,
    fps: 30,
    background: "#1A1A1A",
    clips,
    createdAt: now,
    updatedAt: now,
    origin: "editor",
  };
}

export function defaultCaption(text: string): Caption {
  return {
    text,
    sub: "",
    align: "center",
    x: 50,
    y: 82,
    size: 6,
    color: "#FFFFFF",
    background: "rgba(0,0,0,0.55)",
    delay: 0,
    hold: 0,
  };
}

// ------------------------------------------------------- Kịch bản offline

const PLATFORM_HINT: Record<string, { hook: string; cta: string; camera: string[] }> = {
  tiktok: {
    hook: "3 giây đầu phải chặn tay lướt: cận mặt + câu hỏi thẳng vấn đề.",
    cta: "Nhấn theo dõi để xem phần 2.",
    camera: ["Cận mặt, handheld", "Góc thấp, đi tới", "Quay vòng 180°", "POV cầm tay"],
  },
  reels: {
    hook: "Mở bằng hành động dở dang, chưa giải thích gì cả.",
    cta: "Lưu lại để dùng khi cần.",
    camera: ["Cận, gimbal đi ngang", "Trung, tilt lên", "Cận vật thể, macro", "Toàn cảnh, drone thấp"],
  },
  youtube: {
    hook: "Nêu kết quả cuối trước, rồi quay lại kể quá trình.",
    cta: "Đăng ký kênh để xem tập đầy đủ.",
    camera: ["Toàn cảnh dựng bối cảnh", "Trung 2 nhân vật", "Cận phản ứng", "Over-the-shoulder"],
  },
  tvc: {
    hook: "Một hình ảnh biểu tượng gắn liền với sản phẩm.",
    cta: "Tên thương hiệu + slogan đóng.",
    camera: ["Toàn cảnh sang trọng, dolly", "Cận sản phẩm, xoay chậm", "Trung talent, ánh sáng viền", "Cận tay tương tác sản phẩm"],
  },
  profile: {
    hook: "Chân dung tĩnh, ánh sáng đẹp, nhìn thẳng ống kính.",
    cta: "Liên hệ Babyface để booking.",
    camera: ["Chân dung tĩnh", "Trung xoay nhẹ", "Cận chi tiết trang phục", "Toàn thân, đi tới"],
  },
};

/**
 * Rút chủ thể ngắn gọn từ brief để câu chữ đọc xuôi.
 * "Quảng cáo trà sữa khoai môn cho sinh viên, quay tại quán, 29k"
 *   → "trà sữa khoai môn cho sinh viên"
 */
function subjectOf(brief: string): string {
  const first = brief.split(/[,.;\n]/)[0]?.trim() ?? "";
  if (!first) return "sản phẩm";

  // Bỏ các cụm mở đầu chỉ nêu thể loại, không phải chủ thể.
  const stripped = first.replace(
    /^(quảng cáo|video|clip|tvc|làm (một )?(video|clip)|viết kịch bản( cho)?|kịch bản( cho)?)\s+/i,
    "",
  );
  const subject = (stripped || first).trim();
  return subject.length > 60 ? `${subject.slice(0, 57)}…` : subject;
}

/**
 * Bản sinh kịch bản chạy offline — dùng khi server chưa cấu hình ANTHROPIC_API_KEY.
 * Không thông minh bằng Claude nhưng vẫn cho ra khung shotlist dùng được ngay.
 */
export function offlineScript(req: ScriptRequest): ScriptDoc {
  const hint = PLATFORM_HINT[req.platform] ?? PLATFORM_HINT.reels;
  const n = Math.max(3, Math.min(req.shotCount, 12));
  const per = Math.max(1, Math.round(req.durationSec / n));
  const short = subjectOf(req.brief);

  const beats = [
    { label: "Hook", desc: `Mở đầu bắt mắt giới thiệu ${short}`, audio: "Nhạc vào, không lời thoại" },
    { label: "Vấn đề", desc: `Cho thấy tình huống mà ${short} giải quyết`, audio: "Voiceover câu 1" },
    { label: "Giải pháp", desc: `Đưa ${short} vào khung hình như câu trả lời`, audio: "Voiceover câu 2" },
    { label: "Chi tiết", desc: `Cận cảnh điểm mạnh của ${short}`, audio: "Nhạc lên, tiếng hiện trường" },
    { label: "Cảm xúc", desc: "Phản ứng hài lòng của nhân vật", audio: "Tiếng cười / tiếng thật" },
    { label: "Bối cảnh", desc: "Toàn cảnh cho thấy không gian sử dụng", audio: "Nhạc nền" },
    { label: "Bằng chứng", desc: "Khoảnh khắc chứng minh lời hứa ở đầu video", audio: "Voiceover câu 3" },
    { label: "So sánh", desc: "Trước / sau đặt cạnh nhau", audio: "Nhạc ngắt nhịp" },
    { label: "Nhịp phụ", desc: "Chi tiết nhỏ tạo chất riêng cho thương hiệu", audio: "Nhạc nền" },
    { label: "Kêu gọi", desc: "Logo + thông điệp đóng", audio: "Nhạc kết" },
    { label: "Hậu CTA", desc: "Một khoảnh khắc thừa gây tò mò", audio: "Im lặng" },
    { label: "Đóng", desc: "Fade về logo", audio: "Nhạc nhỏ dần" },
  ];

  const shots = Array.from({ length: n }, (_, i) => {
    const beat = beats[Math.min(i, beats.length - 1)];
    return {
      shot: `${i + 1}. ${beat.label}`,
      description: beat.desc,
      camera: hint.camera[i % hint.camera.length],
      duration: `${per}s`,
      audio: beat.audio,
      aiPrompt: `${beat.desc}, ${hint.camera[i % hint.camera.length].toLowerCase()}, tông ${req.tone}, ánh sáng điện ảnh, ${per} giây, chất lượng quảng cáo`,
    };
  });

  return {
    id: uid("script"),
    title: short,
    brief: req.brief,
    platform: req.platform,
    durationSec: req.durationSec,
    tone: req.tone,
    language: req.language,
    logline: `Video ${req.durationSec}s giọng ${req.tone} về ${short}, dựng cho ${req.platform}.`,
    hook: hint.hook,
    voiceover: [
      `Câu 1 — nêu vấn đề liên quan tới ${short}.`,
      `Câu 2 — giới thiệu ${short} là lời giải.`,
      "Câu 3 — chốt lợi ích rõ ràng, một ý duy nhất.",
    ],
    shots,
    cta: hint.cta,
    ai: false,
    createdAt: Date.now(),
  };
}
