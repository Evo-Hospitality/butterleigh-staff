import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { EventSuggestion } from "@/lib/types";
import { formatDate } from "@/lib/format";

function SuggestionList({ suggestions, empty }: { suggestions: EventSuggestion[]; empty: string }) {
  if (suggestions.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {suggestions.map((s) => (
        <Link
          key={s.id}
          href={`/events/${s.id}`}
          className="rounded-lg border border-border bg-background p-4 hover:border-accent"
        >
          <p className="font-medium text-primary">{s.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Suggested by {s.submitted_by_name} · {formatDate(s.created_at)}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default async function EventsPage() {
  const { supabase } = await requireUser();

  const { data: suggestions } = await supabase
    .from("event_suggestions")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<EventSuggestion[]>();

  const all = suggestions ?? [];
  const pending = all.filter((s) => s.status === "pending");
  const approved = all.filter((s) => s.status === "approved");
  const declined = all.filter((s) => s.status === "declined");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Event ideas</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Suggest an idea
        </Link>
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Pending</h2>
      <div className="mb-8">
        <SuggestionList suggestions={pending} empty="Nothing pending right now." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Approved</h2>
      <div className="mb-8">
        <SuggestionList suggestions={approved} empty="No approved ideas yet." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Declined</h2>
      <SuggestionList suggestions={declined} empty="No declined ideas." />
    </div>
  );
}
