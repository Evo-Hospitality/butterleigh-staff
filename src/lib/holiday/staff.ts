import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmploymentType } from "@/lib/types";

export type CreateStaffInput = {
  email: string;
  fullName: string;
  role: "staff" | "admin";
  employmentType: EmploymentType;
  workingDays: number[];
  contractedHoursPerWeek: number | null;
  annualAllowanceDays: number | null;
  managerId: string | null;
  isManager: boolean;
  hasMaintenanceAccess: boolean;
};

// Creates the auth user (and, via the handle_new_user() trigger in
// 0001_init.sql, their matching `profiles` row) WITHOUT sending any email —
// lets an admin set someone up in advance. Call sendStaffInvite separately,
// whenever they're actually ready to invite the person to log in.
export async function createStaff(input: CreateStaffInput) {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      employment_type: input.employmentType,
      working_days: input.workingDays,
      contracted_hours_per_week: input.contractedHoursPerWeek,
      annual_allowance_days: input.annualAllowanceDays,
      manager_id: input.managerId,
      is_manager: input.isManager,
      has_maintenance_access: input.hasMaintenanceAccess,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

// Emails the staff member a link to set their password and log in for the
// first time — safe to call again later to resend/re-invite. Supabase
// doesn't have a separate "invite an already-created user" email, so this
// reuses the password-reset flow, which does exactly the same job.
//
// Deliberately NOT our cookie-based @supabase/ssr server client: that
// client defaults to PKCE, which ties the emailed link to a code_verifier
// stored in *our* (the admin's) cookies — useless to the staff member
// opening the link on a different device entirely. A plain client forced to
// the implicit flow produces a self-contained link (the session tokens ride
// along in the URL) that works no matter who opens it or where.
export async function sendStaffInvite(email: string) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/set-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// Sets a staff member's password directly — an alternative to emailing an
// invite link, for when the admin will just tell them the password another
// way (in person, by text). The account is immediately usable; the
// must_change_password flag (set by the caller) forces them through
// /auth/set-password on their next login before reaching anything else.
export async function setTemporaryPassword(staffId: string, password: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(staffId, { password });
  if (error) {
    throw new Error(error.message);
  }
}

// Changes a staff member's login email directly — same admin-override
// pattern as setTemporaryPassword: applies immediately (email_confirm skips
// the usual "confirm your new address" round-trip), no action needed from
// them. Keeps profiles.email (used for display and notifications) in sync,
// since it doesn't auto-update from an auth-level change.
export async function updateStaffEmail(staffId: string, newEmail: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(staffId, { email: newEmail, email_confirm: true });
  if (error) {
    throw new Error(error.message);
  }

  const { error: profileError } = await admin.from("profiles").update({ email: newEmail }).eq("id", staffId);
  if (profileError) {
    throw new Error(profileError.message);
  }
}

// Permanently removes a staff member and everything tied to them (their own
// requests, balances, hours entries — via ON DELETE CASCADE). Anywhere else
// they're referenced (manager_id, approver_id, entered_by on someone else's
// row) degrades gracefully to null rather than blocking the delete — see
// 0003_delete_cascades.sql. Intended for dummy/test data or hires that never
// started; for a real leaver, deactivate them instead (keeps their history).
export async function deleteStaff(staffId: string) {
  const admin = createAdminClient();

  // Their employee_documents rows go with the cascade, but the files behind
  // them don't — and a private bucket quietly keeping someone's HMRC
  // checklist after they've been deleted is exactly the wrong outcome.
  const { data: files } = await admin.storage.from("employee-documents").list(staffId);
  if (files?.length) {
    await admin.storage
      .from("employee-documents")
      .remove(files.map((f) => `${staffId}/${f.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(staffId);
  if (error) {
    throw new Error(error.message);
  }
}
