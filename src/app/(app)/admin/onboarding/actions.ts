"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  documentsStillUploading,
  readBankFields,
  readDetailFields,
  readPendingDocuments,
  saveEmployeeDocuments,
} from "@/lib/onboarding/details";
import { notifyBankChangeDecided, notifyOnboardingDecided } from "@/lib/onboarding/notifications";
import type { BankChangeRequest, EmployeeDocument } from "@/lib/types";

function fail(staffId: string, message: string): never {
  redirect(`/admin/onboarding/${staffId}?error=${encodeURIComponent(message)}`);
}

// Also the copy-paste migration route for existing staff: an admin can fill
// in someone's record from the old spreadsheet without them ever seeing the
// starter form.
export async function saveEmployeeDetailsAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) {
    redirect("/admin/onboarding");
  }

  const fields = readDetailFields(formData);
  const bank = readBankFields(formData);

  const { data: existing } = await supabase
    .from("employee_details")
    .select("id")
    .eq("staff_id", staffId)
    .maybeSingle<{ id: string }>();

  const row = {
    staff_id: staffId,
    ...fields,
    ...bank,
    // Dates reject an empty string, unlike text.
    start_date: fields.start_date || null,
    date_of_birth: fields.date_of_birth || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("employee_details").update(row).eq("staff_id", staffId)
    : await supabase.from("employee_details").insert(row);
  if (error) {
    fail(staffId, error.message);
  }

  revalidatePath(`/admin/onboarding/${staffId}`);
  redirect(`/admin/onboarding/${staffId}?saved=1`);
}

export async function approveOnboardingAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) {
    redirect("/admin/onboarding");
  }

  const { error } = await supabase
    .from("employee_details")
    .update({
      reviewed_by: user.id,
      reviewed_by_name: profile.full_name,
      reviewed_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("staff_id", staffId);
  if (error) {
    fail(staffId, error.message);
  }

  const { error: statusError } = await supabase
    .from("profiles")
    .update({ onboarding_status: "approved" })
    .eq("id", staffId);
  if (statusError) {
    fail(staffId, statusError.message);
  }

  await notifyOnboardingDecided(staffId, true, null);

  revalidatePath("/admin/onboarding");
  redirect("/admin/onboarding?approved=1");
}

// Back to 'pending' with a note, rather than rejected outright — their
// answers stay on the form so they only fix the bit that's wrong.
export async function sendBackOnboardingAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  const note = String(formData.get("review_note") ?? "").trim();
  if (!staffId) {
    redirect("/admin/onboarding");
  }
  if (!note) {
    fail(staffId, "Say what needs correcting, otherwise they won't know what to change.");
  }

  const { error } = await supabase
    .from("employee_details")
    .update({
      reviewed_by: user.id,
      reviewed_by_name: profile.full_name,
      reviewed_at: new Date().toISOString(),
      review_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("staff_id", staffId);
  if (error) {
    fail(staffId, error.message);
  }

  const { error: statusError } = await supabase
    .from("profiles")
    .update({ onboarding_status: "pending" })
    .eq("id", staffId);
  if (statusError) {
    fail(staffId, statusError.message);
  }

  await notifyOnboardingDecided(staffId, false, note);

  revalidatePath("/admin/onboarding");
  redirect("/admin/onboarding?sentback=1");
}

export async function setOnboardingRequiredAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  const required = String(formData.get("required") ?? "") === "1";
  if (!staffId) {
    redirect("/admin/onboarding");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_status: required ? "pending" : "not_required" })
    .eq("id", staffId);
  if (error) {
    fail(staffId, error.message);
  }

  revalidatePath(`/admin/onboarding/${staffId}`);
  redirect(`/admin/onboarding/${staffId}?saved=1`);
}

// Approving is what actually moves the money, so this is the only place the
// bank columns get written for someone already on payroll.
export async function decideBankChangeAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "");
  const approve = String(formData.get("approve") ?? "") === "1";
  const note = String(formData.get("review_note") ?? "").trim();

  const { data: request } = await supabase
    .from("bank_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle<BankChangeRequest>();
  if (!request || request.status !== "pending") {
    redirect("/admin/onboarding?error=" + encodeURIComponent("That request has already been dealt with."));
  }

  if (approve) {
    const { data: existing } = await supabase
      .from("employee_details")
      .select("id")
      .eq("staff_id", request.staff_id)
      .maybeSingle<{ id: string }>();

    const bank = {
      bank_name: request.bank_name,
      bank_sort_code: request.bank_sort_code,
      bank_account_number: request.bank_account_number,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("employee_details").update(bank).eq("staff_id", request.staff_id)
      : await supabase.from("employee_details").insert({ staff_id: request.staff_id, ...bank });
    if (error) {
      redirect("/admin/onboarding?error=" + encodeURIComponent(error.message));
    }
  }

  const { error: statusError } = await supabase
    .from("bank_change_requests")
    .update({
      status: approve ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_by_name: profile.full_name,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq("id", requestId);
  if (statusError) {
    redirect("/admin/onboarding?error=" + encodeURIComponent(statusError.message));
  }

  await notifyBankChangeDecided(request.staff_id, approve, note || null);

  revalidatePath("/admin/onboarding");
  redirect(approve ? "/admin/onboarding?bankapproved=1" : "/admin/onboarding?bankrejected=1");
}

// Attaching paperwork on someone else's behalf — the usual case being an
// existing member of staff whose checklist arrived on paper or by email.
export async function uploadEmployeeDocumentsAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) {
    redirect("/admin/onboarding");
  }

  if (documentsStillUploading(formData)) {
    fail(staffId, "Hang on a moment — a file is still uploading.");
  }

  const documents = readPendingDocuments(formData);
  if (documents.length === 0) {
    fail(staffId, "Choose at least one file first.");
  }

  try {
    await saveEmployeeDocuments(supabase, staffId, documents, {
      id: user.id,
      name: profile.full_name,
    });
  } catch (err) {
    fail(staffId, err instanceof Error ? err.message : "Could not save the uploaded files.");
  }

  revalidatePath(`/admin/onboarding/${staffId}`);
  redirect(`/admin/onboarding/${staffId}?saved=1`);
}

// Takes the file with it, not just the row — an orphaned document in a
// private bucket is still someone's National Insurance number sitting there.
export async function deleteEmployeeDocumentAction(documentId: string, staffId: string) {
  const { supabase } = await requireAdmin();
  if (!documentId || !staffId) {
    redirect("/admin/onboarding");
  }

  const { data: document } = await supabase
    .from("employee_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle<EmployeeDocument>();
  if (!document) {
    redirect(`/admin/onboarding/${staffId}`);
  }

  const { error } = await supabase.from("employee_documents").delete().eq("id", documentId);
  if (error) {
    fail(staffId, error.message);
  }
  await supabase.storage.from("employee-documents").remove([document.path]);

  revalidatePath(`/admin/onboarding/${staffId}`);
  redirect(`/admin/onboarding/${staffId}?saved=1`);
}
