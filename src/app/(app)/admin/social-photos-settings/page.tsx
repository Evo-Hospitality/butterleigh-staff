import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { buildSocialsPayrollReport } from "@/lib/social-photos/payroll-report";
import { saveReviewerAction } from "./actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function SocialPhotosSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const [{ data: settings }, { data: staff }, rows] = await Promise.all([
    supabase.from("settings").select("social_photos_reviewer_id").single(),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    buildSocialsPayrollReport(supabase, year, month),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Social photos</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        New photo submissions notify whoever&apos;s set below, and only they (or an admin) can mark
        individual photos as used. Marking a photo used pays £1 to hourly staff, tracked below by
        the month the checkmark was set.
      </p>

      <form action={saveReviewerAction} className="mb-8 flex max-w-md items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Reviewer</label>
          <select
            name="social_photos_reviewer_id"
            defaultValue={settings?.social_photos_reviewer_id ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">Nobody set — submissions won&apos;t be emailed</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">
          Payroll report — {MONTH_NAMES[month - 1]} {year}
        </h2>
        <a
          href={`/admin/social-photos-settings/csv?year=${year}&month=${month}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 flex gap-3 text-sm">
        {[-1, 0, 1].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const active = y === year && m === month;
          return (
            <a
              key={offset}
              href={`/admin/social-photos-settings?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {MONTH_NAMES[m - 1]} {y}
            </a>
          );
        })}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        Hourly staff only — salaried staff aren&apos;t paid extra for this.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Pictures used</th>
              <th className="px-4 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staffId} className="border-t border-border">
                <td className="px-4 py-2">{row.fullName}</td>
                <td className="px-4 py-2">{row.pictureCount}</td>
                <td className="px-4 py-2 font-medium">£{row.amount.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                  No pictures marked used this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
