"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActionItemsAccess } from "@/lib/auth";

export async function editActionAction(actionId: string, formData: FormData) {
  const { supabase } = await requireActionItemsAccess();

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  // The RPC does the authorization, the open-status check, and writes the
  // log entry — all in one transaction. Its exception messages are already
  // user-facing sentences.
  const { error } = await supabase.rpc("edit_action_item", {
    p_action_id: actionId,
    p_title: title,
    p_notes: notes || null,
  });

  if (error) {
    redirect(`/actions/${actionId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/actions/${actionId}`);
  revalidatePath("/actions");
  redirect(`/actions/${actionId}`);
}
