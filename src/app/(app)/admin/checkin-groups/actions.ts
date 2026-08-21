"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

function refresh() {
  revalidatePath("/admin/checkin-groups");
  revalidatePath("/checkins");
}

export async function addCheckinGroupAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: last } = await supabase
    .from("checkin_groups")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("checkin_groups")
    .insert({ name, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) throw new Error(error.message);
  refresh();
}

export async function renameCheckinGroupAction(groupId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { error } = await supabase.from("checkin_groups").update({ name }).eq("id", groupId);
  if (error) throw new Error(error.message);
  refresh();
}

// Swaps sort_order with the neighbour in the given direction — simpler and
// more predictable than drag-and-drop for a list this short.
export async function moveCheckinGroupAction(groupId: string, direction: "up" | "down") {
  const { supabase } = await requireAdmin();

  const { data: groups } = await supabase
    .from("checkin_groups")
    .select("id, sort_order")
    .order("sort_order");
  if (!groups) return;

  const index = groups.findIndex((g) => g.id === groupId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= groups.length) return;

  const a = groups[index];
  const b = groups[swapWith];
  await supabase.from("checkin_groups").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("checkin_groups").update({ sort_order: a.sort_order }).eq("id", b.id);
  refresh();
}

// Archive rather than delete once a group has anything against it — deleting
// would cascade its discussed items away, and those are the meeting record.
export async function setCheckinGroupActiveAction(groupId: string, active: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("checkin_groups").update({ active }).eq("id", groupId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteCheckinGroupAction(groupId: string) {
  const { supabase } = await requireAdmin();

  const { count } = await supabase
    .from("checkin_items")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  if ((count ?? 0) > 0) {
    throw new Error("That group has items against it — archive it instead so the record is kept.");
  }

  const { error } = await supabase.from("checkin_groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
  refresh();
}
