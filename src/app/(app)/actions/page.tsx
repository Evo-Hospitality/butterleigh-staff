import Link from "next/link";
import { requireActionItemsAccess } from "@/lib/auth";
import { CollapsibleSection } from "@/components/collapsible-section";
import type { ActionItem, ActionItemUpdateEntry } from "@/lib/types";

function ActionTable({
  items,
  empty,
  showClosedDate,
  latestUpdates,
}: {
  items: ActionItem[];
  empty: string;
  showClosedDate?: boolean;
  latestUpdates?: Map<string, ActionItemUpdateEntry>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Raised by</th>
            <th className="px-4 py-2 font-medium">Assigned to</th>
            <th className="px-4 py-2 font-medium">{showClosedDate ? "Closed" : "Raised"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link href={`/actions/${a.id}`} className="font-medium hover:text-accent">
                  {a.title}
                </Link>
                {latestUpdates?.has(a.id) && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                    {latestUpdates.get(a.id)!.author_name}: {latestUpdates.get(a.id)!.note}
                  </p>
                )}
              </td>
              <td className="px-4 py-2">{a.submitted_by_name}</td>
              <td className="px-4 py-2">{a.assigned_to_name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(showClosedDate ? (a.closed_at ?? a.created_at) : a.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function ActionsPage() {
  const { supabase, user } = await requireActionItemsAccess();

  // RLS already scopes this to Actions where the caller is the submitter,
  // the assignee, or an admin — no further filtering needed here.
  const { data: items } = await supabase
    .from("action_items")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ActionItem[]>();

  const open = (items ?? []).filter((a) => a.status === "open");
  const closed = (items ?? []).filter((a) => a.status === "closed");
  // Your own open Actions, pulled to the top. They stay in the full Open
  // list below too — this is a shortcut to what you owe, not a filter.
  const mine = open.filter((a) => a.assigned_to === user.id);

  const openIds = open.map((a) => a.id);
  const latestUpdates = new Map<string, ActionItemUpdateEntry>();
  if (openIds.length > 0) {
    const { data: updates } = await supabase
      .from("action_item_updates")
      .select("*")
      .in("action_id", openIds)
      .order("created_at", { ascending: false })
      .returns<ActionItemUpdateEntry[]>();
    for (const u of updates ?? []) {
      if (!latestUpdates.has(u.action_id)) {
        latestUpdates.set(u.action_id, u);
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Actions</h1>
        <Link
          href="/actions/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Raise an Action
        </Link>
      </div>

      {mine.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-primary">
            Open actions for me{" "}
            <span className="rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-white">
              {mine.length}
            </span>
          </h2>
          <div className="mb-8">
            <ActionTable items={mine} empty="Nothing assigned to you." latestUpdates={latestUpdates} />
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-bold text-primary">Open</h2>
      <div className="mb-8">
        <ActionTable items={open} empty="Nothing open right now." latestUpdates={latestUpdates} />
      </div>

      <CollapsibleSection title="Closed" count={closed.length}>
        <ActionTable items={closed} empty="No closed Actions yet." showClosedDate />
      </CollapsibleSection>
    </div>
  );
}
