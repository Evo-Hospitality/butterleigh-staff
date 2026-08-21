import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { remainingBalance } from "@/lib/holiday/balance";
import { proratedAllowance } from "@/lib/holiday/proration";
import type { LeaveBalance, Profile } from "@/lib/types";
import { RolloverForm, type RolloverRow } from "@/components/rollover-form";
import { commitRolloverAction } from "./actions";

export default async function RolloverPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const fromYear = Number(params.from) || new Date().getFullYear();
  const toYear = fromYear + 1;

  const [{ data: staff }, { data: fromBalances }, { data: toBalances }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase.from("leave_balances").select("*").eq("leave_year", fromYear).returns<LeaveBalance[]>(),
    supabase.from("leave_balances").select("*").eq("leave_year", toYear).returns<LeaveBalance[]>(),
  ]);

  const fromByStaff = new Map((fromBalances ?? []).map((b) => [b.staff_id, b]));
  const existingNextYear = new Set((toBalances ?? []).map((b) => b.staff_id));

  const rows: RolloverRow[] = (staff ?? []).map((person) => {
    const closing = remainingBalance(person, fromByStaff.get(person.id), fromYear);
    const isSalaried = person.employment_type === "salaried";

    return {
      staffId: person.id,
      fullName: person.full_name,
      employmentType: person.employment_type,
      closing: Math.round(closing * 100) / 100,
      // Salaried start the new year clean — the allowance below is their
      // entitlement, so carrying the old one too would double-count. Hourly
      // keep what they've accrued and not yet taken.
      suggestedOpening: isSalaried ? 0 : Math.round(Math.max(closing, 0) * 100) / 100,
      // Pro-rating only bites in someone's first calendar year, so anyone
      // already on the books gets their full annual figure here.
      allowance: isSalaried
        ? proratedAllowance(person.annual_allowance_days ?? 0, person.start_date, toYear)
        : 0,
      alreadyExists: existingNextYear.has(person.id),
    };
  });

  return (
    <div>
      <Link href={`/admin/balances?year=${fromYear}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Balances
      </Link>

      <h1 className="mt-2 mb-2 text-2xl font-bold text-primary">
        Roll {fromYear} into {toYear}
      </h1>

      <div className="mb-6 max-w-2xl text-sm text-muted-foreground">
        <p className="mb-2">
          Sets up the {toYear} leave year. Check the figures and change any of them before
          committing — nothing is written until you do.
        </p>
        <p className="mb-2">
          <strong>Salaried</strong> default to an opening balance of zero, because the allowance
          column is their entitlement for {toYear} and carrying the old balance across as well would
          count it twice. <strong>Hourly</strong> default to carrying their full unused balance,
          since accrued holiday they haven&apos;t taken is still owed to them.
        </p>
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-yellow-900">
          Worth doing before January: approving a holiday request fails outright if the person has
          no balance row for that year, so until this is run nobody&apos;s {toYear} leave can be
          approved.
        </p>
      </div>

      <RolloverForm fromYear={fromYear} toYear={toYear} rows={rows} commitAction={commitRolloverAction} />
    </div>
  );
}
