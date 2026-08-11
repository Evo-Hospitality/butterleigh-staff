"use server";

import { redirect } from "next/navigation";
import { requireAdmin, requireEventsManage } from "@/lib/auth";
import { notifySuggestionDecided } from "@/lib/events/notifications";
import { deleteEventPhotos } from "@/lib/events/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventSuggestion } from "@/lib/types";

function fail(id: string, message: string): never {
  redirect(`/events/${id}?error=${encodeURIComponent(message)}`);
}

export async function decideAction(
  suggestionId: string,
  status: "approved" | "declined",
  formData: FormData,
) {
  const { supabase, profile } = await requireEventsManage();

  const note = String(formData.get("note") ?? "").trim();

  const { data: suggestion } = await supabase
    .from("event_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single<EventSuggestion>();
  if (!suggestion) {
    fail(suggestionId, "Suggestion not found.");
  }

  const { error } = await supabase
    .from("event_suggestions")
    .update({
      status,
      decided_by: profile.id,
      decided_by_name: profile.full_name,
      decision_note: note || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);
  if (error) {
    fail(suggestionId, error.message);
  }

  if (suggestion.submitted_by) {
    await notifySuggestionDecided(
      suggestion.submitted_by,
      suggestionId,
      suggestion.title,
      status,
      profile.full_name,
      note || null,
    );
  }

  redirect(`/events/${suggestionId}`);
}

// Admin-only. Uses the service-role client so it can also remove the
// photos from storage, which regular RLS-scoped sessions have no delete
// policy for — same pattern as Maintenance's deleteRequestAction, except
// not restricted to any particular status (an idea board has no "still
// active work" to protect the way an open maintenance request does).
export async function deleteSuggestionAction(suggestionId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("event_suggestion_photos")
    .select("url")
    .eq("suggestion_id", suggestionId);

  if (photos && photos.length > 0) {
    await deleteEventPhotos(photos.map((p) => p.url));
  }

  const { error } = await admin.from("event_suggestions").delete().eq("id", suggestionId);
  if (error) {
    fail(suggestionId, error.message);
  }

  redirect("/events");
}
