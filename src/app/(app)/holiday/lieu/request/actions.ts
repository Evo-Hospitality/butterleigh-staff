"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notifyNewLieuRequest } from "@/lib/holiday/notifications";
import { findDuplicateId, readSubmissionToken } from "@/lib/submission-token";

export async function requestLieuDay(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  function fail(message: string): never {
    redirect(`/holiday/lieu/request?error=${encodeURIComponent(message)}`);
  }

  if (profile.employment_type !== "salaried") {
    fail("Days in lieu only apply to salaried staff — hourly holiday already accrues from hours worked.");
  }

  const workDate = String(formData.get("work_date"));
  const notes = formData.get("notes");
  const submissionToken = readSubmissionToken(formData);

  const { error } = await supabase.from("lieu_requests").insert({
    staff_id: user.id,
    work_date: workDate,
    notes: notes ? String(notes) : null,
    submission_token: submissionToken,
  });

  // Second press: the first already logged it and emailed the approver.
  const duplicateId = await findDuplicateId(supabase, "lieu_requests", error, submissionToken);
  if (duplicateId) {
    redirect("/holiday");
  }

  if (error) {
    fail(error.message);
  }

  await notifyNewLieuRequest(profile, workDate);

  redirect("/holiday");
}
