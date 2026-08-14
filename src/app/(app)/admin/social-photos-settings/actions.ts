"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export async function saveReviewerAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const reviewerId = formData.get("social_photos_reviewer_id");

  const { error } = await supabase
    .from("settings")
    .update({ social_photos_reviewer_id: reviewerId ? String(reviewerId) : null })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/social-photos-settings");
}
