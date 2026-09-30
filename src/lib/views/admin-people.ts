import "server-only";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { AccessLevel } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { proratedAllowance } from "@/lib/holiday/proration";
import { formatUkPhone } from "@/lib/phone";
import { adminDocumentPrefix, documentTypeNames, documentsWithUrls } from "@/lib/onboarding/details";
import type {
  BankChangeRequest,
  EmployeeDetails,
  EmployeeDocument,
  ImpersonationLogEntry,
  LeaveBalance,
  Profile,
} from "@/lib/types";
import type { StaffRow } from "@/components/staff-tables";
import type { ViewMap } from "./types";

// Index 0 = Sunday, matching profiles.working_days.
const DAY_SHORT = ["Su", "M", "T", "W", "Th", "F", "Sa"];

type Grant = { staff_id: string; app: string; level: AccessLevel };

// Pickers only need a name against an id — no reason to ship everyone's
// whole profile to the browser for a dropdown.
const pickable = (people: Profile[] | null) =>
  (people ?? []).map((p) => ({ id: p.id, full_name: p.full_name }));

export const views = {
  // /admin/staff — active and archived staff tables.
  staffList: async () => {
    const { supabase } = await requireAdmin();
    const year = new Date().getFullYear();

    const [{ data: staff }, { data: balances }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
      supabase.from("leave_balances").select("*").eq("leave_year", year).returns<LeaveBalance[]>(),
    ]);

    const balanceByStaff = new Map((balances ?? []).map((b) => [b.staff_id, b]));
    const all = staff ?? [];

    const toRow = (person: Profile): StaffRow => ({
      id: person.id,
      fullName: person.full_name,
      email: person.email,
      employmentType: person.employment_type,
      workingDays: person.working_days.map((d) => DAY_SHORT[d]).join(" "),
      allowance:
        person.employment_type === "salaried"
          ? `${
              balanceByStaff.get(person.id)?.base_allowance ??
              (person.annual_allowance_days
                ? proratedAllowance(person.annual_allowance_days, person.start_date, year)
                : "—")
            } days`
          : "12.07% accrual",
      manager: all.find((m) => m.id === person.manager_id)?.full_name ?? "—",
      role: person.role,
      invited: person.invited_at ? formatDate(person.invited_at) : "Not invited",
    });

    // No Status column — which table someone is in says it.
    return {
      active: all.filter((p) => p.active).map(toRow),
      archived: all.filter((p) => !p.active).map(toRow),
    };
  },

  // /admin/staff/new — the manager picker.
  newStaff: async () => {
    const { supabase } = await requireAdmin();
    const { data: managers } = await supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>();
    return { managers: pickable(managers) };
  },

  // /admin/staff/[id] — how one person is set up in the portal.
  editStaff: async ({ id }) => {
    const { supabase, user } = await requireAdmin();
    if (!id) notFound();

    const [{ data: staff }, { data: managers }, { data: details }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
      supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
      supabase.from("employee_details").select("*").eq("staff_id", id).maybeSingle<EmployeeDetails>(),
    ]);
    if (!staff) notFound();

    return {
      staff,
      managers: pickable(managers),
      // Only whether anything is on file — the details themselves live on
      // the employee details screen.
      hasDetails: !!(details?.home_address || details?.ni_number || details?.bank_account_number),
      currentAdminId: user.id,
    };
  },

  // /admin/onboarding — reviews waiting, bank changes to approve, everyone.
  onboardingList: async () => {
    const { supabase } = await requireAdmin();

    const [{ data: staff }, { data: details }, { data: bankRequests }] = await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
      supabase.from("employee_details").select("*").returns<EmployeeDetails[]>(),
      supabase
        .from("bank_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at")
        .returns<BankChangeRequest[]>(),
    ]);

    const detailsByStaff = new Map((details ?? []).map((d) => [d.staff_id, d]));
    const all = staff ?? [];

    // Reduced to what the screen shows, so nobody's NI number or address
    // sits in the browser cache just to draw a "Complete" label.
    return {
      waiting: all
        .filter((p) => p.onboarding_status === "submitted")
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          submitted_at: detailsByStaff.get(p.id)?.submitted_at ?? null,
        })),
      pendingBank: (bankRequests ?? []).map((r) => ({
        id: r.id,
        staff_name: r.staff_name,
        requested_at: r.requested_at,
        phoneOnFile: formatUkPhone(detailsByStaff.get(r.staff_id)?.mobile_phone),
        previous_bank_name: r.previous_bank_name,
        previous_bank_sort_code: r.previous_bank_sort_code,
        previous_bank_account_number: r.previous_bank_account_number,
        bank_name: r.bank_name,
        bank_sort_code: r.bank_sort_code,
        bank_account_number: r.bank_account_number,
      })),
      everyone: all.map((p) => {
        const detail = detailsByStaff.get(p.id);
        const complete = !!(detail?.home_address && detail?.ni_number && detail?.bank_account_number);
        return {
          id: p.id,
          full_name: p.full_name,
          onboarding_status: p.onboarding_status as string,
          details: complete ? ("complete" as const) : detail ? ("partial" as const) : ("none" as const),
        };
      }),
    };
  },

  // /admin/onboarding/[id] — one person's details and staff file.
  employeeDetails: async ({ id }) => {
    const { supabase } = await requireAdmin();
    if (!id) notFound();

    const { data: person } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle<Profile>();
    if (!person) notFound();

    const [{ data: details }, { data: documents }] = await Promise.all([
      supabase.from("employee_details").select("*").eq("staff_id", id).maybeSingle<EmployeeDetails>(),
      supabase
        .from("employee_documents")
        .select("*")
        .eq("staff_id", id)
        .order("created_at")
        .returns<EmployeeDocument[]>(),
    ]);

    // Minted on every fetch and short-lived — the bucket is private, so
    // there is no URL that keeps working after this page is closed. The
    // background refresh (every couple of minutes, and on focus) keeps
    // them fresher than their five-minute life.
    const [uploaded, typeNames] = await Promise.all([
      documentsWithUrls(documents ?? []),
      documentTypeNames(supabase),
    ]);

    return {
      person: {
        id: person.id,
        full_name: person.full_name,
        email: person.email,
        onboarding_status: person.onboarding_status,
      },
      details: details ?? null,
      uploaded,
      typeNames,
      documentPrefix: adminDocumentPrefix(person.id),
    };
  },

  // /admin/access — who can open which app.
  appAccess: async () => {
    const { supabase } = await requireAdmin();

    const [{ data: staff }, { data: grants }] = await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
      supabase.from("app_access").select("staff_id, app, level").returns<Grant[]>(),
    ]);

    const byStaff: Record<string, Record<string, AccessLevel>> = {};
    for (const g of grants ?? []) {
      (byStaff[g.staff_id] ??= {})[g.app] = g.level;
    }

    // Admins are not in the grid: they always have everything, so an editing
    // mistake can never lock the business out of its own records.
    const all = staff ?? [];
    return {
      adminNames: all.filter((p) => p.role === "admin").map((p) => p.full_name),
      rows: all
        .filter((p) => p.role !== "admin")
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          is_manager: p.is_manager,
          grants: byStaff[p.id] ?? {},
        })),
    };
  },

  // /admin/org-chart — active staff and who they report to.
  orgChart: async () => {
    const { supabase } = await requireAdmin();
    const { data: staff } = await supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>();
    return {
      people: (staff ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        manager_id: p.manager_id,
        role: p.role,
        is_manager: p.is_manager,
        employment_type: p.employment_type,
      })),
    };
  },

  // /admin/activity-log — every "log in as".
  activityLog: async () => {
    const { supabase } = await requireAdmin();
    const { data: entries } = await supabase
      .from("impersonation_log")
      .select("*")
      .order("started_at", { ascending: false })
      .returns<ImpersonationLogEntry[]>();
    return { entries: entries ?? [] };
  },
} satisfies ViewMap;
