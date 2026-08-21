import { proratedAllowance } from "./proration";
import type { LeaveBalance, Profile } from "@/lib/types";

// One definition of "how much holiday has this person got", used by the
// Balances screen, the payroll report and each person's own Holiday page.
// These used to be three separate expressions and had drifted: only Balances
// pro-rated a mid-year starter's allowance, so a new starter saw a fuller
// entitlement on their own page than the admin saw on Balances.

// The allowance in force for a salaried person this leave year. Once a
// balance row exists its base_allowance is authoritative — including a
// deliberate zero — because that's what an admin saved. Before then, fall
// back to their staff record, pro-rated if this is their first year.
export function effectiveAllowance(
  profile: Pick<Profile, "annual_allowance_days" | "start_date">,
  balance: Pick<LeaveBalance, "base_allowance"> | undefined | null,
  year: number,
): number {
  if (balance) return Number(balance.base_allowance);
  if (!profile.annual_allowance_days) return 0;
  return proratedAllowance(profile.annual_allowance_days, profile.start_date, year);
}

// Days for salaried, hours for hourly — the caller knows which unit to print
// from employment_type.
export function remainingBalance(
  profile: Pick<Profile, "employment_type" | "annual_allowance_days" | "start_date">,
  balance: LeaveBalance | undefined | null,
  year: number,
): number {
  if (profile.employment_type === "salaried") {
    return (
      Number(balance?.brought_forward ?? 0) +
      effectiveAllowance(profile, balance, year) +
      Number(balance?.lieu_days_earned ?? 0) -
      Number(balance?.used_days ?? 0)
    );
  }
  return (
    Number(balance?.brought_forward ?? 0) +
    Number(balance?.accrued_hours ?? 0) -
    Number(balance?.used_hours ?? 0)
  );
}
