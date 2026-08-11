"use server";

import { redirect } from "next/navigation";
import { requireEventsManage } from "@/lib/auth";
import { notifySuggestionDecided } from "@/lib/events/notifications";
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
