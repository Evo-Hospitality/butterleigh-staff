"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { insertPhotos } from "@/lib/social-photos/photos";
import { notifyPostSubmitted } from "@/lib/social-photos/notifications";
import { findDuplicateId, readSubmissionToken } from "@/lib/submission-token";

function fail(message: string): never {
  redirect(`/social-photos/new?error=${encodeURIComponent(message)}`);
}

export async function createPostAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const caption = formData.get("caption");
  const photosJson = String(formData.get("photos_json") ?? "[]");
  const submissionToken = readSubmissionToken(formData);

  const { data: post, error } = await supabase
    .from("social_photo_posts")
    .insert({
      submitted_by: user.id,
      submitted_by_name: profile.full_name,
      caption: caption ? String(caption).trim() || null : null,
      submission_token: submissionToken,
    })
    .select()
    .single();

  // Second press: the first already created the post, attached its photos
  // and emailed the reviewer — don't do any of it twice.
  const duplicateId = await findDuplicateId(supabase, "social_photo_posts", error, submissionToken);
  if (duplicateId) {
    redirect("/social-photos");
  }

  if (error || !post) {
    fail(error?.message ?? "Failed to submit your photos.");
  }

  let photoCount = 0;
  try {
    const parsed = JSON.parse(photosJson) as unknown[];
    photoCount = Array.isArray(parsed) ? parsed.length : 0;
    await insertPhotos(supabase, post.id, user.id, profile.full_name, photosJson);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Failed to save photos.");
  }

  const { data: settings } = await supabase.from("settings").select("social_photos_reviewer_id").single();
  await notifyPostSubmitted(settings?.social_photos_reviewer_id ?? null, post.id, profile.full_name, photoCount);

  redirect("/social-photos");
}
