import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Layout trần — không nav, không padding, để trang in ra sạch. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return <div className="bg-white text-dark">{children}</div>;
}
