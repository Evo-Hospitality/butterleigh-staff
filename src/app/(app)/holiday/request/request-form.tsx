"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import { countWorkingDays } from "@/lib/holiday/working-days";
import { requestLeave } from "./actions";

export function RequestForm({ profile }: { profile: Profile }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const preview = useMemo(() => {
    if (profile.employment_type !== "salaried" || !startDate || !endDate) return null;
    if (endDate < startDate) return null;
    return countWorkingDays(startDate, endDate, profile.working_days);
  }, [startDate, endDate, profile]);

  return (
    <form action={requestLeave} className="flex max-w-md flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Start date</label>
          <input
            name="start_date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">End date</label>
          <input
            name="end_date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {profile.employment_type === "salaried" ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {preview === null
            ? "Pick a date range to see how many days this uses."
            : preview === 0
              ? "That range doesn't include any of your working days — nothing would be deducted."
              : `This uses ${preview} day${preview === 1 ? "" : "s"} of your allowance.`}
        </p>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium">Hours requested</label>
          <input
            name="hours"
            type="number"
            step="0.25"
            min="0"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Submit request
      </button>
    </form>
  );
}
