"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { formatDate } from "@/lib/format";

type PreviewStatus = "post" | "salaried" | "unmatched";

type PreviewLine = {
  rawName: string;
  displayName: string;
  hours: number;
  shifts: number;
  status: PreviewStatus;
  staffId: string | null;
  matchedName: string | null;
};

type PreviewResult =
  | {
      ok: true;
      filename: string;
      periodStart: string | null;
      periodEnd: string | null;
      entryCount: number;
      lines: PreviewLine[];
    }
  | { ok: false; error: string };

type CommitResult =
  | { ok: true; posted: number; skippedSalaried: number; unmatched: number; excluded: number }
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
  excluded_count: number;
  total_hours: number;
  imported_by_name: string;
  created_at: string;
  unmatched: UnmatchedRow[];
};

const STATUS_LABEL: Record<PreviewStatus, string> = {
  post: "Will post",
  salaried: "Salaried — hours not tracked",
  unmatched: "No staff record",
};

const STATUS_STYLE: Record<PreviewStatus, string> = {
  post: "bg-green-100 text-green-800",
  salaried: "bg-gray-100 text-gray-700",
  unmatched: "bg-yellow-100 text-yellow-800",
};

export function HoursImportPanel({
  year,
  month,
  monthLabel,
  imports,
  staff,
  previewAction,
  commitAction,
  deleteAction,
  linkAction,
  dismissAction,
  recheckAction,
}: {
  year: number;
  month: number;
  monthLabel: string;
  imports: ImportRow[];
  staff: Profile[];
  previewAction: (formData: FormData) => Promise<PreviewResult>;
  commitAction: (payload: {
    year: number;
    month: number;
    filename: string;
    periodStart: string | null;
    periodEnd: string | null;
    entryCount: number;
    excluded: number;
    lines: { displayName: string; rawName: string; hours: number; staffId: string | null; status: PreviewStatus }[];
  }) => Promise<CommitResult>;
  deleteAction: (importId: string) => Promise<void>;
  linkAction: (unmatchedId: string, profileId: string) => Promise<void>;
  dismissAction: (unmatchedId: string) => Promise<void>;
  recheckAction: (importId: string) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

  async function onPreview(formData: FormData) {
    setBusy(true);
    setCommitResult(null);
    try {
      const result = await previewAction(formData);
      setPreview(result);
      if (result.ok) {
        // Everything starts included; you exclude the ones that aren't staff.
        setIncluded(Object.fromEntries(result.lines.map((l) => [l.rawName, true])));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!preview?.ok) return;
    setBusy(true);
    try {
      const keep = preview.lines.filter((l) => included[l.rawName]);
      const result = await commitAction({
        year,
        month,
        filename: preview.filename,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        entryCount: preview.entryCount,
        excluded: preview.lines.length - keep.length,
        lines: keep.map((l) => ({
          displayName: l.displayName,
          rawName: l.rawName,
          hours: l.hours,
          staffId: l.staffId,
          status: l.status,
        })),
      });
      setCommitResult(result);
      if (result.ok) {
        setPreview(null);
        formRef.current?.reset();
      }
    } finally {
      setBusy(false);
    }
  }

  const keepCount = preview?.ok ? preview.lines.filter((l) => included[l.rawName]).length : 0;
  const keptHours = preview?.ok
    ? preview.lines
        .filter((l) => included[l.rawName] && l.status === "post")
        .reduce((s, l) => s + l.hours, 0)
    : 0;

  return (
    <div className="mb-8">
      <div className="mb-4 rounded-md border border-dashed border-border p-4">
        <p className="mb-1 text-sm font-medium">Import hours from the time system</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Upload the TimeEntries CSV export. You&apos;ll see every name in the file and can leave any
          of them out — the export includes clock-ins that aren&apos;t employees. Nothing is written
          until you confirm. Payable Hours are totalled per person and posted to{" "}
          <strong>{monthLabel}</strong>, whichever month is selected above, not the dates in the file.
        </p>

        <form ref={formRef} action={onPreview} className="flex flex-wrap items-center gap-3">
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
            {busy ? "Reading…" : "Review file"}
          </button>
        </form>

        {preview && !preview.ok && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{preview.error}</p>
        )}
        {commitResult && !commitResult.ok && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{commitResult.error}</p>
        )}
        {commitResult?.ok && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Imported: {commitResult.posted} {commitResult.posted === 1 ? "person" : "people"} posted
            {commitResult.skippedSalaried > 0 &&
              `, ${commitResult.skippedSalaried} salaried (hours not tracked)`}
            {commitResult.excluded > 0 && `, ${commitResult.excluded} excluded`}
            {commitResult.unmatched > 0 && `, ${commitResult.unmatched} not recognised — see below`}.
          </p>
        )}
      </div>

      {preview?.ok && (
        <div className="mb-4 rounded-lg border border-accent p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              Review {preview.filename} — {preview.lines.length} names, {preview.entryCount} entries
            </p>
            <p className="text-xs text-muted-foreground">
              {preview.periodStart && preview.periodEnd
                ? `File covers ${preview.periodStart} to ${preview.periodEnd}`
                : ""}
            </p>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Include</th>
                  <th className="px-3 py-2 font-medium">Name in file</th>
                  <th className="px-3 py-2 font-medium">Hours</th>
                  <th className="px-3 py-2 font-medium">Shifts</th>
                  <th className="px-3 py-2 font-medium">What happens</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => {
                  const on = included[l.rawName] ?? true;
                  return (
                    <tr key={l.rawName} className={`border-t border-border ${on ? "" : "opacity-40"}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setIncluded((c) => ({ ...c, [l.rawName]: e.target.checked }))
                          }
                          className="h-4 w-4"
                          aria-label={`Include ${l.displayName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {l.displayName}
                        {l.matchedName && l.matchedName !== l.displayName && (
                          <span className="ml-2 text-xs text-muted-foreground">→ {l.matchedName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{l.hours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.shifts}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status]}`}
                        >
                          {STATUS_LABEL[l.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCommit}
              disabled={busy || keepCount === 0}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${keepCount} into ${monthLabel}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                formRef.current?.reset();
              }}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
            >
              Cancel
            </button>
            <span className="text-xs text-muted-foreground">
              {keptHours.toFixed(2)} hours will post
              {preview.lines.length - keepCount > 0 &&
                ` · ${preview.lines.length - keepCount} excluded`}
            </span>
          </div>
        </div>
      )}

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
                      {imp.skipped_salaried > 0 && ` · ${imp.skipped_salaried} salaried skipped`}
                      {imp.excluded_count > 0 && ` · ${imp.excluded_count} excluded`} ·{" "}
                      {Number(imp.total_hours).toFixed(2)} hours · by {imp.imported_by_name} on{" "}
                      {formatDate(imp.created_at)}
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
                                !confirm(
                                  `Rename "${who}" to "${u.display_name}" and post ${Number(u.hours).toFixed(2)} hours to them?`,
                                )
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
                          <form action={dismissAction.bind(null, u.id)}>
                            <button
                              type="submit"
                              className="rounded-md border border-border bg-white px-3 py-1 text-sm font-medium text-muted-foreground hover:border-accent"
                            >
                              Dismiss
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
