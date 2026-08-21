import Link from "next/link";
import { requireCheckinsAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCheckinSummary, type SummaryLink } from "@/lib/checkins/summary";
import { partitionAgenda } from "@/lib/checkins/agenda";
import type { CheckinGroup, CheckinItem } from "@/lib/types";
import { CollapsibleSection } from "@/components/collapsible-section";
import { CheckinBoard, type BoardGroup } from "@/components/checkin-board";
import {
  addCheckinItemAction,
  deleteCheckinItemAction,
  editCheckinItemAction,
  markDiscussedAction,
  markDiscussedRecurringAction,
  reopenCheckinItemAction,
  unCarryCheckinItemAction,
} from "./actions";

const PHOTO_DAY_PRESETS = [7, 14, 30];

function SummaryList({ items, empty }: { items: SummaryLink[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => (
        <li key={i.id} className="text-sm">
          <Link href={i.href} className="font-medium hover:text-accent">
            {i.label}
          </Link>
          {i.meta && <span className="ml-2 text-xs text-muted-foreground">{i.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<{ photoDays?: string }>;
}) {
  const { supabase, profile } = await requireCheckinsAccess();
  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const photoDays = Math.max(1, Number(params.photoDays) || 7);

  const [summary, { data: groups }, { data: items }] = await Promise.all([
    buildCheckinSummary(supabase, createAdminClient(), photoDays, isAdmin),
    supabase
      .from("checkin_groups")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .returns<CheckinGroup[]>(),
    supabase.from("checkin_items").select("*").order("created_at").returns<CheckinItem[]>(),
  ]);

  // "Carried to next week" parks an item until UK midnight; anything whose
  // deferral has since passed is simply open again.
  const boardGroups: BoardGroup[] = partitionAgenda(groups ?? [], items ?? []);

  const sections: { key: keyof typeof summary; title: string; empty: string }[] = [
    // Admin-only, and first: both block someone — a new starter can't work
    // until they're approved, and an unapproved bank change means someone
    // isn't getting paid where they expect. Managers don't see these at all.
    ...(isAdmin
      ? [
          { key: "onboarding" as const, title: "New starters waiting for review", empty: "Nothing waiting." },
          { key: "bankChanges" as const, title: "Bank changes to approve", empty: "Nothing waiting." },
        ]
      : []),
    { key: "actions", title: "Open actions", empty: "Nothing open." },
    { key: "maintenance", title: "Open maintenance", empty: "Nothing open." },
    { key: "tasks", title: "Open tasks (management team)", empty: "Nothing outstanding." },
    { key: "holiday", title: "Holiday awaiting approval", empty: "Nothing waiting." },
    { key: "events", title: "Event ideas awaiting a decision", empty: "No new ideas." },
    { key: "photos", title: `Photo submissions (last ${photoDays} days)`, empty: "None submitted." },
  ];

  const totalOutstanding = sections.reduce((n, s) => n + summary[s.key].length, 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Overview</h1>
        <span className="text-sm text-muted-foreground">
          {totalOutstanding} {totalOutstanding === 1 ? "thing" : "things"} in flight
        </span>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        The working space for the weekly management meeting. What&apos;s outstanding across the
        other apps is gathered below, then the agenda. Everything here is org-wide, except Actions
        — those stay private to whoever raised or owns them, so you see only your own.
      </p>

      <div className="mb-8 flex flex-col gap-3">
        {sections.map((s) => (
          <div key={s.key} className="rounded-lg border border-border p-4">
            {/* Shut by default — the counts in the headers are the at-a-glance
                view, and you open only the section you're actually working
                through. */}
            <CollapsibleSection title={s.title} count={summary[s.key].length}>
              <SummaryList items={summary[s.key]} empty={s.empty} />
              {s.key === "photos" && (
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">Show last</span>
                  {PHOTO_DAY_PRESETS.map((d) => (
                    <a
                      key={d}
                      href={`/checkins?photoDays=${d}`}
                      className={`rounded-md border px-2 py-1 ${
                        d === photoDays
                          ? "border-accent bg-accent text-white"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      {d} days
                    </a>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        ))}
      </div>

      <CheckinBoard
        groups={boardGroups}
        addAction={addCheckinItemAction}
        tickAction={markDiscussedAction}
        carryAction={markDiscussedRecurringAction}
        unCarryAction={unCarryCheckinItemAction}
        editAction={editCheckinItemAction}
        untickAction={reopenCheckinItemAction}
        deleteAction={deleteCheckinItemAction}
      />
    </div>
  );
}
