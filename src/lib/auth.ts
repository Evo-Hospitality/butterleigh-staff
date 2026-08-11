import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

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

// Admins always have implicit access, same fallback pattern as everywhere
// else — the flag is what an admin toggles per person, not a hard boundary
// admins themselves are subject to.
export async function requireMaintenanceAccess() {
  const result = await requireUser();
  if (!result.profile.has_maintenance_access && result.profile.role !== "admin") {
    redirect("/");
  }
  return result;
}
