"use server";

import { redirect } from "next/navigation";
import { requireSopManage } from "@/lib/auth";
import { countBlocks, insertBlocks } from "@/lib/sops/blocks";
import { notifySopAnswered } from "@/lib/sops/notifications";
import type { SopEntry } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/sops/${id}?error=${encodeURIComponent(message)}`);
}

// Publishes an entry — whether it's answering a question for the first
// time, publishing a draft, or saving changes to an already-published one.
// Only emails the asker the first time it goes live, not on every edit.
export async function publishAction(entryId: string, formData: FormData) {
  const { supabase, profile } = await requireSopManage();

  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  if (!title) {
    fail(entryId, "Give it a title.");
  }
  let blockCount: number;
  try {
    blockCount = countBlocks(blocksJson);
  } catch (err) {
    fail(entryId, err instanceof Error ? err.message : "Malformed answer content.");
  }
  if (blockCount === 0) {
    fail(entryId, "Add at least one block before publishing.");
  }

  const { data: entry } = await supabase
    .from("sop_entries")
    .select("*")
    .eq("id", entryId)
    .single<SopEntry>();
  if (!entry) {
    fail(entryId, "Entry not found.");
  }
  const wasAlreadyPublished = entry.status === "answered";

  const { error: updateErr } = await supabase
    .from("sop_entries")
    .update({
      title,
      status: "answered",
      answered_by: profile.id,
      answered_by_name: profile.full_name,
      answered_at: new Date().toISOString(),
    })
    .eq("id", entryId);
  if (updateErr) {
    fail(entryId, updateErr.message);
  }

  const { error: deleteErr } = await supabase.from("sop_blocks").delete().eq("entry_id", entryId);
  if (deleteErr) {
    fail(entryId, deleteErr.message);
  }
  try {
    await insertBlocks(supabase, entryId, blocksJson);
  } catch (err) {
    fail(entryId, err instanceof Error ? err.message : "Failed to save content.");
  }

  if (entry.asked_by && !wasAlreadyPublished) {
    await notifySopAnswered(entry.asked_by, entryId, title, profile.full_name);
  }

  redirect(`/sops/${entryId}`);
}

// Saves progress without publishing — works from any prior status,
// including pulling an already-published entry back to draft while it's
// being reworked.
export async function saveDraftAction(entryId: string, formData: FormData) {
  const { supabase } = await requireSopManage();

  const title = String(formData.get("title") ?? "").trim();
  const blocksJson = String(formData.get("blocks_json") ?? "[]");
  if (!title) {
    fail(entryId, "Give it a title.");
  }

  const { error: updateErr } = await supabase
    .from("sop_entries")
    .update({ title, status: "draft" })
    .eq("id", entryId);
  if (updateErr) {
    fail(entryId, updateErr.message);
  }

  const { error: deleteErr } = await supabase.from("sop_blocks").delete().eq("entry_id", entryId);
  if (deleteErr) {
    fail(entryId, deleteErr.message);
  }
  try {
    await insertBlocks(supabase, entryId, blocksJson);
  } catch (err) {
    fail(entryId, err instanceof Error ? err.message : "Failed to save content.");
  }

  redirect(`/sops/${entryId}`);
}
