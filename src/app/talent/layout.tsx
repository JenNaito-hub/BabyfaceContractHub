import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <NavBar
        role={session.profile?.role ?? null}
        email={session.email}
        fullName={session.profile?.full_name ?? null}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
