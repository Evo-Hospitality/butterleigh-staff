import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManagerOrAdmin, type EventSuggestion, type EventSuggestionPhoto } from "@/lib/types";
import { decideAction } from "./actions";

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "approved"
      ? "bg-green-100 text-green-800"
      : status === "declined"
        ? "bg-red-100 text-red-800"
        : "bg-yellow-100 text-yellow-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>{status}</span>;
}

export default async function EventSuggestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, profile } = await requireUser();

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

  const canManage = isManagerOrAdmin(profile);
  const approveAction = decideAction.bind(null, id, "approved");
  const declineAction = decideAction.bind(null, id, "declined");

  return (
    <div>
      <Link href="/events" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Events
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary">{suggestion.title}</h1>
        <StatusBadge status={suggestion.status} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Suggested by {suggestion.submitted_by_name} · {new Date(suggestion.created_at).toLocaleDateString()}
      </p>

      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {suggestion.description && (
        <p className="mb-4 max-w-lg whitespace-pre-wrap text-sm">{suggestion.description}</p>
      )}

      {(photos ?? []).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4">
          {(photos ?? []).map((p) => (
            <figure key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="max-w-xs rounded-lg border border-border" />
              {p.caption && <figcaption className="mt-1 text-sm text-muted-foreground">{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {suggestion.status !== "pending" && (
        <div className="mb-6 max-w-lg rounded-md border border-border bg-muted p-4 text-sm">
          <p className="font-medium">
            {suggestion.status === "approved" ? "Approved" : "Declined"} by {suggestion.decided_by_name}
            {suggestion.decided_at && ` · ${new Date(suggestion.decided_at).toLocaleDateString()}`}
          </p>
          {suggestion.decision_note && <p className="mt-1 text-muted-foreground">{suggestion.decision_note}</p>}
        </div>
      )}

      {canManage && suggestion.status === "pending" && (
        <div className="flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-muted p-4">
          <form action={approveAction} className="flex flex-col gap-2">
            <label className="text-sm font-medium">Approve</label>
            <textarea
              name="note"
              rows={2}
              placeholder="Note (optional) — e.g. when it'll run"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Approve
            </button>
          </form>

          <form action={declineAction} className="flex flex-col gap-2 border-t border-border pt-4">
            <label className="text-sm font-medium">Decline</label>
            <textarea
              name="note"
              rows={2}
              placeholder="Note (optional) — e.g. why not"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-md border border-border bg-white px-4 py-2 text-sm font-medium hover:border-accent"
            >
              Decline
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
