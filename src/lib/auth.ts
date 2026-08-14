import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessMaintenance, isManagerOrAdmin, type Profile } from "@/lib/types";

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

  return { supabase, user, profile };
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
export async function requireApprover() {
  const result = await requireUser();
  if (!result.profile.is_manager && result.profile.role !== "admin") {
    redirect("/holiday");
  }
  return result;
}

export async function requireMaintenanceAccess() {
  const result = await requireUser();
  if (!canAccessMaintenance(result.profile)) {
    redirect("/");
  }
  return result;
}

// Answering SOP questions / authoring one directly — same admin-or-manager
// fallback used by can_manage_sops() in RLS.
export async function requireSopManage() {
  const result = await requireUser();
  if (!isManagerOrAdmin(result.profile)) {
    redirect("/sops");
  }
  return result;
}

// Deciding (approve/decline) an event suggestion — same admin-or-manager
// fallback used by can_manage_events() in RLS.
export async function requireEventsManage() {
  const result = await requireUser();
  if (!isManagerOrAdmin(result.profile)) {
    redirect("/events");
  }
  return result;
}

// Whole-app gate for Actions — unlike Maintenance there's no separate
// per-person opt-in flag; eligibility just *is* "manager or admin", since
// only they can ever raise or own one.
export async function requireActionItemsAccess() {
  const result = await requireUser();
  if (!isManagerOrAdmin(result.profile)) {
    redirect("/");
  }
  return result;
}
