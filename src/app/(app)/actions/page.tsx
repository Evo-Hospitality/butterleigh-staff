import Link from "next/link";
import { requireActionItemsAccess } from "@/lib/auth";
import type { ActionItem } from "@/lib/types";

function ActionTable({ items, empty, showClosedDate }: { items: ActionItem[]; empty: string; showClosedDate?: boolean }) {
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
  const { supabase } = await requireActionItemsAccess();

  // RLS already scopes this to Actions where the caller is the submitter,
  // the assignee, or an admin — no further filtering needed here.
  const { data: items } = await supabase
    .from("action_items")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ActionItem[]>();

  const open = (items ?? []).filter((a) => a.status === "open");
  const closed = (items ?? []).filter((a) => a.status === "closed");

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

      <h2 className="mb-3 text-lg font-bold text-primary">Open</h2>
      <div className="mb-8">
        <ActionTable items={open} empty="Nothing open right now." />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Closed</h2>
      <ActionTable items={closed} empty="No closed Actions yet." showClosedDate />
    </div>
  );
}
