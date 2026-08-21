"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

type ImportResult =
  | { ok: true; importId: string; posted: number; skippedSalaried: number; unmatched: number }
  | { ok: false; error: string };

export type UnmatchedRow = {
  id: string;
  display_name: string;
  raw_name: string;
  hours: number;
  resolved_at: string | null;
};

export type ImportRow = {
  id: string;
  filename: string | null;
  period_start: string | null;
  period_end: string | null;
  entry_count: number;
  matched_count: number;
  skipped_salaried: number;
  total_hours: number;
  imported_by_name: string;
  created_at: string;
  unmatched: UnmatchedRow[];
};

export function HoursImportPanel({
  year,
  month,
  monthLabel,
  imports,
  staff,
  importAction,
  deleteAction,
  linkAction,
  recheckAction,
}: {
  year: number;
  month: number;
  monthLabel: string;
  imports: ImportRow[];
  staff: Profile[];
  importAction: (formData: FormData) => Promise<ImportResult>;
  deleteAction: (importId: string) => Promise<void>;
  linkAction: (unmatchedId: string, profileId: string) => Promise<void>;
  recheckAction: (importId: string) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

  async function onImport(formData: FormData) {
    setBusy(true);
    setResult(null);
    try {
      setResult(await importAction(formData));
      formRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="mb-4 rounded-md border border-dashed border-border p-4">
        <p className="mb-1 text-sm font-medium">Import hours from the time system</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Upload the TimeEntries CSV export. Payable Hours are totalled per person and posted to{" "}
          <strong>{monthLabel}</strong> — whichever month is selected above, not the dates in the
          file. Re-importing replaces what&apos;s there, and an import can be removed again below.
        </p>

        <form ref={formRef} action={onImport} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:border-accent hover:file:text-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import into ${monthLabel}`}
          </button>
        </form>

        {result && !result.ok && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
        )}
        {result?.ok && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Imported: {result.posted} {result.posted === 1 ? "person" : "people"} posted
            {result.skippedSalaried > 0 && `, ${result.skippedSalaried} salaried (hours not tracked)`}
            {result.unmatched > 0 && `, ${result.unmatched} not recognised — see below`}.
          </p>
        )}
      </div>

      {imports.length > 0 && (
        <div className="flex flex-col gap-3">
          {imports.map((imp) => {
            const outstanding = imp.unmatched.filter((u) => !u.resolved_at);
            return (
              <div key={imp.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{imp.filename ?? "TimeEntries import"}</p>
                    <p className="text-xs text-muted-foreground">
                      {imp.period_start && imp.period_end
                        ? `Covers ${imp.period_start} to ${imp.period_end} · `
                        : ""}
                      {imp.entry_count} entries · {imp.matched_count} posted
                      {imp.skipped_salaried > 0 && ` · ${imp.skipped_salaried} salaried skipped`} ·{" "}
                      {Number(imp.total_hours).toFixed(2)} hours · by {imp.imported_by_name} on{" "}
                      {new Date(imp.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <form
                    action={deleteAction.bind(null, imp.id)}
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          `Remove this import? The ${imp.matched_count} sets of hours it posted will be deleted and holiday accrual recalculated.`,
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Remove import
                    </button>
                  </form>
                </div>

                {outstanding.length > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-50 p-3">
                    <p className="mb-1 text-sm font-medium text-yellow-900">
                      {outstanding.length} {outstanding.length === 1 ? "name" : "names"} in the file
                      {outstanding.length === 1 ? " has" : " have"} no staff record
                    </p>
                    <p className="mb-3 text-xs text-yellow-900">
                      Their hours weren&apos;t posted. Add them under{" "}
                      <Link href="/admin/staff/new" className="font-semibold underline">
                        Staff
                      </Link>{" "}
                      using the name exactly as shown, then Re-check. Or point the name at someone
                      who already exists — that renames their record to match the time system.
                    </p>

                    <div className="flex flex-col gap-2">
                      {outstanding.map((u) => (
                        <div key={u.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="min-w-40 font-medium">{u.display_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {Number(u.hours).toFixed(2)} hrs
                          </span>
                          <select
                            value={linkChoice[u.id] ?? ""}
                            onChange={(e) => setLinkChoice((c) => ({ ...c, [u.id]: e.target.value }))}
                            className="rounded-md border border-border px-2 py-1 text-sm"
                          >
                            <option value="">Link to existing staff…</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name}
                              </option>
                            ))}
                          </select>
                          <form
                            action={async () => {
                              const chosen = linkChoice[u.id];
                              if (chosen) await linkAction(u.id, chosen);
                            }}
                            onSubmit={(e) => {
                              const chosen = linkChoice[u.id];
                              const who = staff.find((s) => s.id === chosen)?.full_name;
                              if (
                                !chosen ||
                                !confirm(`Rename "${who}" to "${u.display_name}" and post ${Number(u.hours).toFixed(2)} hours to them?`)
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <button
                              type="submit"
                              disabled={!linkChoice[u.id]}
                              className="rounded-md border border-border bg-white px-3 py-1 text-sm font-medium hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Link &amp; rename
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>

                    <form action={recheckAction.bind(null, imp.id)} className="mt-3">
                      <button
                        type="submit"
                        className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
                      >
                        Re-check after adding staff
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
