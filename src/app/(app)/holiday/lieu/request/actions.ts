"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { notifyNewLieuRequest } from "@/lib/holiday/notifications";

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

  const { error } = await supabase.from("lieu_requests").insert({
    staff_id: user.id,
    work_date: workDate,
    notes: notes ? String(notes) : null,
  });

  if (error) {
    fail(error.message);
  }

  await notifyNewLieuRequest(profile, workDate);

  redirect("/holiday");
}
