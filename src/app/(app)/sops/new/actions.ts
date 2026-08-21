"use server";

import { redirect } from "next/navigation";
import { requireSopManage } from "@/lib/auth";
import { countBlocks, insertBlocks } from "@/lib/sops/blocks";
import { findDuplicateId, readSubmissionToken } from "@/lib/submission-token";

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
  let blockCount: number;
  try {
    blockCount = countBlocks(blocksJson);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Malformed answer content.");
  }
  if (blockCount === 0) {
    fail("Add at least one block before publishing.");
  }

  const submissionToken = readSubmissionToken(formData);
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
      submission_token: submissionToken,
    })
    .select()
    .single();

  // Second press: the first already created the entry and its blocks.
  const duplicateId = await findDuplicateId(supabase, "sop_entries", error, submissionToken);
  if (duplicateId) {
    redirect(`/sops/${duplicateId}`);
  }

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

export async function saveDraftAction(formData: FormData) {
  const { supabase } = await requireSopManage();

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
      status: "draft",
    })
    .select()
    .single();

  if (error || !entry) {
    fail(error?.message ?? "Failed to save draft.");
  }

  try {
    await insertBlocks(supabase, entry.id, blocksJson);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Failed to save content.");
  }

  redirect(`/sops/${entry.id}`);
}
