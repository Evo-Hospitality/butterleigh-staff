"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { proratedAllowance } from "@/lib/holiday/proration";
import { createStaffAction } from "./actions";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function StaffForm({ managers }: { managers: Profile[] }) {
  const [employmentType, setEmploymentType] = useState<"salaried" | "hourly">("hourly");
  const [startDate, setStartDate] = useState("");
  const [allowance, setAllowance] = useState(28);

  const prorated =
    startDate && new Date(startDate).getFullYear() === new Date().getFullYear()
      ? proratedAllowance(allowance, startDate, new Date().getFullYear())
      : null;

  return (
    <form action={createStaffAction} className="flex max-w-lg flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <input
          name="full_name"
          required
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="send_invite_now" defaultChecked />
        Send them a login invite email now
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">
        Leave unchecked to set them up now and invite them later — from their staff page, whenever
        you&apos;re ready.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium">Start date (optional)</label>
        <input
          name="start_date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Employment type</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="employment_type"
              value="hourly"
              checked={employmentType === "hourly"}
              onChange={() => setEmploymentType("hourly")}
            />
            Hourly (12.07% accrual)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="employment_type"
              value="salaried"
              checked={employmentType === "salaried"}
              onChange={() => setEmploymentType("salaried")}
            />
            Salaried (annual allowance)
          </label>
        </div>
      </div>

      {employmentType === "salaried" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Annual allowance (days)</label>
          <input
            name="annual_allowance_days"
            type="number"
            step="0.1"
            value={allowance}
            onChange={(e) => setAllowance(Number(e.target.value))}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {prorated !== null
              ? `Full entitlement — their first year (starting ${startDate}) will be pro-rated to ~${prorated} days once you set up their balance.`
              : "Defaults to 28 (20 + 8 bank-holiday compensation) — override for this person if needed."}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Contracted hours/week (optional)</label>
        <input
          name="contracted_hours_per_week"
          type="number"
          step="0.5"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Working days</label>
        <div className="flex flex-wrap gap-3 text-sm">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="working_days"
                value={d.value}
                defaultChecked={d.value >= 1 && d.value <= 5}
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Manager (optional)</label>
        <select name="manager_id" className="w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="">No manager (approved by admin)</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_manager" />
        This person approves requests for others (a manager)
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">App role</label>
        <select name="role" defaultValue="staff" className="w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="staff">Staff</option>
          <option value="admin">Admin (full HR/payroll access)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="has_maintenance_access" />
        Has access to the Maintenance app
      </label>

      <button
        type="submit"
        className="mt-2 self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Send invite
      </button>
    </form>
  );
}
