import "server-only";

import { requireAdmin } from "@/lib/auth";
import { staffWithAppAccess } from "@/lib/access-query";
import { effectiveAllowance, remainingBalance } from "@/lib/holiday/balance";
import { proratedAllowance } from "@/lib/holiday/proration";
import { buildPayrollReport } from "@/lib/holiday/payroll-report";
import { buildSocialsPayrollReport } from "@/lib/social-photos/payroll-report";
import type {
  BankHoliday,
  CheckinGroup,
  LeaveBalance,
  MonthlyHoursEntry,
  Profile,
  StockLocation,
  StockType,
} from "@/lib/types";
import type { RolloverRow } from "@/components/rollover-form";
import type { ImportRow, UnmatchedRow } from "@/components/hours-import-panel";
import type { ViewMap } from "./types";

// The year/month screens get their period from the browser (so the page and
// its data always agree on "this month"); these fall back the way the old
// server pages did if it's missing.
function yearOf(year: string | undefined) {
  return Number(year) || new Date().getFullYear();
}
function monthOf(month: string | undefined) {
  return Number(month) || new Date().getMonth() + 1;
}

export type BalanceRow = {
  id: string;
  fullName: string;
  isSalaried: boolean;
  broughtForward: number;
  baseAllowance: number;
  lieu: number;
  accruedHours: number;
  usedDays: number;
  usedHours: number;
  remaining: number;
  /** Set when a first-year salaried allowance is shown pro-rated and not yet saved. */
  proRatedFrom: { annual: number | null; startDate: string } | null;
};

export const views = {
  // /admin/balances — every person's opening position for a leave year.
  // Figures are worked out here so the browser only gets what the table shows,
  // not whole profile rows.
  balances: async ({ year: yearParam }) => {
    const { supabase } = await requireAdmin();
    const year = yearOf(yearParam);

    const [{ data: staff }, { data: balances }] = await Promise.all([
      // Everyone, archived included — a leaver's holiday still has to be
      // explained (and often paid out), so they stay visible in their own
      // section at the bottom rather than disappearing.
      supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
      supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
    ]);

    const balanceByStaff = new Map(balances?.map((b) => [b.staff_id, b]));

    const toRow = (person: Profile): BalanceRow => {
      const bal = balanceByStaff.get(person.id);
      const isSalaried = person.employment_type === "salaried";
      return {
        id: person.id,
        fullName: person.full_name,
        isSalaried,
        broughtForward: bal?.brought_forward ?? 0,
        baseAllowance: effectiveAllowance(person, bal, year),
        lieu: bal?.lieu_days_earned ?? 0,
        accruedHours: bal?.accrued_hours ?? 0,
        usedDays: bal?.used_days ?? 0,
        usedHours: bal?.used_hours ?? 0,
        remaining: remainingBalance(person, bal, year),
        proRatedFrom:
          isSalaried && !bal && person.start_date && new Date(person.start_date).getFullYear() === year
            ? { annual: person.annual_allowance_days, startDate: person.start_date }
            : null,
      };
    };

    return {
      year,
      active: (staff ?? []).filter((p) => p.active).map(toRow),
      // Only leavers who actually have a position in this year — otherwise
      // every year would list everyone who has ever left.
      archived: (staff ?? []).filter((p) => !p.active && balanceByStaff.has(p.id)).map(toRow),
    };
  },

  // /admin/balances/rollover — suggested opening figures for next year.
  // Read-only: nothing is written until the admin commits on the page.
  rollover: async ({ from }) => {
    const { supabase } = await requireAdmin();
    const fromYear = yearOf(from);
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

    return { fromYear, toYear, rows };
  },

  // /admin/bank-holidays
  bankHolidays: async () => {
    const { supabase } = await requireAdmin();
    const { data: holidays } = await supabase
      .from("bank_holidays")
      .select("*")
      .order("date")
      .returns<BankHoliday[]>();
    return { holidays: (holidays ?? []).map((h) => ({ id: h.id, date: h.date, name: h.name })) };
  },

  // /admin/hours — one month's hours, the imports behind them and the
  // pickers the import panel needs.
  hours: async ({ year: yearParam, month: monthParam }) => {
    const { supabase } = await requireAdmin();
    const year = yearOf(yearParam);
    const month = monthOf(monthParam);

    const [{ data: staff }, { data: entries }, { data: allStaff }, { data: imports }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("employment_type", "hourly")
        .eq("active", true)
        .order("full_name")
        .returns<Pick<Profile, "id" | "full_name">[]>(),
      supabase
        .from("monthly_hours")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .returns<MonthlyHoursEntry[]>(),
      // The link dropdown needs everyone, not just hourly staff — the name
      // that didn't match might belong to a salaried manager.
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name")
        .returns<Pick<Profile, "id" | "full_name">[]>(),
      supabase
        .from("hours_imports")
        .select("*, hours_import_unmatched(*)")
        .eq("year", year)
        .eq("month", month)
        .order("created_at", { ascending: false }),
    ]);

    const hourlyIds = new Set((staff ?? []).map((s) => s.id));
    const initialHours: Record<string, number> = {};
    for (const e of entries ?? []) {
      if (hourlyIds.has(e.staff_id) && e.hours_worked !== undefined && e.hours_worked !== null) {
        initialHours[e.staff_id] = e.hours_worked;
      }
    }

    const importRows: ImportRow[] = (imports ?? []).map((imp) => ({
      id: imp.id,
      filename: imp.filename,
      period_start: imp.period_start,
      period_end: imp.period_end,
      entry_count: imp.entry_count,
      matched_count: imp.matched_count,
      skipped_salaried: imp.skipped_salaried,
      excluded_count: imp.excluded_count ?? 0,
      total_hours: imp.total_hours,
      imported_by_name: imp.imported_by_name,
      created_at: imp.created_at,
      unmatched: ((imp.hours_import_unmatched ?? []) as UnmatchedRow[]).sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
    }));

    return { year, month, staff: staff ?? [], allStaff: allStaff ?? [], initialHours, imports: importRows };
  },

  // /admin/payroll-report — the CSV download stays a server route.
  payrollReport: async ({ year: yearParam, month: monthParam }) => {
    const { supabase } = await requireAdmin();
    const year = yearOf(yearParam);
    const month = monthOf(monthParam);
    const { rows, holidays } = await buildPayrollReport(supabase, year, month);
    return { year, month, rows, holidays };
  },

  // /admin/maintenance-settings
  maintenanceSettings: async () => {
    const { supabase } = await requireAdmin();
    const [{ data: settings }, staff] = await Promise.all([
      supabase.from("settings").select("default_maintenance_assignee_id").single(),
      staffWithAppAccess(supabase, "maintenance", "manage"),
    ]);
    return {
      assigneeId: (settings?.default_maintenance_assignee_id as string | null | undefined) ?? "",
      staff: staff.map((s) => ({ id: s.id, full_name: s.full_name })),
    };
  },

  // /admin/social-photos-settings — reviewer picker plus the £1-a-picture
  // payroll report (CSV download stays a server route).
  socialPhotosSettings: async ({ year: yearParam, month: monthParam }) => {
    const { supabase } = await requireAdmin();
    const year = yearOf(yearParam);
    const month = monthOf(monthParam);
    const [{ data: settings }, { data: staff }, rows] = await Promise.all([
      supabase.from("settings").select("social_photos_reviewer_id").single(),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name")
        .returns<Pick<Profile, "id" | "full_name">[]>(),
      buildSocialsPayrollReport(supabase, year, month),
    ]);
    return {
      year,
      month,
      reviewerId: (settings?.social_photos_reviewer_id as string | null | undefined) ?? "",
      staff: staff ?? [],
      rows,
    };
  },

  // /admin/checkin-groups — the headings plus how many items sit under each
  // (a group can only be deleted when it's empty).
  checkinGroups: async () => {
    const { supabase } = await requireAdmin();
    const [{ data: groups }, { data: items }] = await Promise.all([
      supabase.from("checkin_groups").select("*").order("sort_order").returns<CheckinGroup[]>(),
      supabase.from("checkin_items").select("group_id"),
    ]);
    const itemCount: Record<string, number> = {};
    for (const i of items ?? []) {
      itemCount[i.group_id] = (itemCount[i.group_id] ?? 0) + 1;
    }
    return {
      groups: (groups ?? []).map((g) => ({ id: g.id, name: g.name, active: g.active })),
      itemCount,
    };
  },

  // /admin/stock-locations — one type's (wet or dry) location list.
  stockLocations: async ({ type: typeParam }) => {
    const { supabase } = await requireAdmin();
    const type: StockType = typeParam === "dry" ? "dry" : "wet";
    const { data: locations } = await supabase
      .from("stock_locations")
      .select("*")
      .eq("type", type)
      .order("sort_order")
      .returns<StockLocation[]>();
    return { type, locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })) };
  },
} satisfies ViewMap;
