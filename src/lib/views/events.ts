import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManagerOrAdmin, type EventSuggestion, type EventSuggestionPhoto } from "@/lib/types";
import type { ViewMap } from "./types";

export const views = {
  // /events — every suggestion, split by status on the page.
  list: async () => {
    const { supabase } = await requireUser();

    const { data: suggestions } = await supabase
      .from("event_suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<EventSuggestion[]>();

    return { suggestions: suggestions ?? [] };
  },

  // /events/[id] — one suggestion, its photos and the decide panel.
  detail: async ({ id }) => {
    const { supabase, profile } = await requireUser();
    if (!id) notFound();

    const [{ data: suggestion }, { data: photos }] = await Promise.all([
      supabase.from("event_suggestions").select("*").eq("id", id).single<EventSuggestion>(),
      supabase
        .from("event_suggestion_photos")
        .select("*")
        .eq("suggestion_id", id)
        .order("sort_order")
        .returns<EventSuggestionPhoto[]>(),
    ]);

    if (!suggestion) {
      notFound();
    }

    return {
      suggestion,
      photos: photos ?? [],
      canManage: isManagerOrAdmin(profile),
      isAdmin: profile.role === "admin",
    };
  },
} satisfies ViewMap;
