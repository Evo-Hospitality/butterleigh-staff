"use server";

import { revalidatePath } from "next/cache";
import { requireSopManage } from "@/lib/auth";

// Pin or unpin an SOP at the top of the list — managers only (and RLS's
// sop_entries_update policy says the same).
export async function setPinnedAction(entryId: string, pinned: boolean) {
  const { supabase } = await requireSopManage();
  const { error } = await supabase
    .from("sop_entries")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", entryId);
  if (error) {
    throw new Error("Couldn't change the pin — please try again.");
  }
  revalidatePath("/sops");
}
