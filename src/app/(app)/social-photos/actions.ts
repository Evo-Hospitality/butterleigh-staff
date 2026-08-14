"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

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
