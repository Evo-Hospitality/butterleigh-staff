"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type StaffRow = {
  id: string;
  fullName: string;
  email: string;
  employmentType: string;
  workingDays: string;
  allowance: string;
  manager: string;
  role: string;
  invited: string;
};

function StaffTable({
  rows,
  showEmail,
  onToggleEmail,
  empty,
}: {
  rows: StaffRow[];
  showEmail: boolean;
  onToggleEmail: () => void;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            {/* Collapsed by default — addresses are long and squeeze every
                other column. Toggles like a grouped column in a spreadsheet. */}
            <th className="px-2 py-2 font-medium">
              <button
                type="button"
                onClick={onToggleEmail}
                aria-expanded={showEmail}
                className="flex items-center gap-1 hover:text-accent"
                title={showEmail ? "Hide email column" : "Show email column"}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showEmail ? "rotate-90" : ""}`}
                  aria-hidden="true"
                />
                Email
              </button>
            </th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Working days</th>
            <th className="px-4 py-2 font-medium">Allowance</th>
            <th className="px-4 py-2 font-medium">Manager</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Invite</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((person) => (
            <tr key={person.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link href={`/admin/staff/${person.id}`} className="font-medium hover:text-accent">
                  {person.fullName}
                </Link>
              </td>
              <td className="px-2 py-2 text-muted-foreground">
                {showEmail ? <span className="whitespace-nowrap">{person.email}</span> : null}
              </td>
              <td className="px-4 py-2 capitalize">{person.employmentType}</td>
              <td className="px-4 py-2 whitespace-nowrap">{person.workingDays}</td>
              <td className="px-4 py-2 whitespace-nowrap">{person.allowance}</td>
              <td className="px-4 py-2 whitespace-nowrap">{person.manager}</td>
              <td className="px-4 py-2 capitalize">{person.role}</td>
              <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{person.invited}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StaffTables({ active, archived }: { active: StaffRow[]; archived: StaffRow[] }) {
  // One toggle drives both tables so their columns stay aligned with each other.
  const [showEmail, setShowEmail] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const toggleEmail = () => setShowEmail((s) => !s);

  return (
    <div>
      <StaffTable rows={active} showEmail={showEmail} onToggleEmail={toggleEmail} empty="No active staff." />

      {archived.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            aria-expanded={showArchived}
            className="mb-3 flex items-center gap-2 text-lg font-bold text-primary hover:text-accent"
          >
            <ChevronRight
              className={`h-5 w-5 transition-transform ${showArchived ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
            Archived
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {archived.length}
            </span>
          </button>
          {showArchived && (
            <StaffTable
              rows={archived}
              showEmail={showEmail}
              onToggleEmail={toggleEmail}
              empty="Nobody archived."
            />
          )}
        </div>
      )}
    </div>
  );
}
