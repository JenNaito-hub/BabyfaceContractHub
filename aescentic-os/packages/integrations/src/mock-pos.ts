import type {
  POSProvider,
  PosCustomer,
  PosInventoryLevel,
  PosOrder,
  PosProduct,
  PosSku,
  PosStore,
  SyncPage,
} from "./pos.ts";

/**
 * POS giả lập, dùng khi chưa có credential Nhanh.vn.
 *
 * Đây KHÔNG phải code giả vờ đã tích hợp: nó sinh dữ liệu tất định, có phân
 * trang thật, để toàn bộ luồng đồng bộ (con trỏ, idempotent, xử lý lỗi) chạy
 * và test được. Admin health phải hiển thị rõ hệ thống đang ở chế độ mock.
 */
export class MockPosProvider implements POSProvider {
  readonly name = "mock-pos";

  constructor(
    private readonly quyMo = { stores: 6, products: 30, orders: 120, customers: 200 },
  ) {}

  async kiemTraKetNoi() {
    return {
      ok: true,
      message: "Đang chạy POS giả lập — chưa nối Nhanh.vn thật. Cần NHANH_ACCESS_TOKEN.",
    };
  }

  async layCuaHang(): Promise<PosStore[]> {
    return Array.from({ length: this.quyMo.stores }, (_, i) => ({
      externalId: `depot-${i + 1}`,
      code: i === 0 ? "KHO-TT" : `CH-${i}`,
      name: i === 0 ? "Kho trung tâm" : `Aescentic cửa hàng ${i}`,
      address: `Số ${10 + i} đường Mẫu`,
      phone: `028390000${i}`,
    }));
  }

  async laySanPham(cursor: string | null): Promise<SyncPage<PosProduct>> {
    const all = Array.from({ length: this.quyMo.products }, (_, i) => ({
      externalId: `prod-${i + 1}`,
      code: `AES-${String(i + 1).padStart(3, "0")}`,
      name: `Nước hoa mẫu ${i + 1}`,
      categoryName: i % 3 === 0 ? "Eau de Parfum" : "Eau de Toilette",
    }));
    return phanTrang(all, cursor, 10);
  }

  async laySku(cursor: string | null): Promise<SyncPage<PosSku>> {
    const all: PosSku[] = [];
    for (let i = 1; i <= this.quyMo.products; i++) {
      for (const ml of [50, 100]) {
        all.push({
          externalId: `sku-${i}-${ml}`,
          productExternalId: `prod-${i}`,
          code: `AES-${String(i).padStart(3, "0")}-${ml}`,
          name: `Nước hoa mẫu ${i} ${ml}ml`,
          barcode: `893${String(i * ml).padStart(9, "0")}`,
          retailPrice: ml === 50 ? 1_290_000 : 1_950_000,
          weightGram: ml === 50 ? 320 : 540,
        });
      }
    }
    return phanTrang(all, cursor, 20);
  }

  async layTonKho(cursor: string | null): Promise<SyncPage<PosInventoryLevel>> {
    const all: PosInventoryLevel[] = [];
    for (let i = 1; i <= this.quyMo.products; i++) {
      for (const ml of [50, 100]) {
        for (let s = 1; s <= this.quyMo.stores; s++) {
          all.push({
            skuExternalId: `sku-${i}-${ml}`,
            storeExternalId: `depot-${s}`,
            quantity: ((i * ml * s) % 40) + 5,
          });
        }
      }
    }
    return phanTrang(all, cursor, 100);
  }

  async layDonHang(tuNgay: Date, cursor: string | null): Promise<SyncPage<PosOrder>> {
    const moc = tuNgay.getTime();
    const all: PosOrder[] = Array.from({ length: this.quyMo.orders }, (_, i) => {
      const sl = (i % 3) + 1;
      const gia = i % 2 === 0 ? 1_290_000 : 1_950_000;
      const tienHang = gia * sl;
      const giam = i % 5 === 0 ? 50_000 : 0;
      return {
        externalId: `order-${i + 1}`,
        code: `NH${String(i + 1).padStart(6, "0")}`,
        storeExternalId: `depot-${(i % this.quyMo.stores) + 1}`,
        employeeExternalId: `emp-${(i % 15) + 1}`,
        customerPhone: `090${String(1000000 + (i % this.quyMo.customers)).slice(0, 7)}`,
        customerName: `Khách mẫu ${(i % this.quyMo.customers) + 1}`,
        status: i % 11 === 0 ? "cancelled" : "completed",
        paymentStatus: i % 3 === 0 ? "cod" : "paid",
        subtotal: tienHang,
        discount: giam,
        shippingFee: 0,
        total: tienHang - giam,
        placedAt: new Date(moc + i * 3_600_000).toISOString(),
        lines: [
          {
            skuExternalId: `sku-${(i % this.quyMo.products) + 1}-${i % 2 === 0 ? 50 : 100}`,
            skuCode: `AES-${String((i % this.quyMo.products) + 1).padStart(3, "0")}-${i % 2 === 0 ? 50 : 100}`,
            name: `Nước hoa mẫu ${(i % this.quyMo.products) + 1}`,
            quantity: sl,
            unitPrice: gia,
            discount: giam,
          },
        ],
      };
    });
    return phanTrang(all, cursor, 25);
  }

  async layKhachHang(cursor: string | null): Promise<SyncPage<PosCustomer>> {
    const all = Array.from({ length: this.quyMo.customers }, (_, i) => ({
      externalId: `cust-${i + 1}`,
      name: `Khách mẫu ${i + 1}`,
      phone: `090${String(1000000 + i).slice(0, 7)}`,
      email: null,
      address: `Số ${i + 1} đường Mẫu`,
    }));
    return phanTrang(all, cursor, 50);
  }
}

function phanTrang<T>(all: T[], cursor: string | null, size: number): SyncPage<T> {
  const offset = cursor ? Number(cursor) : 0;
  const items = all.slice(offset, offset + size);
  const tiep = offset + size;
  const conNua = tiep < all.length;
  return { items, cursor: conNua ? String(tiep) : null, hasMore: conNua };
}
