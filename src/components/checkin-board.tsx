"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { CheckinItem } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";

export type BoardGroup = { id: string; name: string; open: CheckinItem[]; discussed: CheckinItem[] };

function AddItemForm({ groupId, action }: { groupId: string; action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-sm font-medium text-accent hover:underline"
      >
        + Add item
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setOpen(false);
      }}
      className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-muted p-3"
    >
      <input type="hidden" name="group_id" value={groupId} />
      <input
        name="title"
        required
        autoFocus
        placeholder="What needs discussing?"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="notes"
        rows={2}
        placeholder="Any detail (optional)"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemRow({
  item,
  tickAction,
  deleteAction,
}: {
  item: CheckinItem;
  tickAction: (formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          {item.notes && <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Raised by {item.created_by_name} · {formatDate(item.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setCapturing((c) => !c)}
            className="rounded-md border border-border bg-white px-3 py-1 text-sm font-medium hover:border-accent"
          >
            Discussed
          </button>
          <form
            action={deleteAction.bind(null, item.id)}
            onSubmit={(e) => {
              if (!confirm(`Delete "${item.title}"? Use Discussed instead if it was covered — that keeps it on record.`)) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-border bg-white px-2 py-1 text-sm text-muted-foreground hover:border-red-300 hover:text-red-700"
              aria-label={`Delete ${item.title}`}
            >
              &times;
            </button>
          </form>
        </div>
      </div>

      {capturing && (
        <form action={tickAction} className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
          <input type="hidden" name="item_id" value={item.id} />
          <textarea
            name="outcome"
            rows={2}
            autoFocus
            placeholder="What was decided? (optional — leave blank if there's nothing to record)"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Mark discussed
            </button>
            <button
              type="button"
              onClick={() => setCapturing(false)}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

export function CheckinBoard({
  groups,
  addAction,
  tickAction,
  untickAction,
  deleteAction,
}: {
  groups: BoardGroup[];
  addAction: (formData: FormData) => Promise<void>;
  tickAction: (formData: FormData) => Promise<void>;
  untickAction: (id: string) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [showDiscussed, setShowDiscussed] = useState<Record<string, boolean>>({});
  const totalOpen = groups.reduce((n, g) => n + g.open.length, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-primary">Agenda</h2>
        <span className="text-sm text-muted-foreground">
          {totalOpen} {totalOpen === 1 ? "item" : "items"} to discuss
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const open = showDiscussed[g.id] ?? false;
          return (
            <div key={g.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-primary">
                  {g.name}
                  {g.open.length > 0 && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-white">
                      {g.open.length}
                    </span>
                  )}
                </h3>
              </div>

              {g.open.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {g.open.map((item) => (
                    <ItemRow key={item.id} item={item} tickAction={tickAction} deleteAction={deleteAction} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to discuss here yet.</p>
              )}

              <AddItemForm groupId={g.id} action={addAction} />

              {g.discussed.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDiscussed((s) => ({ ...s, [g.id]: !open }))}
                    aria-expanded={open}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-accent"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    />
                    Discussed ({g.discussed.length})
                  </button>

                  {open && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {g.discussed.map((item) => (
                        <li key={item.id} className="rounded-md bg-muted p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{item.title}</p>
                              {item.outcome && (
                                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{item.outcome}</p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                Discussed{item.discussed_by_name ? ` by ${item.discussed_by_name}` : ""}
                                {item.discussed_at && ` on ${formatDateTime(item.discussed_at)}`}
                                {" · raised by "}
                                {item.created_by_name}
                              </p>
                            </div>
                            <form action={untickAction.bind(null, item.id)}>
                              <button
                                type="submit"
                                className="shrink-0 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:border-accent"
                              >
                                Reopen
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
