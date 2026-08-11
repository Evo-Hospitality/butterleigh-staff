"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function cancelLeaveRequest(id: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("staff_id", user.id)
    .eq("status", "pending");
  revalidatePath("/holiday");
}

export async function cancelLieuRequest(id: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("lieu_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("staff_id", user.id)
    .eq("status", "pending");
  revalidatePath("/holiday");
}
