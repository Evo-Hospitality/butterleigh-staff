import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Profile, LeaveBalance } from "@/lib/types";
import { effectiveAllowance, remainingBalance } from "@/lib/holiday/balance";
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
      <div className="mb-6 max-w-2xl text-sm text-muted-foreground">
        <p className="mb-2">
          Each person&apos;s opening position for the leave year. Salaried allowance defaults from
          their staff record the first time you save; accrued hours (hourly) fill in automatically
          from monthly hours entries.
        </p>
        <p className="mb-2">
          The 2026 opening balances came across from the Excel holiday tracker this replaced, and
          are the closing balances as at the <strong>31 July 2026 payroll</strong>.
        </p>
        <div className="rounded-md bg-yellow-50 px-3 py-2 text-yellow-900">
          <p className="mb-2">
            <strong>Nothing rolls over on its own.</strong> A leave year only exists once an admin
            sets it up — until then a new year shows an opening balance of zero for everyone, and{" "}
            <strong>no holiday in that year can be approved at all</strong>.
          </p>
          <p className="mb-2">
            Use <strong>Roll {year} into {year + 1}</strong> to set it up. Once processed:
          </p>
          <ul className="mb-2 list-disc pl-5">
            <li>
              <strong>Hourly</strong> carry their full remaining balance forward as their opening
              figure, and then accrue on top of it from {year + 1}&apos;s hours as those are
              imported. Nothing they&apos;ve accrued and not taken is lost.
            </li>
            <li>
              <strong>Salaried</strong> start at zero and get the full allowance from their staff
              record — the allowance is the entitlement, so carrying a balance across as well would
              count it twice. Anyone who started part-way through {year} on a pro-rated allowance
              gets the full one in {year + 1}.
            </li>
          </ul>
          <p>Every figure is editable before you commit, and re-running is safe.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
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
        <Link
          href={`/admin/balances/rollover?from=${year}`}
          className="ml-auto rounded-md border border-accent px-3 py-1.5 font-semibold text-accent hover:bg-accent hover:text-white"
        >
          Roll {year} into {year + 1} &rarr;
        </Link>
      </div>

      <form action={saveBalances}>
        <input type="hidden" name="year" value={year} />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Staff</th>
                {/* "Opening balance", not "brought forward" — nothing computes
                    it from last year; it's the manual starting position for
                    this leave year. (DB column stays brought_forward.) */}
                <th className="px-4 py-2 font-medium">Opening balance</th>
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
                const baseAllowance = effectiveAllowance(person, bal, year);
                const lieu = bal?.lieu_days_earned ?? 0;
                const accruedHours = bal?.accrued_hours ?? 0;
                const usedDays = bal?.used_days ?? 0;
                const usedHours = bal?.used_hours ?? 0;
                const remaining = remainingBalance(person, bal, year);

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
