"use server";

import { redirect } from "next/navigation";
import { requireMaintenanceAccess } from "@/lib/auth";
import { resolveDefaultAssignee } from "@/lib/maintenance/routing";
import { uploadMaintenancePhoto } from "@/lib/maintenance/storage";
import { notifyMaintenanceAssigned } from "@/lib/maintenance/notifications";

function fail(message: string): never {
  redirect(`/maintenance/new?error=${encodeURIComponent(message)}`);
}

export async function createMaintenanceRequestAction(formData: FormData) {
  const { supabase, user, profile } = await requireMaintenanceAccess();

  const title = String(formData.get("title") ?? "").trim();
  const description = formData.get("description");
  const assignedToId = formData.get("assigned_to");
  const photo = formData.get("photo");

  if (!title) {
    fail("Give the issue a short title.");
  }

  let assignee: { id: string; name: string };
  if (profile.role === "admin") {
    if (!assignedToId) {
      fail("Choose who to assign this to.");
    }
    const { data: chosen } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", String(assignedToId))
      .single();
    if (!chosen) {
      fail("Could not find that person.");
    }
    assignee = { id: chosen.id, name: chosen.full_name };
  } else {
    try {
      assignee = await resolveDefaultAssignee();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to route this request.");
    }
  }

  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadMaintenancePhoto(supabase, photo);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to upload photo.");
    }
  }

  const { data: request, error } = await supabase
    .from("maintenance_requests")
    .insert({
      submitted_by: user.id,
      submitted_by_name: profile.full_name,
      assigned_to: assignee.id,
      assigned_to_name: assignee.name,
      title,
      description: description ? String(description) : null,
      photo_url: photoUrl,
    })
    .select()
    .single();

  if (error || !request) {
    fail(error?.message ?? "Failed to create request.");
  }

  await notifyMaintenanceAssigned(assignee.id, request.id, title, profile.full_name);

  redirect(`/maintenance/${request.id}`);
}
