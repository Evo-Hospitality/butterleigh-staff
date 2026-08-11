"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { countWorkingDays } from "@/lib/holiday/working-days";

export async function requestLeave(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const startDate = String(formData.get("start_date"));
  const endDate = String(formData.get("end_date"));
  const notes = formData.get("notes");

  const amount =
    profile.employment_type === "salaried"
      ? countWorkingDays(startDate, endDate, profile.working_days)
      : Number(formData.get("hours"));

  if (!amount || amount <= 0) {
    throw new Error(
      profile.employment_type === "salaried"
        ? "That date range doesn't include any of your working days."
        : "Enter the number of hours you're requesting.",
    );
  }

  const { error } = await supabase.from("leave_requests").insert({
    staff_id: user.id,
    start_date: startDate,
    end_date: endDate,
    amount,
    notes: notes ? String(notes) : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/holiday");
}
