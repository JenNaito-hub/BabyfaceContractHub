"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import type { Talent } from "@/lib/types";

type FormState = {
  ho_ten: string;
  gioi_tinh: string;
  phan_loai: string;
  chieu_cao: string;
  can_nang: string;
  so_do: string;
  facebook: string;
  instagram: string;
  ghi_chu: string;
  sdt: string;
  email: string;
  ghi_chu_lien_he: string;
};

const EMPTY: FormState = {
  ho_ten: "",
  gioi_tinh: "",
  phan_loai: "",
  chieu_cao: "",
  can_nang: "",
  so_do: "",
  facebook: "",
  instagram: "",
  ghi_chu: "",
  sdt: "",
  email: "",
  ghi_chu_lien_he: "",
};

export default function TalentModal({
  talent,
  isManager,
  currentUserId,
  onClose,
  onSaved,
}: {
  talent: Talent | null;
  isManager: boolean;
  currentUserId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!talent;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!talent) {
        setForm(EMPTY);
        return;
      }
      setForm({
        ho_ten: talent.ho_ten ?? "",
        gioi_tinh: talent.gioi_tinh ?? "",
        phan_loai: talent.phan_loai ?? "",
        chieu_cao: talent.chieu_cao ?? "",
        can_nang: talent.can_nang ?? "",
        so_do: talent.so_do ?? "",
        facebook: talent.facebook ?? "",
        instagram: talent.instagram ?? "",
        ghi_chu: talent.ghi_chu ?? "",
        sdt: "",
        email: "",
        ghi_chu_lien_he: "",
      });
      // Manager: nạp sẵn thông tin liên hệ để sửa
      if (isManager) {
        const supabase = createClient();
        const { data } = await supabase
          .from("talent_contacts")
          .select("sdt, email, ghi_chu_lien_he")
          .eq("talent_id", talent.id)
          .maybeSingle();
        if (data) {
          setForm((f) => ({
            ...f,
            sdt: (data.sdt as string) ?? "",
            email: (data.email as string) ?? "",
            ghi_chu_lien_he: (data.ghi_chu_lien_he as string) ?? "",
          }));
        }
      }
    }
    load();
  }, [talent, isManager]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function checkDuplicatePhone() {
    if (!isManager || !form.sdt.trim()) {
      setDupWarn(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("talent_contacts")
      .select("talent_id")
      .eq("sdt", form.sdt.trim());
    const others = (data ?? []).filter((r) => r.talent_id !== talent?.id);
    setDupWarn(
      others.length > 0
        ? `⚠ SĐT này đã tồn tại ở ${others.length} talent khác — kiểm tra trùng lặp.`
        : null,
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ho_ten.trim()) {
      setError("Họ tên là bắt buộc.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const talentPayload = {
      ho_ten: form.ho_ten.trim(),
      gioi_tinh: form.gioi_tinh.trim() || null,
      phan_loai: form.phan_loai.trim() || null,
      chieu_cao: form.chieu_cao.trim() || null,
      can_nang: form.can_nang.trim() || null,
      so_do: form.so_do.trim() || null,
      facebook: form.facebook.trim() || null,
      instagram: form.instagram.trim() || null,
      ghi_chu: form.ghi_chu.trim() || null,
    };

    let talentId = talent?.id ?? null;

    if (isEdit) {
      const { error } = await supabase.from("talents").update(talentPayload).eq("id", talent!.id);
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("talents")
        .insert({ ...talentPayload, created_by: currentUserId })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
      talentId = data.id as string;
    }

    // Ghi thông tin liên hệ (chỉ manager có quyền theo RLS)
    if (isManager && talentId && (form.sdt || form.email || form.ghi_chu_lien_he)) {
      const { error } = await supabase.from("talent_contacts").upsert({
        talent_id: talentId,
        sdt: form.sdt.trim() || null,
        email: form.email.trim() || null,
        ghi_chu_lien_he: form.ghi_chu_lien_he.trim() || null,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        setSaving(false);
        setError("Lưu talent OK nhưng lỗi thông tin liên hệ: " + error.message);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={isEdit ? "Sửa talent" : "Thêm talent"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} type="button">
            Huỷ
          </button>
          <button className="btn-primary" form="talent-form" type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      <form id="talent-form" onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Họ tên *</label>
          <input className="input" value={form.ho_ten} onChange={(e) => set("ho_ten", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Giới tính</label>
            <input className="input" value={form.gioi_tinh} onChange={(e) => set("gioi_tinh", e.target.value)} />
          </div>
          <div>
            <label className="label">Phân loại</label>
            <input className="input" value={form.phan_loai} onChange={(e) => set("phan_loai", e.target.value)} placeholder="Model, KOL, diễn viên…" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Chiều cao</label>
            <input className="input" value={form.chieu_cao} onChange={(e) => set("chieu_cao", e.target.value)} />
          </div>
          <div>
            <label className="label">Cân nặng</label>
            <input className="input" value={form.can_nang} onChange={(e) => set("can_nang", e.target.value)} />
          </div>
          <div>
            <label className="label">Số đo</label>
            <input className="input" value={form.so_do} onChange={(e) => set("so_do", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Facebook</label>
            <input className="input" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input className="input" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Ghi chú</label>
          <textarea className="input" rows={2} value={form.ghi_chu} onChange={(e) => set("ghi_chu", e.target.value)} />
        </div>

        {isManager ? (
          <div className="rounded-xl border border-dark/10 bg-dark/[0.02] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dark/50">
              Thông tin liên hệ (nhạy cảm — chỉ manager)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Số điện thoại</label>
                <input
                  className="input"
                  value={form.sdt}
                  onChange={(e) => set("sdt", e.target.value)}
                  onBlur={checkDuplicatePhone}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Ghi chú liên hệ</label>
              <input
                className="input"
                value={form.ghi_chu_lien_he}
                onChange={(e) => set("ghi_chu_lien_he", e.target.value)}
              />
            </div>
            {dupWarn && <p className="mt-2 text-sm text-warning">{dupWarn}</p>}
          </div>
        ) : (
          <p className="rounded-lg bg-dark/5 px-3 py-2 text-xs text-dark/50">
            SĐT &amp; liên hệ do manager quản lý. Talent bạn tạo sẽ ở trạng thái <b>chờ duyệt</b>.
          </p>
        )}

        {error && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p>}
      </form>
    </Modal>
  );
}
