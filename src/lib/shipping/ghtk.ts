import type { Order, OrderItem, Store, TrangThaiDon, VariantFull } from "@/lib/sales/types";

/**
 * Tích hợp Giao Hàng Tiết Kiệm (GHTK).
 *
 * Viết theo tài liệu công khai của GHTK. Bật bằng biến môi trường:
 *   GHTK_TOKEN     — API token trong GHTK → Cài đặt → API
 *   GHTK_BASE_URL  — tuỳ chọn, mặc định https://services.giaohangtietkiem.vn
 *
 * Mọi hàm ở đây CHỈ chạy phía server — token không bao giờ gửi xuống trình duyệt.
 */

const DEFAULT_BASE = "https://services.giaohangtietkiem.vn";
/** Khối lượng mặc định cho 1 sản phẩm chưa khai cân nặng (gram). */
const KHOI_LUONG_MAC_DINH = 300;

export function ghtkBaseUrl(): string {
  return (process.env.GHTK_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

export function ghtkDaCauHinh(): boolean {
  return Boolean(process.env.GHTK_TOKEN);
}

async function goiGhtk(
  duongDan: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; data: Record<string, unknown>; raw: string }> {
  const token = process.env.GHTK_TOKEN;
  if (!token) throw new Error("Chưa cấu hình GHTK_TOKEN");

  const res = await fetch(`${ghtkBaseUrl()}${duongDan}`, {
    ...init,
    headers: {
      Token: token,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // GHTK trả HTML khi token sai hoặc endpoint đổi — giữ nguyên body để hiện lỗi thật
  }

  return { ok: res.ok && data.success !== false, data, raw };
}

/** Gọi thử API phí ship để xác nhận token dùng được. */
export async function ghtkKiemTra(): Promise<{ ok: boolean; message: string }> {
  if (!ghtkDaCauHinh()) {
    return { ok: false, message: "Chưa đặt biến môi trường GHTK_TOKEN" };
  }

  try {
    const params = new URLSearchParams({
      pick_province: "TP. Hồ Chí Minh",
      pick_district: "Quận 1",
      province: "Hà Nội",
      district: "Quận Cầu Giấy",
      weight: "500",
      value: "1000000",
      deliver_option: "xteam",
    });
    const { ok, data, raw } = await goiGhtk(`/services/shipment/fee?${params}`);

    if (!ok) {
      return {
        ok: false,
        message: String(data.message ?? raw.slice(0, 300) ?? "GHTK từ chối yêu cầu"),
      };
    }
    const fee = (data.fee as { fee?: number } | undefined)?.fee;
    return {
      ok: true,
      message: `Kết nối GHTK OK. Phí thử tuyến HCM→HN 500g: ${fee ? fee.toLocaleString("vi-VN") + " đ" : "—"}`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export type TaoVanDonKetQua = {
  ma_van_don: string;
  phi_ship: number;
  du_kien_giao: string | null;
};

/**
 * Đẩy 1 đơn sang GHTK. `pick_*` lấy từ cửa hàng xuất hàng, nên cửa hàng phải khai
 * đủ địa chỉ trong Cài đặt; đơn phải có tỉnh/quận của người nhận.
 */
export async function ghtkTaoVanDon(
  order: Order,
  items: OrderItem[],
  store: Store,
  variants: Map<string, VariantFull>,
): Promise<TaoVanDonKetQua> {
  const thieu: string[] = [];
  if (!order.khach_ten) thieu.push("tên khách");
  if (!order.khach_sdt) thieu.push("SĐT khách");
  if (!order.dia_chi) thieu.push("địa chỉ");
  if (!order.tinh) thieu.push("tỉnh/thành của khách");
  if (!order.quan) thieu.push("quận/huyện của khách");
  if (!store.dia_chi) thieu.push("địa chỉ cửa hàng (Cài đặt → Cửa hàng)");
  if (!store.sdt) thieu.push("SĐT cửa hàng (Cài đặt → Cửa hàng)");
  if (thieu.length) throw new Error(`Thiếu thông tin bắt buộc: ${thieu.join(", ")}`);

  const products = items.map((it) => {
    const v = it.variant_id ? variants.get(it.variant_id) : undefined;
    const gram = v?.khoi_luong_gram || KHOI_LUONG_MAC_DINH;
    return {
      name: it.ten_hien_thi ?? it.sku ?? "Sản phẩm",
      weight: (gram * it.so_luong) / 1000, // GHTK tính theo kg
      quantity: it.so_luong,
      product_code: it.sku ?? undefined,
    };
  });

  const body = {
    products,
    order: {
      id: order.ma_don,
      pick_name: `Aescentic — ${store.ten}`,
      pick_address: store.dia_chi,
      pick_province: store.tinh ?? "",
      pick_district: store.quan ?? "",
      pick_tel: store.sdt,
      name: order.khach_ten,
      address: order.dia_chi,
      province: order.tinh,
      district: order.quan,
      ward: order.phuong ?? "",
      hamlet: "Khác",
      tel: order.khach_sdt,
      note: order.ghi_chu ?? "",
      // Chỉ thu hộ khi đơn là COD
      pick_money: order.thanh_toan === "cod" ? order.tong_tien : 0,
      value: order.tam_tinh,
      transport: "road",
      is_freeship: order.phi_ship > 0 ? 0 : 1,
    },
  };

  const { ok, data, raw } = await goiGhtk("/services/shipment/order/?ver=1.5", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!ok) {
    throw new Error(String(data.message ?? raw.slice(0, 300) ?? "GHTK từ chối tạo vận đơn"));
  }

  const don = data.order as
    | { label?: string; label_id?: string; fee?: number; estimated_deliver_time?: string }
    | undefined;
  const label = don?.label ?? don?.label_id;
  if (!label) throw new Error(`GHTK không trả mã vận đơn. Phản hồi: ${raw.slice(0, 300)}`);

  return {
    ma_van_don: String(label),
    phi_ship: Number(don?.fee ?? 0),
    du_kien_giao: don?.estimated_deliver_time ?? null,
  };
}

/**
 * Bảng mã trạng thái GHTK → trạng thái đơn trong hệ thống.
 * Mã nào chưa biết thì giữ nguyên trạng thái hiện tại, chỉ lưu text để xem.
 */
const MAP_TRANG_THAI: Record<number, TrangThaiDon> = {
  [-1]: "huy",
  1: "da_xac_nhan",
  2: "da_xac_nhan",
  3: "dang_giao",
  4: "dang_giao",
  5: "hoan_thanh",
  6: "hoan_thanh",
  7: "huy",
  8: "dang_giao",
  9: "dang_giao",
  10: "dang_giao",
  11: "hoan",
  12: "dang_giao",
  13: "hoan",
  20: "hoan",
  21: "hoan",
  45: "hoan_thanh",
  49: "dang_giao",
  123: "dang_giao",
  127: "da_xac_nhan",
  128: "dang_giao",
};

export type TrangThaiVanDon = {
  ma_van_don: string;
  mo_ta: string;
  trang_thai_noi_bo: TrangThaiDon | null;
};

export async function ghtkTrangThai(maVanDon: string): Promise<TrangThaiVanDon> {
  const { ok, data, raw } = await goiGhtk(
    `/services/shipment/v2/${encodeURIComponent(maVanDon)}`,
  );

  if (!ok) {
    throw new Error(String(data.message ?? raw.slice(0, 200) ?? "Không tra được vận đơn"));
  }

  const don = data.order as { status?: number; status_text?: string } | undefined;
  const ma = Number(don?.status ?? NaN);

  return {
    ma_van_don: maVanDon,
    mo_ta: don?.status_text ?? (Number.isNaN(ma) ? "—" : `Mã ${ma}`),
    trang_thai_noi_bo: MAP_TRANG_THAI[ma] ?? null,
  };
}
