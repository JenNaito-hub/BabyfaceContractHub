import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole, type Talent } from "@/lib/types";
import ApprovalsClient from "@/components/approvals/ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  if (!isManager) {
    return (
      <div className="card text-center">
        <h1 className="mb-2 text-xl font-extrabold">Không có quyền</h1>
        <p className="text-sm text-dark/60">
          Chỉ manager/admin mới duyệt talent. Liên hệ quản trị viên để được cấp quyền.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("talents")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <ApprovalsClient pending={(pending ?? []) as Talent[]} />;
}
