"use server";

import { revalidatePath } from "next/cache";
import { requireCheckinsAccess } from "@/lib/auth";

export async function addCheckinItemAction(formData: FormData) {
  const { supabase, user, profile } = await requireCheckinsAccess();

  const groupId = String(formData.get("group_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!groupId || !title) {
    return;
  }

  const { error } = await supabase.from("checkin_items").insert({
    group_id: groupId,
    title,
    notes: notes || null,
    created_by: user.id,
    created_by_name: profile.full_name,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/checkins");
}

// Ticking off keeps the item and stamps who and when, so the Discussed
// section is a record rather than a bin.
export async function markDiscussedAction(formData: FormData) {
  const { supabase, user, profile } = await requireCheckinsAccess();

  const itemId = String(formData.get("item_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "").trim();
  if (!itemId) {
    return;
  }

  const { error } = await supabase
    .from("checkin_items")
    .update({
      discussed: true,
      discussed_at: new Date().toISOString(),
      discussed_by: user.id,
      discussed_by_name: profile.full_name,
      outcome: outcome || null,
    })
    .eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/checkins");
}

// For something ticked off too early — clears the stamp so it isn't left
// claiming to have been discussed when it wasn't finished.
export async function reopenCheckinItemAction(itemId: string) {
  const { supabase } = await requireCheckinsAccess();

  const { error } = await supabase
    .from("checkin_items")
    .update({ discussed: false, discussed_at: null, discussed_by: null, discussed_by_name: null })
    .eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/checkins");
}

export async function deleteCheckinItemAction(itemId: string) {
  const { supabase } = await requireCheckinsAccess();
  const { error } = await supabase.from("checkin_items").delete().eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/checkins");
}
