import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { OrgChartNode } from "./org-chart-node";

export default async function OrgChartPage() {
  const { supabase } = await requireAdmin();

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .order("full_name")
    .returns<Profile[]>();

  const people = staff ?? [];
  // "Root" = no manager, or their manager isn't in the active list (e.g.
  // archived) — either way, nothing above them to nest under.
  const roots = people.filter((p) => !p.manager_id || !people.some((m) => m.id === p.manager_id));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Org chart</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Who reports to whom, based on each person&apos;s manager. Archived staff aren&apos;t shown.
      </p>

      <div className="rounded-lg border border-border p-6">
        {roots.map((root) => (
          <OrgChartNode key={root.id} person={root} people={people} depth={0} />
        ))}
        {roots.length === 0 && <p className="text-sm text-muted-foreground">No staff yet.</p>}
      </div>
    </div>
  );
}
