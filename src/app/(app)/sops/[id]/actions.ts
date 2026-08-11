"use server";

import { redirect } from "next/navigation";
import { requireSopManage } from "@/lib/auth";
import { insertBlocks } from "@/lib/sops/blocks";
import { notifySopAnswered } from "@/lib/sops/notifications";
import type { SopEntry } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/sops/${id}?error=${encodeURIComponent(message)}`);
}

export async function answerAction(entryId: string, formData: FormData) {
  const { supabase, profile } = await requireSopManage();

  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  if (!title) {
    fail(entryId, "Give it a title.");
  }

  const { data: entry } = await supabase
    .from("sop_entries")
    .select("*")
    .eq("id", entryId)
    .single<SopEntry>();
  if (!entry) {
    fail(entryId, "Question not found.");
  }

  const { error } = await supabase
    .from("sop_entries")
    .update({
      title,
      status: "answered",
      answered_by: profile.id,
      answered_by_name: profile.full_name,
      answered_at: new Date().toISOString(),
    })
    .eq("id", entryId);
  if (error) {
    fail(entryId, error.message);
  }

  try {
    await insertBlocks(supabase, entryId, blocksJson);
  } catch (err) {
    fail(entryId, err instanceof Error ? err.message : "Failed to save content.");
  }

  if (entry.asked_by) {
    await notifySopAnswered(entry.asked_by, entryId, title, profile.full_name);
  }

  redirect(`/sops/${entryId}`);
}
