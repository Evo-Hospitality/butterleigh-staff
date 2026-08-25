import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { levelFor, meets, type AccessLevel, type AppKey } from "@/lib/access";

// Centralizes "who is the current user, and what can they do". Server
// Components/Actions use this for UX (hiding admin-only buttons, redirecting
// early); Postgres row-level security is the actual enforcement boundary.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { data: grantRows } = await supabase
    .from("app_access")
    .select("app, level")
    .eq("staff_id", user.id)
    .returns<{ app: string; level: AccessLevel }[]>();

  const grants = new Map<string, AccessLevel>((grantRows ?? []).map((g) => [g.app, g.level]));
  const isAdmin = profile.role === "admin";
  const access = (app: AppKey, required: "use" | "manage" = "use") =>
    meets(levelFor(grants, app, isAdmin), required);

  return { supabase, user, profile, grants, access };
}

// The single gate. Everything that used to have its own bespoke rule —
// maintenance access flags, manager-or-admin checks — comes through here.
export async function requireAppAccess(app: AppKey, required: "use" | "manage" = "use") {
  const result = await requireUser();
  if (!result.access(app, required)) {
    redirect("/");
  }
  return result;
}

export async function requireAdmin() {
  const result = await requireUser();
  if (result.profile.role !== "admin") {
    redirect("/");
  }
  return result;
}

// Approvers are anyone who manages at least one person, plus admins (who act
// as the fallback approver for staff at the top of the manager chain).
// Approving holiday is the one thing still tied to the reporting line as
// well as the app: you need Manage on Holiday, and RLS still limits you to
// your own reports.
export async function requireApprover() {
  const result = await requireUser();
  if (!result.access("holiday", "manage")) {
    redirect("/holiday");
  }
  return result;
}

export async function requireMaintenanceAccess() {
  return requireAppAccess("maintenance");
}

// Answering SOP questions / authoring one directly — same admin-or-manager
// fallback used by can_manage_sops() in RLS.
export async function requireSopManage() {
  return requireAppAccess("sops", "manage");
}

// Deciding (approve/decline) an event suggestion — same admin-or-manager
// fallback used by can_manage_events() in RLS.
export async function requireEventsManage() {
  return requireAppAccess("events", "manage");
}

// Check Ins is the management meeting's own workspace — same population as
// Actions, and for the same reason: only managers and admins are in the room.
export async function requireCheckinsAccess() {
  return requireAppAccess("overview");
}

// Whole-app gate for Actions — unlike Maintenance there's no separate
// per-person opt-in flag; eligibility just *is* "manager or admin", since
// only they can ever raise or own one.
export async function requireActionItemsAccess() {
  return requireAppAccess("actions");
}
