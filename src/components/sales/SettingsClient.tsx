"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Empty } from "@/components/sales/Bits";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";
import type { Store } from "@/lib/sales/types";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin — toàn quyền",
  manager: "Quản lý — xem giá vốn, nhập/chuyển kho",
  staff: "Nhân viên — bán hàng, không thấy giá vốn",
};

export default function SettingsClient({
  stores,
  profiles,
  isAdmin,
}: {
  stores: Store[];
  profiles: Profile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Store> | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  async function luuStore() {
    if (!form?.ma?.trim() || !form.ten?.trim()) {
      setLoi("Cần có mã và tên cửa hàng");
      return;
    }
    setDangLuu(true);
    setLoi(null);
    const supabase = createClient();
    const payload = {
      ma: form.ma.trim().toUpperCase(),
      ten: form.ten.trim(),
      loai: form.loai ?? "store",
      dia_chi: form.dia_chi || null,
      sdt: form.sdt || null,
      active: form.active ?? true,
    };
    const { error } = form.id
      ? await supabase.from("stores").update(payload).eq("id", form.id)
      : await supabase.from("stores").insert(payload);
    setDangLuu(false);
    if (error) return setLoi(error.message);
    setForm(null);
    router.refresh();
  }

  async function suaNhanVien(id: string, patch: Partial<Profile>) {
    setLoi(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return setLoi(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Cài đặt</h1>
        <p className="text-sm text-dark/60">Cửa hàng, kho và phân quyền nhân viên.</p>
      </div>

      {loi && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{loi}</p>}

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-extrabold">Cửa hàng & kho</h2>
          <button
            className="btn-primary"
            onClick={() => setForm({ ma: "", ten: "", loai: "store", active: true })}
          >
            + Thêm
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-dark/10">
                <th className="th">Mã</th>
                <th className="th">Tên</th>
                <th className="th">Loại</th>
                <th className="th">Địa chỉ</th>
                <th className="th">Trạng thái</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-dark/5">
                  <td className="td font-mono text-xs">{s.ma}</td>
                  <td className="td font-medium">{s.ten}</td>
                  <td className="td text-dark/70">
                    {s.loai === "warehouse" ? "Kho" : "Cửa hàng"}
                  </td>
                  <td className="td max-w-[220px] truncate text-dark/60">{s.dia_chi ?? "—"}</td>
                  <td className="td">
                    <span className={`badge ${s.active ? "bg-lime text-dark" : "bg-dark/10 text-dark/50"}`}>
                      {s.active ? "Hoạt động" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setForm(s)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-display font-extrabold">Nhân viên</h2>
        <p className="mb-3 text-xs text-dark/50">
          Tài khoản được tạo trong Supabase → Authentication → Users. Ở đây chỉ gán quyền và cửa
          hàng.
          {!isAdmin && " Chỉ admin mới đổi được quyền."}
        </p>

        {profiles.length === 0 ? (
          <Empty>Chưa có tài khoản nào</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-dark/10">
                  <th className="th">Tên</th>
                  <th className="th">Email</th>
                  <th className="th">Quyền</th>
                  <th className="th">Cửa hàng</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-dark/5">
                    <td className="td font-medium">{p.full_name || "—"}</td>
                    <td className="td text-dark/60">{p.email ?? "—"}</td>
                    <td className="td">
                      <select
                        className="input w-auto py-1 text-xs"
                        value={p.role}
                        disabled={!isAdmin}
                        onChange={(e) => suaNhanVien(p.id, { role: e.target.value as UserRole })}
                      >
                        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="td">
                      <select
                        className="input w-auto py-1 text-xs"
                        value={p.store_id ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) =>
                          suaNhanVien(p.id, { store_id: e.target.value || null })
                        }
                      >
                        <option value="">— không gán —</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.ten}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 font-display font-extrabold">Kết nối website</h2>
        <p className="text-sm text-dark/60">
          Website Aescentic có thể đẩy đơn thẳng vào hệ thống bằng cách gọi:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-dark p-3 text-xs text-paper">
{`POST /api/orders/webhook
x-webhook-secret: <ORDER_WEBHOOK_SECRET>

{
  "ma_don_san": "WEB-1234",
  "khach_ten": "Nguyễn A",
  "khach_sdt": "0901234567",
  "dia_chi": "…",
  "phi_ship": 30000,
  "items": [{ "sku": "AMB-50", "so_luong": 1, "don_gia": 890000 }]
}`}
        </pre>
        <p className="mt-2 text-xs text-dark/50">
          Đặt biến môi trường <code>ORDER_WEBHOOK_SECRET</code> và{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> trên Vercel để bật endpoint này.
        </p>
      </div>

      {form && (
        <Modal
          title={form.id ? "Sửa cửa hàng" : "Thêm cửa hàng"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setForm(null)}>
                Huỷ
              </button>
              <button className="btn-primary" onClick={luuStore} disabled={dangLuu}>
                Lưu
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Mã *</label>
              <input
                className="input font-mono"
                value={form.ma ?? ""}
                onChange={(e) => setForm({ ...form, ma: e.target.value })}
                placeholder="S1"
              />
            </div>
            <div>
              <label className="label">Loại</label>
              <select
                className="input"
                value={form.loai ?? "store"}
                onChange={(e) =>
                  setForm({ ...form, loai: e.target.value as Store["loai"] })
                }
              >
                <option value="store">Cửa hàng</option>
                <option value="warehouse">Kho</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tên *</label>
              <input
                className="input"
                value={form.ten ?? ""}
                onChange={(e) => setForm({ ...form, ten: e.target.value })}
                placeholder="Aescentic Nguyễn Huệ"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Địa chỉ</label>
              <input
                className="input"
                value={form.dia_chi ?? ""}
                onChange={(e) => setForm({ ...form, dia_chi: e.target.value })}
              />
            </div>
            <div>
              <label className="label">SĐT</label>
              <input
                className="input"
                value={form.sdt ?? ""}
                onChange={(e) => setForm({ ...form, sdt: e.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Đang hoạt động
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
