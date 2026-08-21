"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMaintenanceAccess } from "@/lib/auth";

export async function editMaintenanceRequestAction(requestId: string, formData: FormData) {
  const { supabase } = await requireMaintenanceAccess();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  // The RPC does the authorization, the open-status check, and writes the
  // log entry — all in one transaction.
  const { error } = await supabase.rpc("edit_maintenance_request", {
    p_request_id: requestId,
    p_title: title,
    p_description: description || null,
  });

  if (error) {
    redirect(`/maintenance/${requestId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/maintenance/${requestId}`);
  revalidatePath("/maintenance");
  redirect(`/maintenance/${requestId}`);
}
