/**
 * Cấu trúc menu chính của AESCENTIC OS.
 *
 * 20 module là kiến trúc phía sau. Người dùng KHÔNG được cảm giác đang dùng 20
 * phần mềm, nên thanh menu chỉ có 6 nhóm + "Thêm". Mỗi mục khai quyền cần có;
 * `menuTheoQuyen()` lọc theo đúng quyền thật của người đăng nhập, nên Sales,
 * quản lý cửa hàng và CEO cùng một giao diện mà thấy khác nhau — không cần
 * dựng menu riêng cho từng vai trò.
 *
 * Chỉ liệt kê màn hình ĐÃ CHẠY ĐƯỢC. Module chưa dựng thì không có mặt ở đây:
 * một mục menu bấm vào không ra gì còn tệ hơn là chưa có mục đó.
 */
import { authorize, type Principal } from "@aescentic/permissions";

export type MucMenu = {
  href: string;
  nhan: string;
  /** Quyền cần có. `null` nghĩa là ai đăng nhập cũng vào được. */
  quyen: string | null;
  mo?: string;
};

export type NhomMenu = {
  ma: string;
  nhan: string;
  /** Nhóm nằm trong "Thêm" thay vì hiện thẳng trên thanh menu. */
  phu?: boolean;
  muc: MucMenu[];
};

export const MENU: NhomMenu[] = [
  {
    ma: "trang-chu",
    nhan: "Trang chủ",
    muc: [{ href: "/", nhan: "Tổng quan", quyen: null, mo: "Doanh thu, cảnh báo, việc cần làm" }],
  },
  {
    ma: "ban-hang",
    nhan: "Bán hàng",
    muc: [
      { href: "/pos", nhan: "Bán tại quầy", quyen: "order.create", mo: "Quét mã, chốt đơn, in hoá đơn" },
      { href: "/orders", nhan: "Đơn hàng", quyen: "order.read", mo: "Tìm, lọc, in phiếu giao hàng" },
      { href: "/orders/nhap", nhan: "Nhập đơn từ sàn", quyen: "order.create", mo: "Shopee, TikTok Shop" },
      { href: "/products", nhan: "Sản phẩm", quyen: "product.read", mo: "Danh mục, giá, tồn" },
    ],
  },
  {
    ma: "van-hanh",
    nhan: "Vận hành",
    muc: [
      { href: "/inventory", nhan: "Tồn kho", quyen: "inventory.read", mo: "Tồn theo địa điểm, sổ kho" },
      { href: "/inventory/phieu?kieu=nhap", nhan: "Nhập kho", quyen: "inventory.adjust", mo: "Nhập hàng, cập nhật giá vốn" },
      { href: "/inventory/phieu?kieu=chuyen", nhan: "Chuyển kho", quyen: "inventory.transfer", mo: "Điều chuyển giữa các kho" },
      { href: "/stores", nhan: "Cửa hàng", quyen: "store.read", mo: "Danh sách cửa hàng và kho" },
    ],
  },
  {
    ma: "khach-hang",
    nhan: "Khách hàng",
    muc: [
      { href: "/customers", nhan: "Danh sách khách", quyen: "customer.read", mo: "Lịch sử mua, chi tiêu" },
    ],
  },
  {
    ma: "tai-chinh",
    nhan: "Tài chính",
    muc: [
      { href: "/cod", nhan: "Đối soát COD", quyen: "cod.read", mo: "So tiền hãng vận chuyển trả về" },
    ],
  },
  {
    ma: "quan-tri",
    nhan: "Quản trị",
    phu: true,
    muc: [
      { href: "/admin/users", nhan: "Người dùng", quyen: "user.manage", mo: "Tài khoản và vai trò" },
      { href: "/admin/roles", nhan: "Phân quyền", quyen: "role.manage", mo: "93 quyền, 18 vai trò" },
      { href: "/he-thong", nhan: "Bản đồ hệ thống", quyen: null, mo: "20 module và tình trạng từng phần" },
    ],
  },
];

/** Lọc menu theo quyền thật. Nhóm không còn mục nào thì biến mất luôn. */
export function menuTheoQuyen(principal: Principal): NhomMenu[] {
  return MENU.map((n) => ({
    ...n,
    muc: n.muc.filter((m) => !m.quyen || authorize(principal, m.quyen).allowed),
  })).filter((n) => n.muc.length > 0);
}
