import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { APPS, type AccessLevel } from "@/lib/access";
import type { Profile } from "@/lib/types";
import { saveAppAccessAction, setAppForEveryoneAction } from "./actions";

type Grant = { staff_id: string; app: string; level: AccessLevel };

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: "None",
  use: "Use",
  manage: "Manage",
};

export default async function AppAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { error, saved } = await searchParams;

  const [{ data: staff }, { data: grants }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>(),
    supabase.from("app_access").select("staff_id, app, level").returns<Grant[]>(),
  ]);

  const byStaff = new Map<string, Map<string, AccessLevel>>();
  for (const g of grants ?? []) {
    if (!byStaff.has(g.staff_id)) byStaff.set(g.staff_id, new Map());
    byStaff.get(g.staff_id)!.set(g.app, g.level);
  }

  // Admins are not in the grid: they always have everything, so an editing
  // mistake can never lock the business out of its own records.
  const admins = (staff ?? []).filter((p) => p.role === "admin");
  const rows = (staff ?? []).filter((p) => p.role !== "admin");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">App access</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Who can open what. <strong>Use</strong> means they can do the everyday thing in an app;{" "}
        <strong>Manage</strong> adds the decisions inside it. <strong>None</strong> hides the app
        from them entirely — it won&apos;t appear in their menu or on their dashboard.
      </p>

      {saved && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mb-8 rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="mb-1 font-semibold text-primary">
          Admins always have everything: {admins.map((a) => a.full_name).join(", ") || "none"}
        </p>
        <p className="text-muted-foreground">
          They&apos;re deliberately left off this page, so nobody can accidentally lock the pub out
          of its own payroll and staff records. To take someone&apos;s admin rights away, change
          their role on their staff page.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold text-primary">What each level means</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">App</th>
                <th className="py-2 pr-3">Use</th>
                <th className="py-2">Manage</th>
              </tr>
            </thead>
            <tbody>
              {APPS.map((app) => (
                <tr key={app.key} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 font-medium">{app.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{app.use}</td>
                  <td className="py-2 text-muted-foreground">{app.manage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold text-primary">Set one app for everybody</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          The quick way to open a new app up to the whole team, or shut it again. Overwrites what
          each person currently has for that one app.
        </p>
        <form action={setAppForEveryoneAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">App</label>
            <select name="app" className="rounded-md border border-border px-3 py-2 text-sm">
              {APPS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Set everyone to</label>
            <select name="level" className="rounded-md border border-border px-3 py-2 text-sm">
              <option value="use">Use</option>
              <option value="manage">Manage</option>
              <option value="none">None</option>
            </select>
          </div>
          <SubmitButton pendingLabel="Applying…">Apply to everyone</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-primary">Everyone else ({rows.length})</h2>
        <div className="flex flex-col gap-4">
          {rows.map((person) => {
            const theirs = byStaff.get(person.id) ?? new Map<string, AccessLevel>();
            return (
              <form
                key={person.id}
                action={saveAppAccessAction}
                className="rounded-lg border border-border p-4"
              >
                <input type="hidden" name="staff_id" value={person.id} />
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{person.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.is_manager ? "Manages holiday for their team" : "Staff"}
                    </p>
                  </div>
                  <SubmitButton pendingLabel="Saving…">Save {person.full_name.split(" ")[0]}</SubmitButton>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {APPS.map((app) => {
                    const current = theirs.get(app.key) ?? "none";
                    return (
                      <div key={app.key}>
                        <label className="mb-1 block text-xs font-medium">{app.label}</label>
                        <select
                          name={`level_${app.key}`}
                          defaultValue={current}
                          className={`w-full rounded-md border px-2 py-1.5 text-sm ${
                            current === "none"
                              ? "border-border bg-muted text-muted-foreground"
                              : "border-accent"
                          }`}
                        >
                          {(["none", "use", "manage"] as AccessLevel[]).map((l) => (
                            <option key={l} value={l}>
                              {LEVEL_LABEL[l]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
