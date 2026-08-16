// Kiểu dữ liệu cho Babyface Video Studio (app độc lập, data lưu trong trình duyệt).

export type AssetKind = "video" | "image" | "audio";

/** File gốc người dùng upload — blob nằm trong IndexedDB. */
export type Asset = {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  /** Giây. Video/audio mới có; ảnh = 0. */
  duration: number;
  width: number;
  height: number;
  createdAt: number;
  /** data URL ảnh thumbnail nhỏ, để list nhanh không cần load blob. */
  thumb?: string;
};

export type FitMode = "cover" | "contain";

export type TextAlign = "left" | "center" | "right";

/** Chữ chèn lên 1 clip. */
export type Caption = {
  text: string;
  sub?: string;
  align: TextAlign;
  /** Vị trí theo % khung hình. */
  x: number;
  y: number;
  size: number;
  color: string;
  /** Nền hộp chữ, "" = không nền. */
  background: string;
  /** Giây tính từ đầu clip. */
  delay: number;
  hold: number;
};

export type Transition = "none" | "fade" | "slide";

export type Clip = {
  id: string;
  /**
   * Rỗng = clip placeholder (chưa gắn media) — dùng khi dựng khung từ shotlist.
   * Vẫn render được: hiện nền + chữ, để sau ráp footage vào.
   */
  assetId: string;
  /** Cắt từ giây nào của file gốc (video). */
  trimStart: number;
  /** Độ dài clip trên timeline (giây). */
  duration: number;
  fit: FitMode;
  /** Zoom chậm (Ken Burns) — 1 = tắt. */
  zoom: number;
  transition: Transition;
  /** Giữ tiếng gốc của video clip. */
  muted: boolean;
  volume: number;
  caption?: Caption;
  /** Prompt tiếng Anh kèm theo từ shotlist — dùng để sinh media bằng AI. */
  aiPrompt?: string;
};

export type MusicTrack = {
  assetId: string;
  volume: number;
  /** Fade out ở N giây cuối. */
  fadeOut: number;
  /** Bắt đầu nhạc từ giây thứ mấy của file (bỏ qua đoạn intro). */
  startAt?: number;
};

export type Watermark = {
  assetId: string;
  /** % khung hình. */
  x: number;
  y: number;
  /** % chiều rộng khung hình. */
  scale: number;
  opacity: number;
};

export type Project = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  clips: Clip[];
  music?: MusicTrack;
  watermark?: Watermark;
  createdAt: number;
  updatedAt: number;
  /** Nguồn tạo: tay, showreel tự động, hoặc từ script. */
  origin?: "editor" | "showreel";
};

/** Tỉ lệ khung hình phổ biến. */
export const PRESETS: { id: string; label: string; width: number; height: number }[] = [
  { id: "reel", label: "Dọc 9:16 (Reels/TikTok)", width: 1080, height: 1920 },
  { id: "square", label: "Vuông 1:1 (Feed)", width: 1080, height: 1080 },
  { id: "wide", label: "Ngang 16:9 (YouTube)", width: 1920, height: 1080 },
  { id: "portrait45", label: "Dọc 4:5 (Instagram)", width: 1080, height: 1350 },
];

// ---------- Talent pool (độc lập với /talent) ----------

export type VideoTalent = {
  id: string;
  name: string;
  role: string;
  /** Chiều cao, số đo... tự do. */
  note: string;
  tags: string[];
  /** Asset id ảnh/clip của talent, dùng dựng showreel. */
  mediaIds: string[];
  createdAt: number;
};

// ---------- Quản lý sản xuất ----------

export type ProductionStatus =
  | "planning"
  | "shooting"
  | "editing"
  | "review"
  | "done";

export type Deliverable = {
  id: string;
  name: string;
  /** Ví dụ: "9:16 30s", "16:9 master". */
  spec: string;
  due: string;
  status: "todo" | "wip" | "review" | "approved";
  /** Link bản cut để review (Drive, Frame.io...). */
  link: string;
  note: string;
  /** Nối tới project trong Editor để mở thẳng bản dựng. */
  projectId?: string;
};

export type ShootDay = {
  id: string;
  date: string;
  location: string;
  callTime: string;
  note: string;
};

export type Production = {
  id: string;
  name: string;
  client: string;
  status: ProductionStatus;
  budget: number;
  startDate: string;
  endDate: string;
  crew: string[];
  shootDays: ShootDay[];
  deliverables: Deliverable[];
  note: string;
  createdAt: number;
  updatedAt: number;
};

// ---------- Script studio ----------

export type Shot = {
  shot: string;
  description: string;
  camera: string;
  duration: string;
  audio: string;
  aiPrompt: string;
};

export type ScriptDoc = {
  id: string;
  title: string;
  brief: string;
  /** Nền tảng đích: tiktok | youtube | tvc ... */
  platform: string;
  durationSec: number;
  tone: string;
  language: string;
  logline: string;
  hook: string;
  voiceover: string[];
  shots: Shot[];
  cta: string;
  /** true nếu sinh bằng Claude, false nếu dùng template offline. */
  ai: boolean;
  /** Ảnh sản phẩm/talent đã dùng làm tham chiếu khi viết kịch bản. */
  referenceAssetIds?: string[];
  createdAt: number;
};

export type ScriptRequest = {
  brief: string;
  platform: string;
  durationSec: number;
  tone: string;
  language: string;
  shotCount: number;
};
