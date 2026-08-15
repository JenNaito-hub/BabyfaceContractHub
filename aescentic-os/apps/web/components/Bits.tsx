// Nhập từ `/labels` chứ không phải gốc: `Bits` được component client dùng, mà
// gốc `@aescentic/sales` kéo theo database — webpack sẽ nhét cả driver postgres
// vào bundle trình duyệt.
import {
  NHAN_KENH,
  NHAN_THANH_TOAN,
  NHAN_TRANG_THAI,
  type TrangThaiDon,
} from "@aescentic/sales/labels";

export function tienVND(n: number | null | undefined): string {
  return Math.round(Number(n ?? 0)).toLocaleString("vi-VN") + " đ";
}

export function tienNgan(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000_000) return (v / 1e9).toFixed(1).replace(".", ",") + " tỷ";
  if (Math.abs(v) >= 1_000_000) return (v / 1e6).toFixed(1).replace(".", ",") + " tr";
  if (Math.abs(v) >= 1_000) return Math.round(v / 1000) + "k";
  return String(v);
}

export function ngayGio(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  return (
    x.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) +
    " " +
    x.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

const MAU_TRANG_THAI: Record<string, string> = {
  new: "bg-line text-ink",
  confirmed: "bg-blue-100 text-blue-900",
  shipping: "bg-amber-100 text-amber-900",
  completed: "bg-chip text-ink",
  cancelled: "bg-danger/15 text-danger",
  returned: "bg-danger/15 text-danger",
};

export function TrangThai({ v }: { v: string }) {
  return (
    <span className={`pill ${MAU_TRANG_THAI[v] ?? "bg-line text-ink"}`}>
      {NHAN_TRANG_THAI[v as TrangThaiDon] ?? v}
    </span>
  );
}

const MAU_KENH: Record<string, string> = {
  shopee: "#E8553A",
  tiktok: "#1A1A1A",
  facebook: "#3B6BD6",
  website: "#8FA004",
  store: "#D7F205",
  b2b: "#6A7059",
  event: "#6A7059",
};

export function Kenh({ v }: { v: string }) {
  const bg = MAU_KENH[v] ?? "#6A7059";
  return (
    <span className="pill" style={{ background: bg, color: v === "store" ? "#141810" : "#fff" }}>
      {NHAN_KENH[v] ?? v}
    </span>
  );
}

export function ThanhToan({ v }: { v: string }) {
  const cls = v === "paid" ? "bg-chip text-ink" : v === "cod" ? "bg-amber-100 text-amber-900" : "bg-line text-muted";
  return <span className={`pill ${cls}`}>{NHAN_THANH_TOAN[v] ?? v}</span>;
}

export function The({
  nhan,
  giaTri,
  phu,
  noiBat,
}: {
  nhan: string;
  giaTri: string | number;
  phu?: string;
  noiBat?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${noiBat ? "bg-ink text-paper" : "bg-surface"}`}>
      <div className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${noiBat ? "text-paper/60" : "text-muted"}`}>
        {nhan}
      </div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{giaTri}</div>
      {phu && <div className={`mt-0.5 text-xs ${noiBat ? "text-paper/60" : "text-muted"}`}>{phu}</div>}
    </div>
  );
}

export function Trong({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

/** Cột dọc đơn giản — doanh thu theo ngày. */
export function CotNgay({ data }: { data: { nhan: string; giaTri: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.giaTri));
  if (!data.length) return <Trong>Chưa có dữ liệu</Trong>;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 150 }}>
        {data.map((d) => (
          <div key={d.nhan} className="group relative flex-1">
            <div
              className="w-full bg-accent transition group-hover:bg-ink"
              style={{ height: Math.max(2, (d.giaTri / max) * 150) }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 font-mono text-[11px] text-paper group-hover:block">
              {d.nhan.slice(5)} · {tienNgan(d.giaTri)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-muted">
        <span>{data[0]?.nhan.slice(5)}</span>
        <span>cao nhất {tienNgan(max)}</span>
        <span>{data[data.length - 1]?.nhan.slice(5)}</span>
      </div>
    </div>
  );
}

export function ThanhNgang({ data }: { data: { nhan: string; giaTri: number; mau?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.giaTri));
  if (!data.length) return <Trong>Chưa có dữ liệu</Trong>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.nhan}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium">{d.nhan}</span>
            <span className="shrink-0 font-semibold tabular-nums">{tienNgan(d.giaTri)}</span>
          </div>
          <div className="h-2.5 w-full bg-line/60">
            <div className="h-full" style={{ width: `${(d.giaTri / max) * 100}%`, background: d.mau ?? "#8FA004" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
