"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PayrollHolidayItem, PayrollReportRow } from "@/lib/holiday/payroll-report";
import { formatDate, formatDateOnly } from "@/lib/format";
import { PageError } from "@/components/page-error";
import { SubmitButton } from "@/components/submit-button";
import Loading from "../../loading";
import { useSettingsView } from "../settings-data";
import { setPayPeriodAction } from "./actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthLabel = (y: number, m: number) => `${MONTH_NAMES[m - 1]} ${y}`;

function shiftMonth(year: number, month: number, offset: number) {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ReportTable({ rows, periodLabel }: { rows: PayrollReportRow[]; periodLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Staff</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Hours worked</th>
            <th className="px-4 py-2 font-medium">Accrued this month</th>
            <th className="px-4 py-2 font-medium">Holiday taken</th>
            <th className="px-4 py-2 font-medium">Unpaid leave</th>
            <th className="px-4 py-2 font-medium">Lieu earned</th>
            <th className="px-4 py-2 font-medium">Balance at end of {periodLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.staffId} className="border-t border-border">
              <td className="px-4 py-2 whitespace-nowrap">{row.fullName}</td>
              <td className="px-4 py-2 capitalize">{row.employmentType}</td>
              {/* Every "this month" column blanks when there's nothing to
                  act on — including where a column doesn't apply to that
                  employment type at all. A page of empty cells means the
                  few with figures in are the ones to deal with. */}
              <td className="px-4 py-2">{row.hoursWorkedThisMonth ? row.hoursWorkedThisMonth : ""}</td>
              <td className="px-4 py-2">{row.accruedThisMonth ? row.accruedThisMonth.toFixed(2) : ""}</td>
              <td className="px-4 py-2 font-medium">
                {row.holidayTakenThisMonth > 0 ? `${row.holidayTakenThisMonth} ${row.unit}` : ""}
              </td>
              <td className="px-4 py-2">
                {row.employmentType === "salaried" && row.unpaidLeaveThisMonth > 0
                  ? `${row.unpaidLeaveThisMonth} days`
                  : ""}
              </td>
              <td className="px-4 py-2">
                {row.employmentType === "salaried" && row.lieuEarnedThisMonth > 0 ? row.lieuEarnedThisMonth : ""}
              </td>
              <td className="px-4 py-2 font-medium">
                {row.remainingBalance.toFixed(2)} {row.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveForm({ item, year, month }: { item: PayrollHolidayItem; year: number; month: number }) {
  const returnTo = `/admin/payroll-report?year=${year}&month=${month}`;
  // A few months either side of this one — enough to catch something that
  // slipped, without a year-long list.
  const choices = [-3, -2, -1, 1, 2, 3].map((o) => shiftMonth(year, month, o));
  const normal = item.normalPeriod;
  const isMoved = !!item.movedByName;
  return (
    <form action={setPayPeriodAction.bind(null, item.id, returnTo)} className="flex items-center gap-2">
      <select name="period" defaultValue="" required className="rounded-md border border-border px-2 py-1 text-xs">
        <option value="" disabled>
          Move to…
        </option>
        {choices.map((c) => (
          <option key={`${c.year}-${c.month}`} value={`${c.year}-${c.month}`}>
            {monthLabel(c.year, c.month)}
          </option>
        ))}
        {isMoved && <option value="auto">Back to normal ({monthLabel(normal.year, normal.month)})</option>}
      </select>
      <SubmitButton
        pendingLabel="Moving…"
        className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:border-accent disabled:opacity-50"
      >
        Move
      </SubmitButton>
    </form>
  );
}

export default function PayrollReportPage() {
  const params = useSearchParams();
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;

  const view = useSettingsView("payrollReport", { year: String(year), month: String(month) });
  if (!view.data) return <Loading />;

  const { rows, holidays = [] } = view.data;
  const activeRows = rows.filter((r) => !r.archived);
  const archivedRows = rows.filter((r) => r.archived);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Payroll report — {monthLabel(year, month)}</h1>
        <a
          href={`/admin/payroll-report/csv?year=${year}&month=${month}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 flex gap-3 text-sm">
        {[-1, 0, 1].map((offset) => {
          const { year: y, month: m } = shiftMonth(year, month, offset);
          const active = y === year && m === month;
          return (
            <Link
              key={offset}
              href={`/admin/payroll-report?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {monthLabel(y, m)}
            </Link>
          );
        })}
      </div>

      <PageError className="mb-4 max-w-xl" />

      <ReportTable rows={activeRows} periodLabel={MONTH_NAMES[month - 1]} />

      {archivedRows.length > 0 && (
        <>
          <h2 className="mt-8 mb-1 text-lg font-semibold text-primary">Archived staff</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Leavers with something to pay or deduct in {monthLabel(year, month)}, or holiday still on their balance.
          </p>
          <ReportTable rows={archivedRows} periodLabel={MONTH_NAMES[month - 1]} />
        </>
      )}

      <h2 className="mt-8 mb-1 text-lg font-semibold text-primary">Holiday in this pay period</h2>
      <p className="mb-2 max-w-2xl text-xs text-muted-foreground">
        Hourly holiday is paid in the month it was asked for (from the 25th, the next month); salaried leave in the
        month it starts. If one was missed or belongs in a different run, move it — it stays approved and their
        balance doesn&apos;t change, only the month it&apos;s paid in.
      </p>
      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approved holiday falls in this pay period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Staff</th>
                <th className="px-4 py-2 font-medium">Dates</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Asked for / approved</th>
                <th className="px-4 py-2 font-medium">Pay period</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="border-t border-border align-top">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {h.fullName}
                    {h.archived && <span className="ml-1 text-xs text-muted-foreground">(archived)</span>}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {h.startDate === h.endDate
                      ? formatDateOnly(h.startDate)
                      : `${formatDateOnly(h.startDate)} – ${formatDateOnly(h.endDate)}`}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {h.amount} {h.unit}
                    {h.isUnpaid && <span className="ml-1 text-xs text-yellow-800">unpaid</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatDate(h.submittedAt)}
                    {h.decidedAt && <> / {formatDate(h.decidedAt)}</>}
                  </td>
                  <td className="px-4 py-2">
                    {h.movedByName && (
                      <p className="mb-1 text-xs text-muted-foreground">
                        Moved here from {monthLabel(h.normalPeriod.year, h.normalPeriod.month)} by {h.movedByName}
                        {h.movedAt && ` on ${formatDate(h.movedAt)}`}
                      </p>
                    )}
                    <MoveForm item={h} year={year} month={month} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
