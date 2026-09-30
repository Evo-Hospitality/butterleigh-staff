"use client";

import Link from "next/link";
import type { HolidayStatementData } from "@/lib/holiday/statement";
import { formatDateOnly } from "@/lib/format";

// Draws a holiday statement loaded by loadHolidayStatement() (see
// src/lib/holiday/statement.ts): every line behind a balance figure, in date
// order with a running total. Shared by the admin drill-through from Balances
// and each person's own view under Holiday.

function dateRange(start: string, end: string): string {
  return start === end ? formatDateOnly(start) : `${formatDateOnly(start)} – ${formatDateOnly(end)}`;
}

export function HolidayStatement({
  statement,
  yearHref,
  self = false,
}: {
  statement: HolidayStatementData;
  yearHref: (year: number) => string;
  // Viewing your own statement: "you" wording, no admin-only jargon.
  self?: boolean;
}) {
  const {
    year,
    person,
    isSalaried,
    unit,
    ratePct,
    opening,
    hasBalance,
    lines: withRunning,
    totalEarned,
    totalSpent,
    closing,
    pendingTotal,
    pending,
    unpaid: approvedUnpaid,
  } = statement;

  const fmt = (n: number) => n.toFixed(2);
  const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(Math.abs(n))}`);

  return (
    <div className="max-w-4xl">
      <p className="mb-6 text-sm text-muted-foreground">
        {isSalaried
          ? "Salaried — holiday counted in days."
          : `Hourly — ${self ? "you earn" : "earns"} ${ratePct} of every hour worked as holiday, counted in hours.`}
        {!self && !person.active && " Archived (no longer working here)."}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Opening balance", value: opening },
          { label: isSalaried ? "Allowance + lieu" : "Earned this year", value: totalEarned },
          { label: "Taken", value: totalSpent },
          { label: "Remaining", value: closing, strong: true },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border px-4 py-3">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`text-lg ${c.strong ? "font-bold text-primary" : "font-semibold"}`}>
              {fmt(c.value)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {!hasBalance && (
        <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          No balance has been set up for {self ? "you" : person.full_name} in {year} yet.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">What happened</th>
              <th className="px-4 py-2 text-right font-medium">Change ({unit})</th>
              <th className="px-4 py-2 text-right font-medium">Balance ({unit})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border bg-muted/40">
              <td className="px-4 py-2 whitespace-nowrap">{formatDateOnly(`${year}-01-01`)}</td>
              <td className="px-4 py-2">
                Opening balance
                <div className="text-xs text-muted-foreground">
                  {year === 2026
                    ? "Brought across from the Excel holiday tracker (closing position at the 31 July 2026 payroll)"
                    : self ? "Your starting position for the year" : "Starting position for the year, set on the Balances screen"}
                </div>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(opening)}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(opening)}</td>
            </tr>
            {withRunning.map((l, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2 whitespace-nowrap">{formatDateOnly(l.date)}</td>
                <td className="px-4 py-2">
                  {l.label}
                  {l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${l.change < 0 ? "text-red-700" : "text-green-700"}`}
                >
                  {signed(l.change)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(l.running)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-4 py-2" />
              <td className="px-4 py-2">Remaining</td>
              <td className="px-4 py-2" />
              <td className="px-4 py-2 text-right tabular-nums">
                {fmt(closing)} {unit}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-lg font-semibold text-primary">Waiting for approval</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Not taken off the balance above yet, but held back — {self ? "you" : "they"} can only book{" "}
            {fmt(closing - pendingTotal)} {unit} more until these are decided.
          </p>
          <ul className="rounded-lg border border-border text-sm">
            {pending.map((r) => (
              <li key={r.id} className="flex justify-between border-t border-border px-4 py-2 first:border-t-0">
                <span>{dateRange(r.start_date, r.end_date)}</span>
                <span className="tabular-nums">
                  {fmt(r.amount)} {unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approvedUnpaid.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-1 text-lg font-semibold text-primary">Unpaid leave</h2>
          <p className="mb-2 text-xs text-muted-foreground">Doesn&apos;t use any holiday — listed for completeness.</p>
          <ul className="rounded-lg border border-border text-sm">
            {approvedUnpaid.map((r) => (
              <li key={r.id} className="flex justify-between border-t border-border px-4 py-2 first:border-t-0">
                <span>{dateRange(r.start_date, r.end_date)}</span>
                <span className="tabular-nums">
                  {fmt(r.amount)} {unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex gap-3 text-sm">
        <Link href={yearHref(year - 1)} className="rounded-md border border-border px-3 py-1.5 hover:border-accent">
          &larr; {year - 1}
        </Link>
        <Link href={yearHref(year + 1)} className="rounded-md border border-border px-3 py-1.5 hover:border-accent">
          {year + 1} &rarr;
        </Link>
      </div>
    </div>
  );
}
