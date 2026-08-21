"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { saveMonthlyHours } from "./actions";

export function HoursForm({
  staff,
  initialHours,
  year,
  month,
}: {
  staff: Profile[];
  initialHours: Map<string, number>;
  year: number;
  month: number;
}) {
  const [hours, setHours] = useState(initialHours);

  return (
    <form action={saveMonthlyHours}>
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />

      <h2 className="mb-3 text-lg font-bold text-primary">Adjust by hand</h2>

      <div className="max-w-lg overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Hours worked</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <tr key={person.id} className="border-t border-border">
                <td className="px-4 py-2">{person.full_name}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    name={`hours_${person.id}`}
                    value={hours.get(person.id) ?? ""}
                    onChange={(e) => {
                      const next = new Map(hours);
                      if (e.target.value === "") {
                        next.delete(person.id);
                      } else {
                        next.set(person.id, Number(e.target.value));
                      }
                      setHours(next);
                    }}
                    className="w-28 rounded-md border border-border px-2 py-1"
                  />
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">
                  No hourly staff yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Save hours
      </button>
    </form>
  );
}
