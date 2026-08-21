"use client";

import { useState } from "react";
import Link from "next/link";

export type RolloverRow = {
  staffId: string;
  fullName: string;
  employmentType: "salaried" | "hourly";
  closing: number;
  suggestedOpening: number;
  allowance: number;
  alreadyExists: boolean;
};

export function RolloverForm({
  fromYear,
  toYear,
  rows,
  commitAction,
}: {
  fromYear: number;
  toYear: number;
  rows: RolloverRow[];
  commitAction: (toYear: number, linesJson: string) => Promise<void>;
}) {
  const [openings, setOpenings] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.staffId, String(r.suggestedOpening)])),
  );
  const [allowances, setAllowances] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.staffId, String(r.allowance)])),
  );

  const existing = rows.filter((r) => r.alreadyExists).length;

  const payload = JSON.stringify(
    rows.map((r) => ({
      staffId: r.staffId,
      opening: Number(openings[r.staffId] ?? 0) || 0,
      allowance: Number(allowances[r.staffId] ?? 0) || 0,
    })),
  );

  return (
    <form
      action={commitAction.bind(null, toYear, payload)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Write opening balances for ${rows.length} staff into ${toYear}?` +
              (existing > 0
                ? `\n\n${existing} already have a ${toYear} row — their opening balance and allowance will be overwritten. Holiday already taken in ${toYear} is not affected.`
                : ""),
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {existing > 0 && (
        <p className="mb-4 max-w-2xl rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          {existing} {existing === 1 ? "person already has" : "people already have"} a {toYear}{" "}
          balance. Committing overwrites their opening balance and allowance — anything already
          taken or accrued in {toYear} is left alone.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Closing {fromYear}</th>
              <th className="px-4 py-2 font-medium">Opening {toYear}</th>
              <th className="px-4 py-2 font-medium">Allowance {toYear} (salaried)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId} className="border-t border-border">
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.fullName}
                  {r.alreadyExists && (
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      exists
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 capitalize">{r.employmentType}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {r.closing.toFixed(2)} {r.employmentType === "salaried" ? "days" : "hrs"}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={openings[r.staffId] ?? ""}
                    onChange={(e) => setOpenings((o) => ({ ...o, [r.staffId]: e.target.value }))}
                    className="w-24 rounded-md border border-border px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2">
                  {r.employmentType === "salaried" ? (
                    <input
                      type="number"
                      step="0.1"
                      value={allowances[r.staffId] ?? ""}
                      onChange={(e) => setAllowances((a) => ({ ...a, [r.staffId]: e.target.value }))}
                      className="w-24 rounded-md border border-border px-2 py-1"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Commit rollover into {toYear}
        </button>
        <Link
          href={`/admin/balances?year=${fromYear}`}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
