import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { isManagerRole, type AuditLog, type Profile } from "@/lib/types";
import AuditClient from "@/components/audit/AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSessionProfile();
  const isManager = isManagerRole(session?.profile?.role);

  if (!isManager) {
    return (
      <div className="card text-center">
        <h1 className="mb-2 text-xl font-extrabold">Không có quyền</h1>
        <p className="text-sm text-dark/60">
          Nhật ký thay đổi chỉ dành cho manager/admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: logs }, { data: profiles }, { data: talents }, { data: jobs }] = await Promise.all([
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("talents").select("id, ho_ten"),
    supabase.from("jobs").select("id, ten_job"),
  ]);

  const actorNames: Record<string, string> = {};
  for (const p of (profiles ?? []) as Pick<Profile, "id" | "full_name">[]) {
    if (p.full_name) actorNames[p.id] = p.full_name;
  }

  const recordNames: Record<string, string> = {};
  for (const t of (talents ?? []) as { id: string; ho_ten: string }[]) {
    recordNames[t.id] = t.ho_ten;
  }
  for (const j of (jobs ?? []) as { id: string; ten_job: string }[]) {
    recordNames[j.id] = j.ten_job;
  }

  return (
    <AuditClient
      logs={(logs ?? []) as AuditLog[]}
      actorNames={actorNames}
      recordNames={recordNames}
    />
  );
}
