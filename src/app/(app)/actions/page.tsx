"use client";

import Link from "next/link";
import { useMe } from "@/lib/client/me";
import { CollapsibleSection } from "@/components/collapsible-section";
import type { ActionItem, ActionItemUpdateEntry } from "@/lib/types";
import Loading from "../loading";
import { useActionsView } from "./data";
import { formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { WorkStatusBadge } from "@/components/work-status-badge";
import { moveActionToTaskAction } from "./move-actions";

function ActionTable({
  items,
  empty,
  showClosedDate,
  showInProgress,
  latestUpdates,
}: {
  items: ActionItem[];
  empty: string;
  showClosedDate?: boolean;
  // Tag started ones — for "Open actions for me", which mixes both.
  showInProgress?: boolean;
  latestUpdates?: Record<string, Pick<ActionItemUpdateEntry, "author_name" | "note">>;
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
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link href={`/actions/${a.id}`} className="font-medium hover:text-accent">
                  {a.title}
                </Link>
                {showInProgress && a.status === "in_progress" && (
                  <span className="ml-2 align-middle">
                    <WorkStatusBadge status={a.status} />
                  </span>
                )}
                {latestUpdates?.[a.id] && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                    {latestUpdates[a.id].author_name}: {latestUpdates[a.id].note}
                  </p>
                )}
              </td>
              <td className="px-4 py-2">{a.submitted_by_name}</td>
              <td className="px-4 py-2">{a.assigned_to_name}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {formatDate(showClosedDate ? (a.closed_at ?? a.created_at) : a.created_at)}
              </td>
              <td className="px-4 py-2 text-right">
                <ConfirmButton
                  action={moveActionToTaskAction.bind(null, a.id)}
                  label="Move to Tasks"
                  confirmMessage={`Move "${a.title}" to Tasks? Its log and any photo are kept as notes on the Task, and it stops being an Action.`}
                  className="whitespace-nowrap text-xs font-semibold text-accent hover:underline"
                />
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ActionsPage() {
  const { user } = useMe()!;
  const view = useActionsView("list");
  if (!view.data) return <Loading />;

  const { items, latestUpdates } = view.data;
  const open = items.filter((a) => a.status === "open");
  const inProgress = items.filter((a) => a.status === "in_progress");
  const closed = items.filter((a) => a.status === "closed");
  // Everything of yours not yet closed — started or not — pulled to the
  // top. They stay in their own sections below too; this is a shortcut to
  // what you owe, not a filter.
  const mine = [...open, ...inProgress].filter((a) => a.assigned_to === user.id);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Actions</h1>
        <Link
          href="/actions/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Raise an Action
        </Link>
      </div>

      {/* The other half of the same distinction, worded from this side so it
          reads the same whichever app you land in first. */}
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Actions are work between admins and managers, generally done away from the pub and picked
        up at the weekly managers&apos; meeting. Anything that needs doing at the pub during a
        shift — including chasing a supplier or checking figures — goes in{" "}
        <Link href="/tasks" className="font-medium text-accent hover:underline">
          Tasks
        </Link>{" "}
        instead.
      </p>

      {mine.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-primary">
            Open actions for me{" "}
            <span className="rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-white">
              {mine.length}
            </span>
          </h2>
          <div className="mb-8">
            <ActionTable items={mine} empty="Nothing assigned to you." latestUpdates={latestUpdates} showInProgress />
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-bold text-primary">Open</h2>
      <div className="mb-8">
        <ActionTable items={open} empty="Nothing waiting to be started." latestUpdates={latestUpdates} />
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">In progress</h2>
      <div className="mb-8">
        <ActionTable items={inProgress} empty="Nothing in progress." latestUpdates={latestUpdates} />
      </div>

      <CollapsibleSection title="Closed" count={closed.length}>
        <ActionTable items={closed} empty="No closed Actions yet." showClosedDate />
      </CollapsibleSection>
    </div>
  );
}
