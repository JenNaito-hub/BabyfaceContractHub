import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

const APPS = [
  {
    href: "/sales",
    ten: "Aescentic Sales",
    mo_ta: "Bán hàng đa kênh: Shopee, TikTok, Facebook, Website và 5 cửa hàng. Đơn hàng, tồn kho, POS, báo cáo.",
    chu: "A",
  },
  {
    href: "/talent",
    ten: "Babyface Talent",
    mo_ta: "Quản lý talent & casting theo tháng: job, casting, duyệt talent, báo cáo chi phí.",
    chu: "B",
  },
];

export default async function Home() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold">
        Chào {session.profile?.full_name || session.email}
      </h1>
      <p className="mt-2 text-dark/60">Chọn hệ thống cần vào.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {APPS.map((a) => (
          <Link key={a.href} href={a.href} className="card transition hover:shadow-md">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-lime text-xl font-extrabold text-dark">
              {a.chu}
            </div>
            <h2 className="font-display text-lg font-extrabold">{a.ten}</h2>
            <p className="mt-1 text-sm text-dark/60">{a.mo_ta}</p>
          </Link>
        ))}
      </div>

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="btn-ghost text-xs">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
