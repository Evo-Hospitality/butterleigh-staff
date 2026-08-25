import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppKey } from "@/lib/access";
import type { Profile } from "@/lib/types";

// "Who could this be assigned to?" — used by Maintenance for its assignee
// lists. Admins are always included: they have everything by definition and
// so never appear in app_access as holding a level.
export async function staffWithAppAccess(
  supabase: SupabaseClient,
  app: AppKey,
  level: "use" | "manage" = "manage",
): Promise<Profile[]> {
  const [{ data: staff }, { data: grants }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase
      .from("app_access")
      .select("staff_id, level")
      .eq("app", app)
      .returns<{ staff_id: string; level: string }[]>(),
  ]);

  const allowed = new Set(
    (grants ?? [])
      .filter((g) => (level === "manage" ? g.level === "manage" : g.level !== "none"))
      .map((g) => g.staff_id),
  );

  return (staff ?? []).filter((p) => p.role === "admin" || allowed.has(p.id));
}
