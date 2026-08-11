import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Regular staff always auto-route here (admins choose explicitly instead,
// via a dropdown populated from their own RLS-scoped client, which can see
// everyone). Uses the admin client deliberately — a regular submitter's own
// session can't read an arbitrary other profile (e.g. Dan's) under normal
// RLS, and this lookup is just for a name/id snapshot, not exposing data to
// them.
export async function resolveDefaultAssignee(): Promise<{ id: string; name: string }> {
  const admin = createAdminClient();

  const { data: settings } = await admin.from("settings").select("default_maintenance_assignee_id").single();

  if (settings?.default_maintenance_assignee_id) {
    const { data: assignee } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", settings.default_maintenance_assignee_id)
      .eq("active", true)
      .maybeSingle();
    if (assignee) {
      return { id: assignee.id, name: assignee.full_name };
    }
  }

  const { data: admins } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .eq("active", true)
    .order("full_name")
    .limit(1);

  const fallback = admins?.[0];
  if (!fallback) {
    throw new Error("No admin found to route this request to.");
  }
  return { id: fallback.id, name: fallback.full_name };
}
