"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireMaintenanceAccess } from "@/lib/auth";
import { notifyMaintenanceUpdate, notifyMaintenanceAssigned } from "@/lib/maintenance/notifications";
import { deleteMaintenancePhoto } from "@/lib/maintenance/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaintenanceRequest } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/maintenance/${id}?error=${encodeURIComponent(message)}`);
}

export async function addNoteAction(requestId: string, formData: FormData) {
  const { supabase, profile } = await requireMaintenanceAccess();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) {
    fail(requestId, "Enter a note.");
  }

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .single<MaintenanceRequest>();
  if (!request) {
    fail(requestId, "Request not found.");
  }

  const { error } = await supabase.from("maintenance_updates").insert({
    request_id: requestId,
    author_id: profile.id,
    author_name: profile.full_name,
    kind: "note",
    note,
  });
  if (error) {
    fail(requestId, "You don't have permission to update this request.");
  }

  if (request.submitted_by) {
    await notifyMaintenanceUpdate(request.submitted_by, requestId, request.title, profile.full_name, note);
  }
  revalidatePath(`/maintenance/${requestId}`);
}

export async function reassignAction(requestId: string, formData: FormData) {
  const { supabase, profile } = await requireMaintenanceAccess();
  const newAssigneeId = String(formData.get("assigned_to") ?? "");
  if (!newAssigneeId) {
    fail(requestId, "Choose someone to reassign to.");
  }

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .single<MaintenanceRequest>();
  if (!request) {
    fail(requestId, "Request not found.");
  }

  // Admin client — the acting user's own RLS-scoped session can't
  // necessarily read the new assignee's profile if they're not a direct
  // report.
  const admin = createAdminClient();
  const { data: newAssignee } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", newAssigneeId)
    .single();
  if (!newAssignee) {
    fail(requestId, "Could not find that person.");
  }

  // Goes through an RPC rather than a direct client-side UPDATE — a plain
  // RLS UPDATE changing assigned_to (the same column
  // maintenance_requests_update's USING clause checks) fails unreliably
  // for non-admin managers specifically (see
  // 0020_reassign_maintenance_request_rpc.sql). Also inserts the
  // "reassigned" log entry atomically.
  const { error } = await supabase.rpc("reassign_maintenance_request", {
    p_request_id: requestId,
    p_new_assignee_id: newAssignee.id,
  });
  if (error) {
    fail(requestId, error.message || "You don't have permission to reassign this request.");
  }

  const note = `Reassigned from ${request.assigned_to_name} to ${newAssignee.full_name}`;

  if (request.submitted_by) {
    await notifyMaintenanceUpdate(request.submitted_by, requestId, request.title, profile.full_name, note);
  }
  await notifyMaintenanceAssigned(newAssignee.id, requestId, request.title, profile.full_name);

  revalidatePath(`/maintenance/${requestId}`);
}

export async function setStatusAction(requestId: string, status: "open" | "closed") {
  const { supabase, profile } = await requireMaintenanceAccess();

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .single<MaintenanceRequest>();
  if (!request) {
    fail(requestId, "Request not found.");
  }

  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", requestId)
    .select()
    .single();
  if (error) {
    fail(requestId, "You don't have permission to update this request.");
  }

  const note = status === "closed" ? "Marked as complete" : "Reopened";
  await supabase.from("maintenance_updates").insert({
    request_id: requestId,
    author_id: profile.id,
    author_name: profile.full_name,
    kind: "status_changed",
    note,
  });

  if (request.submitted_by) {
    await notifyMaintenanceUpdate(request.submitted_by, requestId, request.title, profile.full_name, note);
  }

  revalidatePath(`/maintenance/${requestId}`);
  revalidatePath("/maintenance");

  // Matches Actions: closing sends you back to the list, reopening keeps
  // you here since you're presumably about to work on it.
  if (status === "closed") {
    redirect("/maintenance");
  }
}

// Admin-only, and only for closed requests — uses the service-role client so
// it can also remove the photo from storage, which regular RLS-scoped
// sessions have no delete policy for.
export async function deleteRequestAction(requestId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .single<MaintenanceRequest>();
  if (!request) {
    fail(requestId, "Request not found.");
  }
  if (request.status !== "closed") {
    fail(requestId, "Only closed requests can be deleted.");
  }

  if (request.photo_url) {
    await deleteMaintenancePhoto(request.photo_url);
  }

  const { error } = await admin.from("maintenance_requests").delete().eq("id", requestId);
  if (error) {
    fail(requestId, error.message);
  }

  redirect("/maintenance");
}
