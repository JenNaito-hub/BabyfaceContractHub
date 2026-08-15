"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBackup,
  currentSummary,
  restoreBackup,
  wipeAll,
  type BackupSummary,
  type RestoreMode,
  type RestoreResult,
} from "@/lib/video/backup";
import { downloadBlob } from "@/lib/video/render";
import { PageHead, formatBytes, useToast } from "./ui";

export default function BackupClient() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const reload = () => void currentSummary().then(setSummary);
  useEffect(reload, []);

  const doExport = async () => {
    setBusy("export");
    setProgress({ done: 0, total: summary?.assets ?? 0 });
    try {
      const blob = await createBackup(includeMedia, (done, total) =>
        setProgress({ done, total }),
      );
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadBlob(blob, `babyface-video-backup-${stamp}.zip`);
      toast.show(`Đã tạo file sao lưu (${formatBytes(blob.size)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sao lưu thất bại");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const doRestore = async (file: File) => {
    if (
      mode === "replace" &&
      !confirm(
        "Chế độ THAY THẾ sẽ xoá sạch dữ liệu hiện có trước khi khôi phục. Chắc chắn chứ?",
      )
    ) {
      return;
    }
    setBusy("restore");
    setResult(null);
    setProgress({ done: 0, total: 1 });
    try {
      const res = await restoreBackup(file, mode, (done, total) =>
        setProgress({ done, total }),
      );
      setResult(res);
      reload();
      toast.show("Khôi phục xong");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Khôi phục thất bại");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const doWipe = async () => {
    if (!confirm("Xoá sạch toàn bộ dữ liệu Video Studio trên trình duyệt này?")) return;
    if (!confirm("Không thể hoàn tác. Đã sao lưu chưa?")) return;
    setBusy("wipe");
    try {
      await wipeAll();
      reload();
      toast.show("Đã xoá sạch dữ liệu");
    } finally {
      setBusy(null);
    }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <PageHead
        title="Sao lưu &amp; khôi phục"
        desc="Dữ liệu Video Studio nằm trong trình duyệt này. Xoá cache, đổi máy hay đổi trình duyệt là mất — hãy xuất file sao lưu định kỳ."
      />

      <div className="mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-dark/75">
        <strong className="font-semibold">Lưu ý:</strong> trình duyệt có thể tự dọn dữ liệu khi
        máy hết dung lượng. File <code className="rounded bg-dark/8 px-1">.zip</code> tải về là
        bản sao duy nhất nằm ngoài trình duyệt.
      </div>

      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Media" value={summary.assets} sub={formatBytes(summary.mediaBytes)} />
          <Stat label="Project" value={summary.projects} />
          <Stat label="Talent" value={summary.talents} />
          <Stat label="Dự án SX" value={summary.productions} />
          <Stat label="Kịch bản" value={summary.scripts} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Xuất */}
        <section className="card">
          <h2 className="font-display text-base font-bold">Xuất bản sao lưu</h2>
          <p className="mt-1 text-sm text-dark/60">
            Gói toàn bộ project, talent, dự án sản xuất và kịch bản thành một file .zip.
          </p>

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Kèm file media</span>
              <span className="block text-xs text-dark/55">
                {includeMedia
                  ? `File sẽ nặng khoảng ${formatBytes(summary?.mediaBytes ?? 0)}. Khôi phục là dùng được ngay.`
                  : "File rất nhẹ, nhưng khôi phục xong các clip sẽ thiếu hình — chỉ hợp để chuyển cấu trúc dự án."}
              </span>
            </span>
          </label>

          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={busy !== null}
            onClick={() => void doExport()}
          >
            {busy === "export" ? "Đang đóng gói…" : "Tải file sao lưu"}
          </button>

          {busy === "export" && progress && progress.total > 0 && (
            <Progress pct={pct} label={`Đang gói media ${progress.done}/${progress.total}`} />
          )}
        </section>

        {/* Khôi phục */}
        <section className="card">
          <h2 className="font-display text-base font-bold">Khôi phục từ file</h2>
          <p className="mt-1 text-sm text-dark/60">
            Chọn file .zip đã xuất trước đó. Dùng được để chuyển dữ liệu sang máy khác.
          </p>

          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              <span>
                <span className="font-semibold">Gộp vào dữ liệu hiện có</span>
                <span className="block text-xs text-dark/55">
                  Giữ nguyên những gì đang có. Trùng ID thì bản trong file ghi đè.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              <span>
                <span className="font-semibold text-warning">Thay thế toàn bộ</span>
                <span className="block text-xs text-dark/55">
                  Xoá sạch rồi mới khôi phục. Dùng khi muốn máy này giống hệt bản sao lưu.
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            className="btn-dark mt-4 w-full"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
          >
            {busy === "restore" ? "Đang khôi phục…" : "Chọn file .zip"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void doRestore(f);
            }}
          />

          {busy === "restore" && progress && (
            <Progress pct={pct} label={`Đang ghi ${progress.done}/${progress.total}`} />
          )}

          {result && (
            <div className="mt-3 rounded-lg bg-lime/25 px-3 py-2 text-sm">
              <p className="font-semibold">
                Đã khôi phục ({result.mode === "replace" ? "thay thế" : "gộp"})
              </p>
              <p className="text-dark/70">
                {result.assets} media · {result.projects} project · {result.talents} talent ·{" "}
                {result.productions} dự án SX · {result.scripts} kịch bản
              </p>
              {!result.hadMedia && (
                <p className="mt-1 text-xs text-warning">
                  File này không kèm media — các clip sẽ báo thiếu file.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="card mt-4 border-warning/30">
        <h2 className="font-display text-base font-bold text-warning">Xoá sạch dữ liệu</h2>
        <p className="mt-1 text-sm text-dark/60">
          Xoá toàn bộ media, project, talent, dự án và kịch bản trên trình duyệt này. Không hoàn
          tác được — xuất sao lưu trước.
        </p>
        <button
          type="button"
          className="btn-danger mt-3"
          disabled={busy !== null}
          onClick={() => void doWipe()}
        >
          {busy === "wipe" ? "Đang xoá…" : "Xoá sạch"}
        </button>
      </section>

      {toast.node}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-dark/50">{label}</p>
      <p className="font-display text-xl font-extrabold">{value}</p>
      {sub && <p className="text-[11px] text-dark/45">{sub}</p>}
    </div>
  );
}

function Progress({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-dark/10">
        <div className="h-full rounded-full bg-lime transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-dark/55">{label}</p>
    </div>
  );
}
