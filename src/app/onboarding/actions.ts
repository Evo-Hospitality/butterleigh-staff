"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  missingFields,
  readBankFields,
  readDetailFields,
  uploadEmployeeDocument,
} from "@/lib/onboarding/details";
import { notifyOnboardingSubmitted } from "@/lib/onboarding/notifications";
import { updateStaffEmail } from "@/lib/holiday/staff";
import type { EmployeeDetails } from "@/lib/types";

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function submitOnboardingAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  if (profile.onboarding_status === "approved" || profile.onboarding_status === "not_required") {
    redirect("/");
  }

  const fields = readDetailFields(formData);
  const bank = readBankFields(formData);

  const missing = missingFields(fields, bank);
  if (missing.length > 0) {
    fail(`Still needed: ${missing.join(", ")}.`);
  }

  const { data: existing } = await supabase
    .from("employee_details")
    .select("*")
    .eq("staff_id", user.id)
    .maybeSingle<EmployeeDetails>();

  // Required first time round; on a resubmission the one already uploaded
  // stands unless they choose a new file.
  let checklistPath = existing?.hmrc_checklist_path ?? null;
  const file = formData.get("hmrc_checklist");
  if (file instanceof File && file.size > 0) {
    try {
      checklistPath = await uploadEmployeeDocument(supabase, user.id, file);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not upload the checklist.");
    }
  }
  if (!checklistPath) {
    fail("The HMRC Starter Checklist is needed before we can process payroll.");
  }

  const row = {
    staff_id: user.id,
    ...fields,
    ...bank,
    hmrc_checklist_path: checklistPath,
    submitted_at: new Date().toISOString(),
    // Clear any previous send-back note, so the reviewer isn't reading a
    // stale reason against a fresh submission.
    review_note: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("employee_details").update(row).eq("staff_id", user.id)
    : await supabase.from("employee_details").insert(row);
  if (error) {
    fail(error.message);
  }

  // profiles is admin-write only, so this goes through a narrow security
  // definer function rather than a direct update (0034).
  const { error: statusError } = await supabase.rpc("mark_onboarding_submitted");
  if (statusError) {
    fail(statusError.message);
  }

  // The email box on the form is also their login, so a correction here has
  // to reach auth, not just the profile row.
  const email = String(formData.get("email") ?? "").trim();
  if (email && email.toLowerCase() !== profile.email.toLowerCase()) {
    try {
      await updateStaffEmail(user.id, email);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not update the email address.");
    }
  }

  await notifyOnboardingSubmitted(profile.full_name);

  revalidatePath("/onboarding");
  redirect("/onboarding?submitted=1");
}
