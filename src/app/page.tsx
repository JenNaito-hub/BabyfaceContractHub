import Link from "next/link";

/**
 * Trang chọn app.
 *
 * Trước đây route này redirect thẳng sang /talent, kéo theo hai vấn đề:
 * thiếu env Supabase là đổ lỗi 500, và Video Studio không có lối vào nào
 * từ domain gốc. Trang này không gọi gì phía server nên luôn mở được.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-xl font-extrabold text-dark">
            B
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Babyface</h1>
          <p className="mt-1 text-sm text-dark/55">Chọn khu vực bạn cần</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/talent"
            className="card group flex flex-col transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Talent Manager</h2>
              <span className="badge bg-dark/10 text-dark/60">Cần đăng nhập</span>
            </div>
            <p className="flex-1 text-sm text-dark/60">
              Quản lý talent và casting: job theo tháng, duyệt talent, chỉ số và xuất Excel.
            </p>
            <p className="mt-3 text-sm font-semibold group-hover:underline">Mở →</p>
          </Link>

          <Link
            href="/video"
            className="card group flex flex-col transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Video Studio</h2>
              <span className="badge bg-lime text-dark">Vào thẳng</span>
            </div>
            <p className="flex-1 text-sm text-dark/60">
              Dựng video, showreel talent, kịch bản AI và quản lý sản xuất. Chạy ngay trong
              trình duyệt, không cần tài khoản.
            </p>
            <p className="mt-3 text-sm font-semibold group-hover:underline">Mở →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
