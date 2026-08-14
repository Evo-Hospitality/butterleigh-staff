"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireActionItemsAccess } from "@/lib/auth";
import { notifyActionUpdate, notifyActionAssigned } from "@/lib/action-items/notifications";
import { deleteActionPhoto } from "@/lib/action-items/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionItem } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/actions/${id}?error=${encodeURIComponent(message)}`);
}

export async function addNoteAction(actionId: string, formData: FormData) {
  const { supabase, profile } = await requireActionItemsAccess();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) {
    fail(actionId, "Enter a note.");
  }

  const { data: action } = await supabase
    .from("action_items")
    .select("*")
    .eq("id", actionId)
    .single<ActionItem>();
  if (!action) {
    fail(actionId, "Action not found.");
  }

  const { error } = await supabase.from("action_item_updates").insert({
    action_id: actionId,
    author_id: profile.id,
    author_name: profile.full_name,
    kind: "note",
    note,
  });
  if (error) {
    fail(actionId, "You don't have permission to update this Action.");
  }

  if (action.submitted_by) {
    await notifyActionUpdate(action.submitted_by, actionId, action.title, profile.full_name, note);
  }
  revalidatePath(`/actions/${actionId}`);
}

export async function reassignAction(actionId: string, formData: FormData) {
  const { supabase, profile } = await requireActionItemsAccess();
  const newAssigneeId = String(formData.get("assigned_to") ?? "");
  if (!newAssigneeId) {
    fail(actionId, "Choose someone to reassign to.");
  }

  const { data: action } = await supabase
    .from("action_items")
    .select("*")
    .eq("id", actionId)
    .single<ActionItem>();
  if (!action) {
    fail(actionId, "Action not found.");
  }

  const { data: newAssignee } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", newAssigneeId)
    .single();
  if (!newAssignee) {
    fail(actionId, "Could not find that person.");
  }

  // Goes through an RPC rather than a direct client-side UPDATE — see
  // 0019_reassign_action_item_rpc.sql for why. Also inserts the
  // "reassigned" log entry atomically.
  const { error } = await supabase.rpc("reassign_action_item", {
    p_action_id: actionId,
    p_new_assignee_id: newAssignee.id,
  });
  if (error) {
    fail(actionId, error.message || "You don't have permission to reassign this Action.");
  }

  const note = `Reassigned from ${action.assigned_to_name} to ${newAssignee.full_name}`;

  if (action.submitted_by) {
    await notifyActionUpdate(action.submitted_by, actionId, action.title, profile.full_name, note);
  }
  await notifyActionAssigned(newAssignee.id, actionId, action.title, profile.full_name);

  revalidatePath(`/actions/${actionId}`);
}

export async function setStatusAction(actionId: string, status: "open" | "closed") {
  const { supabase, profile } = await requireActionItemsAccess();

  const { data: action } = await supabase
    .from("action_items")
    .select("*")
    .eq("id", actionId)
    .single<ActionItem>();
  if (!action) {
    fail(actionId, "Action not found.");
  }

  const { error } = await supabase
    .from("action_items")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", actionId)
    .select()
    .single();
  if (error) {
    fail(actionId, "You don't have permission to update this Action.");
  }

  const note = status === "closed" ? "Marked as complete" : "Reopened";
  await supabase.from("action_item_updates").insert({
    action_id: actionId,
    author_id: profile.id,
    author_name: profile.full_name,
    kind: "status_changed",
    note,
  });

  if (action.submitted_by) {
    await notifyActionUpdate(action.submitted_by, actionId, action.title, profile.full_name, note);
  }
  revalidatePath(`/actions/${actionId}`);
}

// Admin-only, and only for closed Actions — uses the service-role client so
// it can also remove the photo from storage, which regular RLS-scoped
// sessions have no delete policy for.
export async function deleteActionAction(actionId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("action_items")
    .select("*")
    .eq("id", actionId)
    .single<ActionItem>();
  if (!action) {
    fail(actionId, "Action not found.");
  }
  if (action.status !== "closed") {
    fail(actionId, "Only closed Actions can be deleted.");
  }

  if (action.photo_url) {
    await deleteActionPhoto(action.photo_url);
  }

  const { error } = await admin.from("action_items").delete().eq("id", actionId);
  if (error) {
    fail(actionId, error.message);
  }

  redirect("/actions");
}
