"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  documentsStillUploading,
  missingFields,
  readBankFields,
  readDetailFields,
  readPendingDocuments,
  saveEmployeeDocuments,
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

  if (documentsStillUploading(formData)) {
    fail("Hang on a moment — a file is still uploading.");
  }

  // Already in storage by now; the picker uploads on selection. Anything
  // attached on a previous attempt still counts, so a resubmission doesn't
  // mean photographing the form again.
  const newDocuments = readPendingDocuments(formData);
  const { count: existingDocuments } = await supabase
    .from("employee_documents")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", user.id);

  if (newDocuments.length === 0 && !existingDocuments) {
    fail("The HMRC Starter Checklist is needed before we can process payroll.");
  }

  try {
    await saveEmployeeDocuments(supabase, user.id, newDocuments, {
      id: user.id,
      name: profile.full_name,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : "Could not save the uploaded files.");
  }

  const row = {
    staff_id: user.id,
    ...fields,
    ...bank,
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
