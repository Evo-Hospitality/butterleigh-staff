"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { insertPhotos } from "@/lib/social-photos/photos";
import { notifyPostSubmitted } from "@/lib/social-photos/notifications";

function fail(message: string): never {
  redirect(`/social-photos/new?error=${encodeURIComponent(message)}`);
}

export async function createPostAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const caption = formData.get("caption");
  const photosJson = String(formData.get("photos_json") ?? "[]");

  const { data: post, error } = await supabase
    .from("social_photo_posts")
    .insert({
      submitted_by: user.id,
      submitted_by_name: profile.full_name,
      caption: caption ? String(caption).trim() || null : null,
    })
    .select()
    .single();

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
