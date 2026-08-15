/**
 * Lớp trừu tượng cho hệ POS. Code riêng của Nhanh.vn KHÔNG được rò ra ngoài
 * package này — module nghiệp vụ chỉ thấy interface.
 */

export type PosStore = {
  externalId: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
};

export type PosProduct = {
  externalId: string;
  code: string;
  name: string;
  categoryName?: string | null;
};

export type PosSku = {
  externalId: string;
  productExternalId: string;
  code: string;
  name?: string | null;
  barcode?: string | null;
  retailPrice: number;
  weightGram?: number | null;
};

export type PosInventoryLevel = {
  skuExternalId: string;
  storeExternalId: string;
  quantity: number;
};

export type PosOrderLine = {
  skuExternalId: string;
  skuCode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type PosOrder = {
  externalId: string;
  code: string;
  storeExternalId: string;
  employeeExternalId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  status: "pending" | "confirmed" | "shipping" | "completed" | "cancelled" | "returned";
  paymentStatus: "unpaid" | "cod" | "paid";
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  placedAt: string;
  lines: PosOrderLine[];
};

export type PosCustomer = {
  externalId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

/** Kết quả một lượt đồng bộ. `cursor` để lần sau chạy tiếp, không quét lại từ đầu. */
export type SyncPage<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
};

export interface POSProvider {
  readonly name: string;
  /** Kiểm tra credential dùng được không, trước khi chạy đồng bộ thật. */
  kiemTraKetNoi(): Promise<{ ok: boolean; message: string }>;
  layCuaHang(): Promise<PosStore[]>;
  laySanPham(cursor: string | null): Promise<SyncPage<PosProduct>>;
  laySku(cursor: string | null): Promise<SyncPage<PosSku>>;
  layTonKho(cursor: string | null): Promise<SyncPage<PosInventoryLevel>>;
  layDonHang(tuNgay: Date, cursor: string | null): Promise<SyncPage<PosOrder>>;
  layKhachHang(cursor: string | null): Promise<SyncPage<PosCustomer>>;
}

export class ThieuCredentialError extends Error {
  constructor(
    readonly provider: string,
    readonly bienMoiTruong: string[],
  ) {
    super(
      `Chưa cấu hình ${provider}. Cần biến môi trường: ${bienMoiTruong.join(", ")}. ` +
        `Xem docs/integrations/credentials-needed.md`,
    );
    this.name = "ThieuCredentialError";
  }
}
