"use client";

import { PageError } from "@/components/page-error";
import { EventSuggestionForm } from "@/components/event-suggestion-form";
import { createSuggestionAction } from "./actions";

// Anyone signed in can suggest an idea — the app shell has already checked
// that — so there's nothing to load before drawing the form.
export default function NewEventSuggestionPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Suggest an event idea</h1>
      <PageError />
      <EventSuggestionForm action={createSuggestionAction} />
    </div>
  );
}
