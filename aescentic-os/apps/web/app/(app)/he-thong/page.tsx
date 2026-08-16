import Link from "next/link";
import { docPhien } from "@/lib/session";
import { demTheoTinhTrang, MODULES, NHAN_TINH_TRANG, type TinhTrang } from "@/lib/sitemap";
import { The } from "@/components/Bits";

export const dynamic = "force-dynamic";

const MAU: Record<TinhTrang, string> = {
  xong: "bg-chip text-ink",
  "dang-lam": "bg-amber-100 text-amber-900",
  chua: "bg-line text-muted",
};

/**
 * Bản đồ 20 module và tình trạng thật.
 *
 * Trang này tồn tại để Jen luôn biết chính xác cái gì chạy được — thay vì phải
 * hỏi. Nó đọc từ `lib/sitemap.ts`, cùng một nguồn với tài liệu kiến trúc.
 */
export default async function TrangHeThong() {
  await docPhien();
  const dem = demTheoTinhTrang();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Bản đồ hệ thống</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          AESCENTIC OS gồm {dem.tong} module. Trang này nói chính xác module nào đã chạy được,
          module nào mới có một phần, module nào chưa dựng — không làm tròn lên.
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <The nhan="Đã dùng được một phần trở lên" giaTri={`${dem.xong + dem.dangLam}/${dem.tong}`} noiBat />
        <The nhan="Chưa dựng" giaTri={dem.chua} phu="Chưa có màn hình nào" />
        <The nhan="Chờ Jen hoặc bên thứ ba" giaTri={MODULES.filter((m) => m.choGi).length} />
      </div>

      <div className="space-y-3">
        {MODULES.map((m) => (
          <section key={m.so} className="border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <span className="font-mono text-xs text-muted">{m.so}</span>
              <h2 className="flex-1 font-bold">{m.ten}</h2>
              <span className={`pill ${MAU[m.tinhTrang]}`}>{NHAN_TINH_TRANG[m.tinhTrang]}</span>
              {m.duongDan && (
                <Link href={m.duongDan} className="btn-ghost text-xs">
                  Mở
                </Link>
              )}
            </div>

            <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  Đã chạy được
                </div>
                {m.daCo?.length ? (
                  <ul className="space-y-1 text-sm">
                    {m.daCo.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="text-accent">✓</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Chưa có gì.</p>
                )}
              </div>

              <div>
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  Còn thiếu
                </div>
                {m.conThieu?.length ? (
                  <ul className="space-y-1 text-sm text-muted">
                    {m.conThieu.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span>·</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Không còn gì đáng kể.</p>
                )}
              </div>
            </div>

            {m.choGi && (
              <p className="border-t border-line bg-paper px-4 py-2 text-sm">
                <strong>Đang chờ:</strong> {m.choGi}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
