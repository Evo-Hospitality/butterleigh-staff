"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { deleteSocialPhotos } from "@/lib/social-photos/photos";
import { createAdminClient } from "@/lib/supabase/admin";

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
