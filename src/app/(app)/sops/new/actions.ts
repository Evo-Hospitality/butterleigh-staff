"use server";

import { redirect } from "next/navigation";
import { requireSopManage } from "@/lib/auth";
import { insertBlocks } from "@/lib/sops/blocks";

function fail(message: string): never {
  redirect(`/sops/new?error=${encodeURIComponent(message)}`);
}

export async function publishAction(formData: FormData) {
  const { supabase, profile } = await requireSopManage();

  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  if (!title) {
    fail("Give it a title.");
  }

  const { data: entry, error } = await supabase
    .from("sop_entries")
    .insert({
      title,
      asked_by: null,
      asked_by_name: null,
      status: "answered",
      answered_by: profile.id,
      answered_by_name: profile.full_name,
      answered_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !entry) {
    fail(error?.message ?? "Failed to create this entry.");
  }

  try {
    await insertBlocks(supabase, entry.id, blocksJson);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Failed to save content.");
  }

  redirect(`/sops/${entry.id}`);
}
