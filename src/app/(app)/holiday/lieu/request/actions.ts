"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function requestLieuDay(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  if (profile.employment_type !== "salaried") {
    throw new Error("Days in lieu only apply to salaried staff — hourly holiday already accrues from hours worked.");
  }

  const workDate = String(formData.get("work_date"));
  const notes = formData.get("notes");

  const { error } = await supabase.from("lieu_requests").insert({
    staff_id: user.id,
    work_date: workDate,
    notes: notes ? String(notes) : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/holiday");
}
