"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireApprover } from "@/lib/auth";
import { notifyLeaveDecision, notifyLieuDecision } from "@/lib/holiday/notifications";
import type { LeaveRequest, LieuRequest } from "@/lib/types";

function fail(message: string): never {
  redirect(`/holiday/approvals?error=${encodeURIComponent(message)}`);
}

export async function approveLeave(id: string) {
  const { supabase } = await requireApprover();
  const { data: request } = await supabase.from("leave_requests").select("*").eq("id", id).single<LeaveRequest>();

  const { error } = await supabase.rpc("approve_leave_request", { p_request_id: id });
  if (error) fail(error.message);

  if (request) {
    await notifyLeaveDecision(request.staff_id, "approved", request.start_date, request.end_date, null);
  }
  revalidatePath("/holiday/approvals");
}

export async function rejectLeave(id: string, formData: FormData) {
  const { supabase } = await requireApprover();
  const notes = formData.get("notes");
  const reason = notes ? String(notes) : null;

  const { data: request } = await supabase.from("leave_requests").select("*").eq("id", id).single<LeaveRequest>();

  const { error } = await supabase.rpc("reject_leave_request", { p_request_id: id, p_notes: reason });
  if (error) fail(error.message);

  if (request) {
    await notifyLeaveDecision(request.staff_id, "rejected", request.start_date, request.end_date, reason);
  }
  revalidatePath("/holiday/approvals");
}

export async function approveLieu(id: string) {
  const { supabase } = await requireApprover();
  const { data: request } = await supabase.from("lieu_requests").select("*").eq("id", id).single<LieuRequest>();

  const { error } = await supabase.rpc("approve_lieu_request", { p_request_id: id });
  if (error) fail(error.message);

  if (request) {
    await notifyLieuDecision(request.staff_id, "approved", request.work_date, null);
  }
  revalidatePath("/holiday/approvals");
}

export async function rejectLieu(id: string, formData: FormData) {
  const { supabase } = await requireApprover();
  const notes = formData.get("notes");
  const reason = notes ? String(notes) : null;

  const { data: request } = await supabase.from("lieu_requests").select("*").eq("id", id).single<LieuRequest>();

  const { error } = await supabase.rpc("reject_lieu_request", { p_request_id: id, p_notes: reason });
  if (error) fail(error.message);

  if (request) {
    await notifyLieuDecision(request.staff_id, "rejected", request.work_date, reason);
  }
  revalidatePath("/holiday/approvals");
}
