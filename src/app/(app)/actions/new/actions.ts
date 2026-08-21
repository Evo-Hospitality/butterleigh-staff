"use server";

import { redirect } from "next/navigation";
import { requireActionItemsAccess } from "@/lib/auth";
import { isManagerOrAdmin } from "@/lib/types";
import { uploadActionPhoto } from "@/lib/action-items/storage";
import { notifyActionAssigned } from "@/lib/action-items/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): never {
  redirect(`/actions/new?error=${encodeURIComponent(message)}`);
}

// Shared by both submit buttons — returns the new (or, on a duplicate
// press, the already-created) Action's id and leaves the redirect to the
// caller, since that's the only thing the two paths differ on.
async function createAction(formData: FormData): Promise<string> {
  const { supabase, user, profile } = await requireActionItemsAccess();

  const title = String(formData.get("title") ?? "").trim();
  const notes = formData.get("notes");
  const assignedToId = formData.get("assigned_to");
  const photo = formData.get("photo");
  const submissionToken = String(formData.get("submission_token") ?? "") || null;

  if (!title) {
    fail("Give it a short title.");
  }
  if (!assignedToId) {
    fail("Choose who to assign this to.");
  }

  // Admin client — the same reasoning as the "Assign to" dropdown on the
  // form itself: a non-admin manager's own RLS-scoped session can't read
  // an arbitrary other manager/admin's profile, only their own reports.
  const admin = createAdminClient();
  const { data: chosen } = await admin.from("profiles").select("*").eq("id", String(assignedToId)).single();
  if (!chosen || !isManagerOrAdmin(chosen)) {
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
      submission_token: submissionToken,
    })
    .select()
    .single();

  // 23505 = unique violation on submission_token: this exact form was
  // already submitted (double-press, retry, second tab). The first press
  // did the work, so send them to that Action rather than erroring or
  // creating a second one.
  if (error?.code === "23505" && submissionToken) {
    const { data: existing } = await supabase
      .from("action_items")
      .select("id")
      .eq("submission_token", submissionToken)
      .maybeSingle();
    if (existing) {
      return existing.id;
    }
  }

  if (error || !action) {
    fail(error?.message ?? "Failed to create this Action.");
  }

  await notifyActionAssigned(chosen.id, action.id, title, profile.full_name);

  return action.id;
}

export async function createActionAction(formData: FormData) {
  const id = await createAction(formData);
  redirect(`/actions/${id}`);
}

// "Save & add another" — for entering a run of Actions in one sitting.
// Goes straight back to an empty form instead of the detail page, which
// also re-renders a fresh submission token.
export async function createActionAndAnotherAction(formData: FormData) {
  await createAction(formData);
  redirect("/actions/new?created=1");
}
