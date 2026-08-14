"use server";

import { redirect } from "next/navigation";
import { requireActionItemsAccess } from "@/lib/auth";
import { uploadActionPhoto } from "@/lib/action-items/storage";
import { notifyActionAssigned } from "@/lib/action-items/notifications";

function fail(message: string): never {
  redirect(`/actions/new?error=${encodeURIComponent(message)}`);
}

export async function createActionAction(formData: FormData) {
  const { supabase, user, profile } = await requireActionItemsAccess();

  const title = String(formData.get("title") ?? "").trim();
  const notes = formData.get("notes");
  const assignedToId = formData.get("assigned_to");
  const photo = formData.get("photo");

  if (!title) {
    fail("Give it a short title.");
  }
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

  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await uploadActionPhoto(supabase, photo);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to upload photo.");
    }
  }

  const { data: action, error } = await supabase
    .from("action_items")
    .insert({
      submitted_by: user.id,
      submitted_by_name: profile.full_name,
      assigned_to: chosen.id,
      assigned_to_name: chosen.full_name,
      title,
      notes: notes ? String(notes) : null,
      photo_url: photoUrl,
    })
    .select()
    .single();

  if (error || !action) {
    fail(error?.message ?? "Failed to create this Action.");
  }

  await notifyActionAssigned(chosen.id, action.id, title, profile.full_name);

  redirect(`/actions/${action.id}`);
}
