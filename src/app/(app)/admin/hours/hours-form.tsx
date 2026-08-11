"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { parseHoursPaste, namesMatch } from "@/lib/holiday/parse-hours-paste";
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
  const [pasteText, setPasteText] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);

  function applyPaste() {
    const parsed = parseHoursPaste(pasteText);
    const next = new Map(hours);
    const misses: string[] = [];

    for (const { name, hours: parsedHours } of parsed) {
      const match = staff.find((s) => namesMatch(s.full_name, name));
      if (match) {
        next.set(match.id, parsedHours);
      } else {
        misses.push(name);
      }
    }

    setHours(next);
    setUnmatched(misses);
    setPasteText("");
  }

  return (
    <form action={saveMonthlyHours}>
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />

      <div className="mb-6 rounded-md border border-dashed border-border p-3">
        <label htmlFor="paste" className="mb-1 block text-sm font-medium">
          Paste hours from a spreadsheet
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          One person per line: name, then hours (tab or space separated) — exactly what you get
          pasting a name + hours column straight out of Excel.
        </p>
        <textarea
          id="paste"
          rows={4}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Jacqueline Wood\t101.60\nLochy Cronkshaw\t52.37"}
          className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={applyPaste}
          disabled={!pasteText.trim()}
          className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          Fill in hours
        </button>
        {unmatched.length > 0 && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No staff matched: {unmatched.join(", ")}. Check spelling, or add them under Staff first.
          </p>
        )}
      </div>

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
