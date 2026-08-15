import Link from "next/link";
import { moTaQuyen } from "@aescentic/permissions";
import { docPhien } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Trang "không đủ quyền".
 *
 * Nói rõ thiếu quyền nào và bảo người dùng hỏi ai — chứ không phải một trang
 * lỗi trắng khiến họ tưởng phần mềm hỏng rồi gọi điện cho Jen.
 */
export default async function KhongDuQuyen({
  searchParams,
}: {
  searchParams: Promise<{ can?: string }>;
}) {
  const ctx = await docPhien();
  const { can } = await searchParams;

  return (
    <div className="mx-auto max-w-xl py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Không đủ quyền</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
        Tài khoản của bạn không mở phần này
      </h1>

      <p className="mt-3 text-sm text-muted">
        {can ? (
          <>
            Cần quyền <code className="font-mono text-ink">{can}</code>, mà vai trò hiện tại của bạn
            chưa được cấp.
          </>
        ) : (
          <>Vai trò hiện tại của bạn chưa được cấp quyền vào phần này.</>
        )}{" "}
        Nếu bạn cần dùng, nhờ quản trị viên cấp thêm trong mục Phân quyền.
      </p>

      {ctx && (
        <div className="mt-5 border border-line bg-surface p-4 text-sm">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Đang đăng nhập
          </div>
          <div className="mt-1 font-semibold">{ctx.fullName ?? ctx.email}</div>
          <div className="text-muted">
            {ctx.email} · {moTaQuyen(ctx.principal)}
          </div>
        </div>
      )}

      <Link href="/" className="btn-dark mt-6 inline-block">
        Về trang chủ
      </Link>
    </div>
  );
}
