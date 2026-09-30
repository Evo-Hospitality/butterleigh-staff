"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { deleteSocialPhotos } from "@/lib/social-photos/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPostComment } from "@/lib/social-photos/notifications";

function fail(message: string): never {
  redirect(`/social-photos?error=${encodeURIComponent(message)}`);
}

export async function toggleUsedAction(photoId: string, targetUsed: boolean) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("set_photo_used", { p_photo_id: photoId, p_used: targetUsed });
  if (error) {
    fail(error.message || "You don't have permission to do that.");
  }

  revalidatePath("/social-photos");
}

// Admin-only, no restriction on whether any of its photos are marked used —
// same as Events' deleteSuggestionAction. Uses the service-role client so
// it can also remove the photos from storage; social_photos rows cascade-
// delete with the post.
export async function deletePostAction(postId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: photos } = await admin.from("social_photos").select("url").eq("post_id", postId);

  if (photos && photos.length > 0) {
    await deleteSocialPhotos(photos.map((p) => p.url));
  }

  const { error } = await admin.from("social_photo_posts").delete().eq("id", postId);
  if (error) {
    fail(error.message);
  }

  revalidatePath("/social-photos");
}

export async function addCommentAction(postId: string, formData: FormData) {
  const { supabase, profile } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const submissionToken = String(formData.get("submission_token") ?? "") || null;
  if (!body) {
    fail("Write a comment first.");
  }
  if (body.length > 2000) {
    fail("Comments are limited to 2,000 characters.");
  }

  const [{ data: post }, { data: settings }] = await Promise.all([
    supabase.from("social_photo_posts").select("submitted_by, caption").eq("id", postId).maybeSingle(),
    supabase.from("settings").select("social_photos_reviewer_id").single(),
  ]);
  if (!post) {
    fail("That submission no longer exists.");
  }

  const { error } = await supabase.from("social_photo_comments").insert({
    post_id: postId,
    author_id: profile.id,
    author_name: profile.full_name,
    body,
    submission_token: submissionToken,
  });
  // 23505 = the same form sent twice; the first one already landed.
  if (error && error.code !== "23505") {
    fail("Couldn't save your comment.");
  }

  if (!error) {
    const recipient =
      post.submitted_by === profile.id ? (settings?.social_photos_reviewer_id ?? null) : post.submitted_by;
    await notifyPostComment(recipient, profile.id, profile.full_name, post.caption, body);
  }

  revalidatePath("/social-photos");
}

// RLS limits this to the author or an admin; anyone else's delete simply
// matches no rows.
export async function deleteCommentAction(commentId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("social_photo_comments").delete().eq("id", commentId);
  if (error) {
    fail("Couldn't delete that comment.");
  }
  revalidatePath("/social-photos");
}
