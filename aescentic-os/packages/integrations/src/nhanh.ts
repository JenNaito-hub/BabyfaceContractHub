import {
  ThieuCredentialError,
  type POSProvider,
  type PosCustomer,
  type PosInventoryLevel,
  type PosOrder,
  type PosProduct,
  type PosSku,
  type PosStore,
  type SyncPage,
} from "./pos.ts";

/**
 * Adapter Nhanh.vn.
 *
 * TRẠNG THÁI: khung đã dựng, CHƯA chạy với credential thật. Phần ánh xạ trường
 * dưới đây viết theo tài liệu công khai của Nhanh.vn và phải được đối chiếu lại
 * với phản hồi thật ngay khi có token — xem `docs/integrations/credentials-needed.md`.
 *
 * Không dùng adapter này khi chưa kiểm tra kết nối thành công. Ở chế độ chưa có
 * credential, `taoPosProvider()` trả về MockPosProvider.
 */
export class NhanhProvider implements POSProvider {
  readonly name = "nhanh";
  private readonly baseUrl: string;

  constructor(
    private readonly appId: string,
    private readonly businessId: string,
    private readonly accessToken: string,
    baseUrl = process.env.NHANH_BASE_URL ?? "https://open.nhanh.vn",
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  static tuMoiTruong(): NhanhProvider {
    const thieu = ["NHANH_APP_ID", "NHANH_BUSINESS_ID", "NHANH_ACCESS_TOKEN"].filter(
      (k) => !process.env[k],
    );
    if (thieu.length) throw new ThieuCredentialError("Nhanh.vn", thieu);
    return new NhanhProvider(
      process.env.NHANH_APP_ID!,
      process.env.NHANH_BUSINESS_ID!,
      process.env.NHANH_ACCESS_TOKEN!,
    );
  }

  private async goi<T>(duongDan: string, data: Record<string, unknown>): Promise<T> {
    const body = new URLSearchParams({
      version: "2.0",
      appId: this.appId,
      businessId: this.businessId,
      accessToken: this.accessToken,
      data: JSON.stringify(data),
    });

    const res = await fetch(`${this.baseUrl}${duongDan}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const raw = await res.text();
    let json: { code?: number; messages?: unknown; data?: T };
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`Nhanh.vn trả về không phải JSON: ${raw.slice(0, 300)}`);
    }

    // Nhanh.vn dùng code 1 = thành công, không dùng HTTP status
    if (json.code !== 1) {
      throw new Error(
        `Nhanh.vn từ chối ${duongDan}: ${JSON.stringify(json.messages ?? raw.slice(0, 300))}`,
      );
    }
    return json.data as T;
  }

  async kiemTraKetNoi(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.goi("/api/store/depot", {});
      return { ok: true, message: "Kết nối Nhanh.vn OK" };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async layCuaHang(): Promise<PosStore[]> {
    const data = await this.goi<Record<string, NhanhDepot>>("/api/store/depot", {});
    return Object.values(data).map((d) => ({
      externalId: String(d.id),
      code: d.code ?? `NHANH-${d.id}`,
      name: d.name,
      address: d.address ?? null,
      phone: d.phone ?? null,
    }));
  }

  async laySanPham(cursor: string | null): Promise<SyncPage<PosProduct>> {
    const page = cursor ? Number(cursor) : 1;
    const data = await this.goi<NhanhPaged<NhanhProduct>>("/api/product/search", {
      page,
      icpp: 100,
    });
    const items = Object.values(data.products ?? {}).map((p) => ({
      externalId: String(p.idNhanh),
      code: p.code,
      name: p.name,
      categoryName: p.categoryName ?? null,
    }));
    return this.trang(items, page, data.totalPages);
  }

  async laySku(cursor: string | null): Promise<SyncPage<PosSku>> {
    const page = cursor ? Number(cursor) : 1;
    const data = await this.goi<NhanhPaged<NhanhProduct>>("/api/product/search", {
      page,
      icpp: 100,
    });
    const items = Object.values(data.products ?? {}).map((p) => ({
      externalId: String(p.idNhanh),
      productExternalId: String(p.parentId ?? p.idNhanh),
      code: p.code,
      name: p.name,
      barcode: p.barcode ?? null,
      retailPrice: Math.round(Number(p.price ?? 0)),
      weightGram: p.shippingWeight ? Math.round(Number(p.shippingWeight)) : null,
    }));
    return this.trang(items, page, data.totalPages);
  }

  async layTonKho(cursor: string | null): Promise<SyncPage<PosInventoryLevel>> {
    const page = cursor ? Number(cursor) : 1;
    const data = await this.goi<NhanhPaged<NhanhProduct>>("/api/product/search", {
      page,
      icpp: 100,
    });
    const items: PosInventoryLevel[] = [];
    for (const p of Object.values(data.products ?? {})) {
      for (const [depotId, tk] of Object.entries(p.depots ?? {})) {
        items.push({
          skuExternalId: String(p.idNhanh),
          storeExternalId: String(depotId),
          quantity: Number(tk.available ?? 0),
        });
      }
    }
    return this.trang(items, page, data.totalPages);
  }

  async layDonHang(tuNgay: Date, cursor: string | null): Promise<SyncPage<PosOrder>> {
    const page = cursor ? Number(cursor) : 1;
    const data = await this.goi<NhanhPaged<NhanhOrder>>("/api/order/index", {
      page,
      icpp: 100,
      fromDate: tuNgay.toISOString().slice(0, 10),
    });
    const items = Object.values(data.orders ?? {}).map((o) => ({
      externalId: String(o.id),
      code: o.id ? String(o.id) : "",
      storeExternalId: String(o.depotId ?? ""),
      employeeExternalId: o.saleId ? String(o.saleId) : null,
      customerPhone: o.customerMobile ?? null,
      customerName: o.customerName ?? null,
      status: mapTrangThai(o.statusCode),
      paymentStatus: mapThanhToan(o),
      subtotal: Math.round(Number(o.moneyTransfer ?? 0) + Number(o.moneyDiscount ?? 0)),
      discount: Math.round(Number(o.moneyDiscount ?? 0)),
      shippingFee: Math.round(Number(o.customerShipFee ?? 0)),
      total: Math.round(Number(o.calcTotalMoney ?? 0)),
      placedAt: o.createdDateTime ?? new Date().toISOString(),
      lines: Object.values(o.products ?? {}).map((l) => ({
        skuExternalId: String(l.productId),
        skuCode: l.productCode ?? "",
        name: l.productName ?? "",
        quantity: Number(l.quantity ?? 0),
        unitPrice: Math.round(Number(l.price ?? 0)),
        discount: Math.round(Number(l.discount ?? 0)),
      })),
    }));
    return this.trang(items, page, data.totalPages);
  }

  async layKhachHang(cursor: string | null): Promise<SyncPage<PosCustomer>> {
    const page = cursor ? Number(cursor) : 1;
    const data = await this.goi<NhanhPaged<NhanhCustomer>>("/api/customer/search", {
      page,
      icpp: 100,
    });
    const items = Object.values(data.customers ?? {}).map((c) => ({
      externalId: String(c.id),
      name: c.name,
      phone: c.mobile ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
    }));
    return this.trang(items, page, data.totalPages);
  }

  private trang<T>(items: T[], page: number, totalPages?: number): SyncPage<T> {
    const conNua = totalPages !== undefined && page < totalPages;
    return { items, cursor: conNua ? String(page + 1) : null, hasMore: conNua };
  }
}

// Nhanh.vn dùng mã trạng thái riêng; bảng này phải đối chiếu lại khi có tài khoản thật.
function mapTrangThai(code?: string): PosOrder["status"] {
  switch ((code ?? "").toLowerCase()) {
    case "success":
    case "hoanthanh":
      return "completed";
    case "canceled":
    case "aborted":
      return "cancelled";
    case "returned":
    case "returning":
      return "returned";
    case "shipping":
    case "packing":
      return "shipping";
    case "confirming":
    case "confirmed":
      return "confirmed";
    default:
      return "pending";
  }
}

function mapThanhToan(o: NhanhOrder): PosOrder["paymentStatus"] {
  if (Number(o.moneyTransfer ?? 0) > 0) return "paid";
  if (Number(o.calcTotalMoney ?? 0) > 0) return "cod";
  return "unpaid";
}

type NhanhPaged<T> = {
  totalPages?: number;
  products?: Record<string, T>;
  orders?: Record<string, T>;
  customers?: Record<string, T>;
};
type NhanhDepot = { id: number; code?: string; name: string; address?: string; phone?: string };
type NhanhProduct = {
  idNhanh: number;
  parentId?: number;
  code: string;
  name: string;
  barcode?: string;
  price?: number;
  shippingWeight?: number;
  categoryName?: string;
  depots?: Record<string, { available?: number }>;
};
type NhanhOrder = {
  id: number;
  depotId?: number;
  saleId?: number;
  customerName?: string;
  customerMobile?: string;
  statusCode?: string;
  moneyTransfer?: number;
  moneyDiscount?: number;
  customerShipFee?: number;
  calcTotalMoney?: number;
  createdDateTime?: string;
  products?: Record<
    string,
    { productId: number; productCode?: string; productName?: string; quantity?: number; price?: number; discount?: number }
  >;
};
type NhanhCustomer = {
  id: number;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
};
