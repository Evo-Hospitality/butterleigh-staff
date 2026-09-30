import "server-only";

import { requireApprover, requireUser } from "@/lib/auth";
import { loadHolidayStatement } from "@/lib/holiday/statement";
import type { LeaveBalance, LeaveRequest, LieuRequest, Profile } from "@/lib/types";
import type { ViewMap } from "./types";

export const views = {
  // /holiday — your balance and your requests.
  overview: async () => {
    const { supabase, user, profile } = await requireUser();
    const year = new Date().getFullYear();
    const isSalaried = profile.employment_type === "salaried";

    const [{ data: balance }, { data: leaveRequests }, { data: lieuRequests }] = await Promise.all([
      supabase
        .from("leave_balances")
        .select("*")
        .eq("staff_id", user.id)
        .eq("leave_year", year)
        .maybeSingle<LeaveBalance>(),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("staff_id", user.id)
        .order("created_at", { ascending: false })
        .returns<LeaveRequest[]>(),
      isSalaried
        ? supabase
            .from("lieu_requests")
            .select("*")
            .eq("staff_id", user.id)
            .order("created_at", { ascending: false })
            .returns<LieuRequest[]>()
        : Promise.resolve({ data: [] as LieuRequest[] }),
    ]);

    return {
      year,
      balance: balance ?? null,
      leaveRequests: leaveRequests ?? [],
      lieuRequests: lieuRequests ?? [],
    };
  },

  // /holiday/statement — your own statement for a year.
  statement: async ({ year }) => {
    const { supabase, user } = await requireUser();
    const y = Number(year) || new Date().getFullYear();
    return loadHolidayStatement(supabase, user.id, y);
  },

  // /holiday/approvals — pending requests from the people you approve for.
  approvals: async () => {
    const { supabase, user } = await requireApprover();

    const [{ data: leaveRequests }, { data: lieuRequests }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .returns<LeaveRequest[]>(),
      supabase
        .from("lieu_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .returns<LieuRequest[]>(),
    ]);

    // RLS already scoped these to "my reports, or all if I'm admin" — drop my
    // own pending requests, which I can't approve for myself.
    const pendingLeave = (leaveRequests ?? []).filter((r) => r.staff_id !== user.id);
    const pendingLieu = (lieuRequests ?? []).filter((r) => r.staff_id !== user.id);

    const staffIds = Array.from(new Set([...pendingLeave, ...pendingLieu].map((r) => r.staff_id)));
    const { data: staff } = staffIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", staffIds).returns<Pick<Profile, "id" | "full_name">[]>()
      : { data: [] as Pick<Profile, "id" | "full_name">[] };

    return {
      pendingLeave,
      pendingLieu,
      names: Object.fromEntries((staff ?? []).map((s) => [s.id, s.full_name])) as Record<string, string>,
    };
  },
} satisfies ViewMap;
