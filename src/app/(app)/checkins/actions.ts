"use server";

import { revalidatePath } from "next/cache";
import { requireCheckinsAccess } from "@/lib/auth";
import { nextUkMidnight } from "@/lib/format";

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

export async function editCheckinItemAction(formData: FormData) {
  const { supabase } = await requireCheckinsAccess();

  const itemId = String(formData.get("item_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!itemId || !title) {
    return;
  }

  const { error } = await supabase
    .from("checkin_items")
    .update({ title, notes: notes || null })
    .eq("id", itemId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/checkins");
}

// A recurring item: this week's discussion is filed away complete, with its
// own outcome, and a fresh copy is raised for next time. Two records rather
// than one rolling item, so each week's discussion keeps its own outcome
// instead of being overwritten.
//
// The copy is parked until tomorrow so it doesn't reappear mid-meeting and
// get talked about twice — it shows greyed out until then rather than
// vanishing. carried_count travels with it, so you can see at a glance that
// something has been coming back week after week.
export async function markDiscussedRecurringAction(formData: FormData) {
  const { supabase, user, profile } = await requireCheckinsAccess();

  const itemId = String(formData.get("item_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "").trim();
  if (!itemId) {
    return;
  }

  const { data: original } = await supabase
    .from("checkin_items")
    .select("*")
    .eq("id", itemId)
    .single<{ group_id: string; title: string; notes: string | null; carried_count: number }>();
  if (!original) {
    throw new Error("That item no longer exists.");
  }

  const now = new Date().toISOString();

  const { error: closeError } = await supabase
    .from("checkin_items")
    .update({
      discussed: true,
      discussed_at: now,
      discussed_by: user.id,
      discussed_by_name: profile.full_name,
      outcome: outcome || null,
    })
    .eq("id", itemId);
  if (closeError) {
    throw new Error(closeError.message);
  }

  const { error: copyError } = await supabase.from("checkin_items").insert({
    group_id: original.group_id,
    title: original.title,
    notes: original.notes,
    created_by: user.id,
    created_by_name: profile.full_name,
    deferred_until: nextUkMidnight().toISOString(),
    carried_count: (original.carried_count ?? 0) + 1,
    last_carried_at: now,
  });
  if (copyError) {
    throw new Error(copyError.message);
  }

  revalidatePath("/checkins");
}

// Pull next time's copy straight back into view, for the "actually, while
// we're here" moment.
export async function unCarryCheckinItemAction(itemId: string) {
  const { supabase } = await requireCheckinsAccess();
  const { error } = await supabase
    .from("checkin_items")
    .update({ deferred_until: null })
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
