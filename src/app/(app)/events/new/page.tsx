import { requireUser } from "@/lib/auth";
import { EventSuggestionForm } from "@/components/event-suggestion-form";
import { createSuggestionAction } from "./actions";

export default async function NewEventSuggestionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Suggest an event idea</h1>
      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <EventSuggestionForm action={createSuggestionAction} />
    </div>
  );
}
