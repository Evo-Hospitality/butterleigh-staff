"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { insertPhotos } from "@/lib/events/photos";
import { findDuplicateId, readSubmissionToken } from "@/lib/submission-token";

function fail(message: string): never {
  redirect(`/events/new?error=${encodeURIComponent(message)}`);
}

export async function createSuggestionAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const description = formData.get("description");
  const photosJson = String(formData.get("photos_json") ?? "[]");
  const submissionToken = readSubmissionToken(formData);
  if (!title) {
    fail("Give your idea a title.");
  }

  const { data: suggestion, error } = await supabase
    .from("event_suggestions")
    .insert({
      title,
      description: description ? String(description) : null,
      submitted_by: user.id,
      submitted_by_name: profile.full_name,
      status: "pending",
      submission_token: submissionToken,
    })
    .select()
    .single();

  // Second press: the first one already created it (and attached its
  // photos), so go straight there rather than inserting the photos twice.
  const duplicateId = await findDuplicateId(supabase, "event_suggestions", error, submissionToken);
  if (duplicateId) {
    redirect(`/events/${duplicateId}`);
  }

  if (error || !suggestion) {
    fail(error?.message ?? "Failed to submit your idea.");
  }

  try {
    await insertPhotos(supabase, suggestion.id, photosJson);
  } catch (err) {
    fail(err instanceof Error ? err.message : "Failed to save photos.");
  }

  redirect(`/events/${suggestion.id}`);
}
