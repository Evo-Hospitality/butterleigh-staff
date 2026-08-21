import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActionItem,
  BankChangeRequest,
  EmployeeDetails,
  EventSuggestion,
  LeaveRequest,
  LieuRequest,
  MaintenanceRequest,
  Profile,
  SocialPhotoPost,
  Task,
} from "@/lib/types";
import { isManagerOrAdmin } from "@/lib/types";
import { formatDate } from "@/lib/format";

export type SummaryLink = {
  id: string;
  href: string;
  label: string;
  meta: string | null;
};

export type CheckinSummary = {
  onboarding: SummaryLink[];
  bankChanges: SummaryLink[];
  tasks: SummaryLink[];
  holiday: SummaryLink[];
  photos: SummaryLink[];
  events: SummaryLink[];
  maintenance: SummaryLink[];
  actions: SummaryLink[];
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Everyone in the room is a manager or admin, so the summary is an org-wide
// view — holiday, tasks, maintenance, events and photos are read with the
// service-role client rather than the viewer's own, which would otherwise
// show a manager only their own direct reports' leave.
//
// Actions are the deliberate exception, on Gus's call: they stay private to
// whoever raised or owns them, so that section is read through the caller's
// own client and each manager sees only theirs.
//
// Employment details and bank changes are the other exception, in the other
// direction: they're admin-only everywhere else in the app, so they're only
// gathered when the viewer is an admin. A manager in the same meeting gets
// nothing, not even a count.
export async function buildCheckinSummary(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  photoDays: number,
  isAdmin: boolean,
): Promise<CheckinSummary> {
  const [
    { data: staff },
    { data: tasks },
    { data: leave },
    { data: lieu },
    { data: photos },
    { data: events },
    { data: maintenance },
    { data: actions },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("active", true).returns<Profile[]>(),
    admin
      .from("tasks")
      .select("*")
      .eq("is_active", true)
      .neq("status", "done")
      .order("due_date", { nullsFirst: false })
      .returns<Task[]>(),
    admin.from("leave_requests").select("*").eq("status", "pending").returns<LeaveRequest[]>(),
    admin.from("lieu_requests").select("*").eq("status", "pending").returns<LieuRequest[]>(),
    admin
      .from("social_photo_posts")
      .select("*")
      .gte("created_at", daysAgoIso(photoDays))
      .order("created_at", { ascending: false })
      .returns<SocialPhotoPost[]>(),
    admin
      .from("event_suggestions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<EventSuggestion[]>(),
    admin
      .from("maintenance_requests")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .returns<MaintenanceRequest[]>(),
    // Caller's own client on purpose — Actions stay private to their raiser
    // and assignee, so each manager sees only theirs here.
    supabase
      .from("action_items")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .returns<ActionItem[]>(),
  ]);

  const [{ data: awaitingOnboarding }, { data: onboardingDetails }, { data: bankChanges }] = isAdmin
    ? await Promise.all([
        admin
          .from("profiles")
          .select("*")
          .eq("onboarding_status", "submitted")
          .order("full_name")
          .returns<Profile[]>(),
        admin.from("employee_details").select("*").returns<EmployeeDetails[]>(),
        admin
          .from("bank_change_requests")
          .select("*")
          .eq("status", "pending")
          .order("requested_at")
          .returns<BankChangeRequest[]>(),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const submittedAtByStaff = new Map(
    (onboardingDetails ?? []).map((d) => [d.staff_id, d.submitted_at]),
  );

  // "Open tasks assigned to managers/admins, not anyone else" — the meeting
  // is about what the management team owes, not the whole staff's to-do list.
  const managerIds = new Set((staff ?? []).filter(isManagerOrAdmin).map((s) => s.id));
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  return {
    // A new starter can't do a shift until this is approved, so it's the
    // most time-critical thing on the page.
    onboarding: (awaitingOnboarding ?? []).map((p) => ({
      id: `onboarding-${p.id}`,
      href: `/admin/onboarding/${p.id}`,
      label: p.full_name,
      meta: submittedAtByStaff.get(p.id)
        ? `submitted ${formatDate(submittedAtByStaff.get(p.id)!)}`
        : null,
    })),

    bankChanges: (bankChanges ?? []).map((r) => ({
      id: `bank-${r.id}`,
      href: "/admin/onboarding",
      label: r.staff_name,
      meta: `requested ${formatDate(r.requested_at)} · ring them before approving`,
    })),

    tasks: (tasks ?? [])
      .filter((t) => t.assigned_to && managerIds.has(t.assigned_to))
      .map((t) => ({
        id: t.id,
        href: `/tasks/${t.id}`,
        label: t.title,
        meta: [
          t.assigned_to_name,
          t.status === "awaiting_review" ? "awaiting review" : null,
          t.due_date ? `due ${t.due_date}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),

    holiday: [
      ...(leave ?? []).map((r) => ({
        id: `leave-${r.id}`,
        href: "/holiday/approvals",
        label: nameById.get(r.staff_id) ?? "Unknown",
        meta: `${r.start_date}${r.end_date !== r.start_date ? ` to ${r.end_date}` : ""} · ${r.amount}${r.is_unpaid ? " (unpaid)" : ""}`,
      })),
      ...(lieu ?? []).map((r) => ({
        id: `lieu-${r.id}`,
        href: "/holiday/approvals",
        label: nameById.get(r.staff_id) ?? "Unknown",
        meta: `day in lieu · worked ${r.work_date}`,
      })),
    ],

    photos: (photos ?? []).map((p) => ({
      id: p.id,
      href: "/social-photos",
      label: p.caption?.trim() || "Untitled submission",
      meta: `${p.submitted_by_name} · ${formatDate(p.created_at)}`,
    })),

    // Just the name, clickable through to the idea itself.
    events: (events ?? []).map((e) => ({
      id: e.id,
      href: `/events/${e.id}`,
      label: e.title,
      meta: e.submitted_by_name,
    })),

    maintenance: (maintenance ?? []).map((r) => ({
      id: r.id,
      href: `/maintenance/${r.id}`,
      label: r.title,
      meta: `${r.assigned_to_name} · reported ${formatDate(r.created_at)}`,
    })),

    actions: (actions ?? []).map((a) => ({
      id: a.id,
      href: `/actions/${a.id}`,
      label: a.title,
      meta: `${a.assigned_to_name} · raised ${formatDate(a.created_at)}`,
    })),
  };
}
