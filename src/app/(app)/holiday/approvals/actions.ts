"use server";

import { revalidatePath } from "next/cache";
import { requireApprover } from "@/lib/auth";

export async function approveLeave(id: string) {
  const { supabase } = await requireApprover();
  const { error } = await supabase.rpc("approve_leave_request", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/holiday/approvals");
}

export async function rejectLeave(id: string) {
  const { supabase } = await requireApprover();
  const { error } = await supabase.rpc("reject_leave_request", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/holiday/approvals");
}

export async function approveLieu(id: string) {
  const { supabase } = await requireApprover();
  const { error } = await supabase.rpc("approve_lieu_request", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/holiday/approvals");
}

export async function rejectLieu(id: string) {
  const { supabase } = await requireApprover();
  const { error } = await supabase.rpc("reject_lieu_request", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/holiday/approvals");
}
