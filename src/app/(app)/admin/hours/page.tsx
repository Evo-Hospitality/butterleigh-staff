"use client";

import { useSearchParams } from "next/navigation";
import { HoursForm } from "./hours-form";
import { HoursImportPanel } from "@/components/hours-import-panel";
import {
  commitTimeEntriesAction,
  deleteHoursImportAction,
  dismissUnmatchedAction,
  linkUnmatchedAction,
  previewTimeEntriesAction,
  recheckUnmatchedAction,
} from "./import-actions";
import Loading from "../../loading";
import { useSettingsView } from "../settings-data";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthlyHoursPage() {
  const params = useSearchParams();
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;

  const view = useSettingsView("hours", { year: String(year), month: String(month) });
  if (!view.data) return <Loading />;

  const { staff, allStaff, initialHours, imports: importRows } = view.data;
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Monthly hours</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Hours worked by each hourly employee, imported from the time system. Holiday accrues
        automatically at 12.07% of the hours recorded. You can still adjust any figure by hand
        below — a manual edit isn&apos;t removed if the import it came with is.
      </p>

      <div className="mb-4 flex gap-3 text-sm">
        {[-1, 0, 1].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const active = y === year && m === month;
          return (
            <a
              key={offset}
              href={`/admin/hours?year=${y}&month=${m}`}
              className={`rounded-md border px-3 py-1.5 ${
                active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {MONTH_NAMES[m - 1]} {y}
            </a>
          );
        })}
      </div>

      <HoursImportPanel
        key={`${year}-${month}`}
        year={year}
        month={month}
        monthLabel={monthLabel}
        imports={importRows}
        staff={allStaff}
        previewAction={previewTimeEntriesAction}
        commitAction={commitTimeEntriesAction}
        deleteAction={deleteHoursImportAction}
        linkAction={linkUnmatchedAction}
        dismissAction={dismissUnmatchedAction}
        recheckAction={recheckUnmatchedAction}
      />

      {/* Keyed by month and the saved figures: a month switch or an import
          landing resets the boxes, but a background refresh that finds
          nothing changed leaves what's being typed alone. */}
      <HoursForm
        key={`${year}-${month}-${JSON.stringify(initialHours)}`}
        staff={staff}
        initialHours={new Map(Object.entries(initialHours))}
        year={year}
        month={month}
      />
    </div>
  );
}
