/**
 * Bản đồ 20 module của AESCENTIC OS và tình trạng thật của từng module.
 *
 * Đây là NGUỒN SỰ THẬT DUY NHẤT về "cái gì đã chạy được". Mọi con số tiến độ
 * trên giao diện đọc từ đây, nên không có chuyện tài liệu nói xong mà màn hình
 * nói chưa. Chỉ đánh `xong` khi đã có: database + quyền + API + giao diện +
 * kiểm thử. Làm dở thì ghi `dang-lam` kèm nói rõ phần nào chạy được.
 */
export type TinhTrang = "xong" | "dang-lam" | "chua";

export type Module = {
  so: string;
  ten: string;
  tinhTrang: TinhTrang;
  /** Những phần đã chạy được, nói bằng thứ người dùng thấy. */
  daCo?: string[];
  /** Những phần chưa có. Nói thẳng, không hứa ngày. */
  conThieu?: string[];
  /** Đường dẫn tới màn hình nếu đã có. */
  duongDan?: string;
  /** Thứ đang chặn, nếu chờ Jen hoặc chờ bên thứ ba. */
  choGi?: string;
};

export const NHAN_TINH_TRANG: Record<TinhTrang, string> = {
  xong: "Đã chạy",
  "dang-lam": "Một phần",
  chua: "Chưa dựng",
};

export const MODULES: Module[] = [
  {
    so: "01",
    ten: "Trang chủ & điều hành",
    tinhTrang: "dang-lam",
    duongDan: "/",
    daCo: [
      "Bảng điều khiển doanh thu theo ngày và theo kênh",
      "Lợi nhuận gộp (chỉ người có quyền xem giá vốn)",
      "Cảnh báo sắp hết hàng",
      "Đơn cần xử lý, COD đang giao",
    ],
    conThieu: [
      "Mục tiêu và tiến độ KPI",
      "Dự báo cuối tháng / cuối năm",
      "Xếp hạng cửa hàng, xếp hạng Sales",
      "Trung tâm cảnh báo tập trung",
      "Trợ lý AI cho CEO",
    ],
  },
  {
    so: "02",
    ten: "Bán hàng",
    tinhTrang: "dang-lam",
    duongDan: "/pos",
    daCo: [
      "Bán tại quầy: quét mã, chốt đơn, trừ kho ngay",
      "Đơn hàng: tìm, lọc theo kênh và trạng thái",
      "Nhập đơn từ Shopee / TikTok Shop, không nhân đôi khi tải lại file",
      "In phiếu giao hàng A5 và hoá đơn 80mm, in hàng loạt",
    ],
    conThieu: [
      "Đổi / trả hàng",
      "Báo cáo cuối ngày của cửa hàng (đối chiếu tiền mặt thực tế)",
      "Hiệu suất và xếp hạng Sales",
      "Ghi nhận lượt khách thử, khách không mua",
    ],
  },
  {
    so: "03",
    ten: "Sản phẩm & phân tích",
    tinhTrang: "dang-lam",
    duongDan: "/products",
    daCo: ["Danh mục sản phẩm, SKU, giá bán, giá vốn", "Bán chạy theo doanh thu trong báo cáo Excel"],
    conThieu: [
      "Hồ sơ mùi hương (nhóm hương, hương đầu/giữa/cuối, độ lưu)",
      "Kiến thức bán hàng: câu chuyện, kịch bản tư vấn, xử lý từ chối",
      "Phân tích sell-through, test → mua",
      "Vòng đời sản phẩm",
    ],
  },
  {
    so: "04",
    ten: "Kho & tồn kho",
    tinhTrang: "dang-lam",
    duongDan: "/inventory",
    daCo: [
      "Tồn theo từng địa điểm, tách hàng bán / tester / quà tặng",
      "Nhập kho, cập nhật giá vốn theo giá nhập mới",
      "Chuyển kho: rời kho gửi ngay, vào kho nhận khi xác nhận",
      "Kiểm kho bắt buộc ghi lý do",
      "Sổ kho truy được từng lần biến động",
    ],
    conThieu: [
      "Yêu cầu cấp hàng có luồng duyệt",
      "Kiểm kê theo tuần / tháng / toàn bộ",
      "Phân tích: số ngày còn hàng, tuổi tồn kho, hàng chết",
      "AI đề xuất điều chuyển",
    ],
  },
  {
    so: "05",
    ten: "Mua hàng & nhà cung cấp",
    tinhTrang: "chua",
    conThieu: [
      "Nhà cung cấp, báo giá, đơn đặt hàng",
      "Duyệt mua, theo dõi giao hàng",
      "Công nợ nhà cung cấp, lịch sử giá, MOQ, lead time",
    ],
  },
  {
    so: "06",
    ten: "Sản xuất & QC",
    tinhTrang: "chua",
    conThieu: [
      "Công thức, định mức, lệnh sản xuất",
      "Batch / lô hàng",
      "QC: kiểm mùi, chai, pump, tem, rò rỉ",
      "Truy xuất batch → kho → cửa hàng → khách",
    ],
  },
  {
    so: "07",
    ten: "Nhân sự & đội ngũ",
    tinhTrang: "dang-lam",
    duongDan: "/admin/users",
    daCo: ["Hồ sơ nhân viên, gán vai trò và cửa hàng"],
    conThieu: [
      "Chat nội bộ, thông báo nội bộ",
      "Ca làm: đăng ký, đổi ca, ca thiếu người",
      "Nghỉ phép và duyệt nghỉ",
      "Chấm công, đi trễ, tăng ca",
      "Đào tạo và bài kiểm tra",
    ],
  },
  {
    so: "08",
    ten: "KPI / hoa hồng / lương thưởng",
    tinhTrang: "chua",
    conThieu: [
      "KPI cá nhân, cửa hàng, toàn hệ thống",
      "Hoa hồng bán lẻ / B2B / campaign",
      "Tính lương, duyệt bảng lương nhiều cấp",
      "Phiếu lương giải thích từng khoản",
    ],
    choGi: "Cần Jen chốt công thức KPI, tỷ lệ hoa hồng và quy tắc lương",
  },
  {
    so: "09",
    ten: "Marketing",
    tinhTrang: "chua",
    conThieu: [
      "Campaign, khuyến mãi, voucher, combo",
      "Quản lý quà tặng và phân bổ cho cửa hàng",
      "Sales broadcast, campaign training",
      "Phân tích ROI campaign",
    ],
  },
  {
    so: "10",
    ten: "CRM / khách hàng thân thiết",
    tinhTrang: "dang-lam",
    duongDan: "/customers",
    daCo: [
      "Khách tự sinh theo số điện thoại khi chốt đơn",
      "Lịch sử mua, tổng chi tiêu, lần mua gần nhất",
      "Chỉ thấy khách của cửa hàng mình (theo phân quyền)",
    ],
    conThieu: [
      "Phân nhóm: VIP, có nguy cơ mất, đã mất",
      "Loyalty: điểm, hạng, quà, quyền lợi",
      "Scent ID™ — gu mùi của từng khách",
      "CRM tự động: sinh nhật, mua lại, win-back",
    ],
  },
  {
    so: "11",
    ten: "Chăm sóc khách hàng & Zalo OA",
    tinhTrang: "chua",
    conThieu: [
      "Hộp thư chung, hội thoại, ticket CSKH",
      "SLA, CSAT, gợi ý trả lời bằng AI",
      "Zalo OA: QR cửa hàng, broadcast",
    ],
    choGi: "Cần tài khoản Zalo OA và khoá API",
  },
  {
    so: "12",
    ten: "Zalo Mini App",
    tinhTrang: "chua",
    conThieu: [
      "Trang chủ cá nhân hoá, cửa hàng, giỏ hàng",
      "Thành viên: điểm, hạng, voucher",
      "Scent Finder, Gift Finder",
      "Đặt lịch thử mùi tại cửa hàng",
    ],
    choGi: "Cần đăng ký Zalo Mini App và khoá API",
  },
  {
    so: "13",
    ten: "B2B / Scent Solutions",
    tinhTrang: "chua",
    conThieu: [
      "Lead, cơ hội, pipeline, báo giá, hợp đồng",
      "Quản lý máy khuếch tán theo serial, lắp đặt, bảo trì",
      "Refill định kỳ, doanh thu định kỳ",
      "Công nợ và thu hồi công nợ",
    ],
  },
  {
    so: "14",
    ten: "BNI / referral network",
    tinhTrang: "chua",
    conThieu: ["Chapter, thành viên, referral nhận và cho", "TYFCB, doanh thu từ BNI"],
  },
  {
    so: "15",
    ten: "Hoá đơn & kế toán",
    tinhTrang: "dang-lam",
    duongDan: "/cod",
    daCo: [
      "Đối soát COD với hãng vận chuyển",
      "Xuất báo cáo Excel: doanh thu, giá vốn, tồn kho",
    ],
    conThieu: ["Hoá đơn điện tử", "Xuất dữ liệu sang phần mềm kế toán"],
    choGi: "Cần Jen chọn nhà cung cấp hoá đơn điện tử và cho biết phần mềm kế toán đang dùng",
  },
  {
    so: "16",
    ten: "Ngân sách / chi phí / dòng tiền",
    tinhTrang: "chua",
    conThieu: [
      "Ngân sách theo công ty, cửa hàng, marketing",
      "Yêu cầu chi và duyệt chi",
      "Dòng tiền vào / ra, phải thu, phải trả",
      "Lợi nhuận theo cửa hàng / kênh / sản phẩm",
    ],
  },
  {
    so: "17",
    ten: "Công việc / SOP / tài liệu",
    tinhTrang: "chua",
    conThieu: ["Giao việc và việc định kỳ", "SOP theo phòng ban", "Tài liệu công ty có phiên bản"],
  },
  {
    so: "18",
    ten: "AI Intelligence",
    tinhTrang: "chua",
    conThieu: [
      "Trợ lý AI cho CEO, Sales, kho, CRM",
      "Phát hiện bất thường và dự báo",
      "Kho tri thức: HR, SOP, sản phẩm",
    ],
    choGi: "Cần chọn nhà cung cấp AI và duyệt tài liệu nào được đưa vào kho tri thức",
  },
  {
    so: "19",
    ten: "Báo cáo & phân tích",
    tinhTrang: "dang-lam",
    duongDan: "/",
    daCo: [
      "Báo cáo Excel 5 sheet: tổng quan, theo ngày, theo sản phẩm, chi tiết đơn, tồn kho",
      "Áp đúng phạm vi người tải — nhân viên không thấy cột lãi",
    ],
    conThieu: ["Báo cáo tự tạo theo bộ lọc", "Lưu mẫu báo cáo", "Xuất PDF"],
  },
  {
    so: "20",
    ten: "Quản trị hệ thống",
    tinhTrang: "dang-lam",
    duongDan: "/admin/roles",
    daCo: [
      "Người dùng, vai trò, 93 quyền dạng resource.action.scope",
      "Quản lý cửa hàng và địa điểm kho",
      "Nhật ký kiểm toán: ai, làm gì, trước sau, lúc nào",
      "Khung tích hợp Nhanh.vn (chờ credential)",
    ],
    conThieu: [
      "Cấu hình KPI, hoa hồng, lương, loyalty",
      "Luồng phê duyệt cấu hình được",
      "Trung tâm thông báo",
      "Sao lưu và phục hồi",
      "Tìm kiếm toàn hệ thống",
    ],
    choGi: "Nhanh.vn cần NHANH_APP_ID, NHANH_BUSINESS_ID, NHANH_ACCESS_TOKEN",
  },
];

export function demTheoTinhTrang() {
  return {
    xong: MODULES.filter((m) => m.tinhTrang === "xong").length,
    dangLam: MODULES.filter((m) => m.tinhTrang === "dang-lam").length,
    chua: MODULES.filter((m) => m.tinhTrang === "chua").length,
    tong: MODULES.length,
  };
}
