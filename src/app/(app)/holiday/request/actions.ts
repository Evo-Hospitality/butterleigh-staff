"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { countWorkingDays } from "@/lib/holiday/working-days";
import { notifyNewLeaveRequest } from "@/lib/holiday/notifications";

export async function requestLeave(formData: FormData) {
  const { supabase, profile } = await requireUser();

  const startDate = String(formData.get("start_date"));
  const endDate = String(formData.get("end_date"));
  const notes = formData.get("notes");
  const isUnpaid = profile.employment_type === "salaried" && formData.get("is_unpaid") === "on";

  const amount =
    profile.employment_type === "salaried"
      ? countWorkingDays(startDate, endDate, profile.working_days)
      : Number(formData.get("hours"));

  function fail(message: string): never {
    redirect(`/holiday/request?error=${encodeURIComponent(message)}`);
  }

  if (!amount || amount <= 0) {
    fail(
      profile.employment_type === "salaried"
        ? "That date range doesn't include any of your working days."
        : "Enter the number of hours you're requesting.",
    );
  }

  // Goes through an RPC rather than a plain insert — see
  // 0023_request_leave_rpc.sql. It locks the staff member's balance row
  // before checking, so the balance check (which also counts other pending
  // requests as reserved, not just approved/used amounts) and the insert
  // are atomic — this is what actually stops a double-click, or two
  // genuinely concurrent submissions, from both passing the same check.
  const { error } = await supabase.rpc("request_leave", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_amount: amount,
    p_is_unpaid: isUnpaid,
    p_notes: notes ? String(notes) : null,
  });

  if (error) {
    fail(error.message || "Failed to submit your request.");
  }

  await notifyNewLeaveRequest(profile, startDate, endDate, amount);

  redirect("/holiday");
}
