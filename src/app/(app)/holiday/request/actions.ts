"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { countWorkingDays } from "@/lib/holiday/working-days";
import { notifyNewLeaveRequest } from "@/lib/holiday/notifications";
import type { LeaveBalance } from "@/lib/types";

export async function requestLeave(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

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

  // Unpaid leave never touches the balance, so it's exempt from this check
  // — everything else (hourly always, salaried unless unpaid) is capped at
  // what's actually available, same rule the approval step enforces.
  if (!isUnpaid) {
    const year = new Date(startDate + "T00:00:00").getFullYear();
    const { data: balance } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("staff_id", user.id)
      .eq("leave_year", year)
      .maybeSingle<LeaveBalance>();

    const remaining =
      profile.employment_type === "hourly"
        ? (balance?.brought_forward ?? 0) + (balance?.accrued_hours ?? 0) - (balance?.used_hours ?? 0)
        : (balance?.brought_forward ?? 0) +
          (balance?.base_allowance ?? profile.annual_allowance_days ?? 0) +
          (balance?.lieu_days_earned ?? 0) -
          (balance?.used_days ?? 0);

    if (amount > remaining) {
      const unit = profile.employment_type === "hourly" ? "hours" : "days";
      fail(
        `You only have ${remaining.toFixed(2)} ${unit} available — this request is for ${amount} ${unit}.` +
          (profile.employment_type === "salaried" ? " Tick “unpaid leave” if that's intended." : ""),
      );
    }
  }

  const { error } = await supabase.from("leave_requests").insert({
    staff_id: user.id,
    start_date: startDate,
    end_date: endDate,
    amount,
    is_unpaid: isUnpaid,
    notes: notes ? String(notes) : null,
  });

  if (error) {
    fail(error.message);
  }

  await notifyNewLeaveRequest(profile, startDate, endDate, amount);

  redirect("/holiday");
}
