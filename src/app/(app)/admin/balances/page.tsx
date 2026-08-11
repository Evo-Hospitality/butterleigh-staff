import { requireAdmin } from "@/lib/auth";
import type { Profile, LeaveBalance } from "@/lib/types";
import { proratedAllowance } from "@/lib/holiday/proration";
import { saveBalances } from "./actions";

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [{ data: staff }, { data: balances }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
  ]);

  const balanceByStaff = new Map(balances?.map((b) => [b.staff_id, b]));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Balances — {year}</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Enter each person&apos;s brought-forward balance for the year. Salaried allowance defaults
        from their staff record the first time you save; accrued hours (hourly) fill in automatically
        from monthly hours entries.
      </p>

      <div className="mb-4 flex gap-3 text-sm">
        {[year - 1, year, year + 1].map((y) => (
          <a
            key={y}
            href={`/admin/balances?year=${y}`}
            className={`rounded-md border px-3 py-1.5 ${
              y === year ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
            }`}
          >
            {y}
          </a>
        ))}
      </div>

      <form action={saveBalances}>
        <input type="hidden" name="year" value={year} />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Staff</th>
                <th className="px-4 py-2 font-medium">Brought forward</th>
                <th className="px-4 py-2 font-medium">Allowance (salaried, days)</th>
                <th className="px-4 py-2 font-medium">Lieu earned</th>
                <th className="px-4 py-2 font-medium">Accrued hours</th>
                <th className="px-4 py-2 font-medium">Used</th>
                <th className="px-4 py-2 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {staff?.map((person) => {
                const bal = balanceByStaff.get(person.id);
                const isSalaried = person.employment_type === "salaried";
                const broughtForward = bal?.brought_forward ?? 0;
                const baseAllowance =
                  bal?.base_allowance ??
                  (person.annual_allowance_days
                    ? proratedAllowance(person.annual_allowance_days, person.start_date, year)
                    : 0);
                const lieu = bal?.lieu_days_earned ?? 0;
                const accruedHours = bal?.accrued_hours ?? 0;
                const usedDays = bal?.used_days ?? 0;
                const usedHours = bal?.used_hours ?? 0;
                const remaining = isSalaried
                  ? broughtForward + baseAllowance + lieu - usedDays
                  : broughtForward + accruedHours - usedHours;

                return (
                  <tr key={person.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap">{person.full_name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.1"
                        name={`brought_${person.id}`}
                        defaultValue={broughtForward}
                        className="w-24 rounded-md border border-border px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {isSalaried ? (
                        <>
                          <input
                            type="number"
                            step="0.1"
                            name={`allowance_${person.id}`}
                            defaultValue={baseAllowance}
                            className="w-24 rounded-md border border-border px-2 py-1"
                          />
                          {!bal && person.start_date && new Date(person.start_date).getFullYear() === year && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              pro-rated from {person.annual_allowance_days} (started {person.start_date})
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{isSalaried ? lieu : "—"}</td>
                    <td className="px-4 py-2">{isSalaried ? "—" : accruedHours.toFixed(2)}</td>
                    <td className="px-4 py-2">{isSalaried ? usedDays : usedHours.toFixed(2)}</td>
                    <td className="px-4 py-2 font-medium">
                      {remaining.toFixed(2)} {isSalaried ? "days" : "hrs"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  );
}
