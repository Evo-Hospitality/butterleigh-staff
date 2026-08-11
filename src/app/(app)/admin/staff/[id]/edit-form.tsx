"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { updateStaffAction, deleteStaffAction, sendInviteAction } from "./actions";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function EditStaffForm({ staff, managers }: { staff: Profile; managers: Profile[] }) {
  const [employmentType, setEmploymentType] = useState(staff.employment_type);
  const action = updateStaffAction.bind(null, staff.id);
  const deleteAction = deleteStaffAction.bind(null, staff.id);
  const inviteAction = sendInviteAction.bind(null, staff.id, staff.email);

  return (
    <>
    <div className="mb-6 flex max-w-lg items-center justify-between rounded-md border border-border bg-muted px-4 py-3">
      <div className="text-sm">
        {staff.invited_at ? (
          <>Invited {new Date(staff.invited_at).toLocaleDateString()}</>
        ) : (
          <span className="text-muted-foreground">Not invited yet — they can&apos;t log in</span>
        )}
      </div>
      <form action={inviteAction}>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          {staff.invited_at ? "Resend invite" : "Send invite"}
        </button>
      </form>
    </div>

    <form action={action} className="flex max-w-lg flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <input
          name="full_name"
          required
          defaultValue={staff.full_name}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <p className="text-sm text-muted-foreground">{staff.email}</p>

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
            defaultValue={staff.annual_allowance_days ?? 28}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Contracted hours/week (optional)</label>
        <input
          name="contracted_hours_per_week"
          type="number"
          step="0.5"
          defaultValue={staff.contracted_hours_per_week ?? ""}
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
                defaultChecked={staff.working_days.includes(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Manager (optional)</label>
        <select
          name="manager_id"
          defaultValue={staff.manager_id ?? ""}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="">No manager (approved by admin)</option>
          {managers
            .filter((m) => m.id !== staff.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_manager" defaultChecked={staff.is_manager} />
        This person approves requests for others (a manager)
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">App role</label>
        <select name="role" defaultValue={staff.role} className="w-full rounded-md border border-border px-3 py-2 text-sm">
          <option value="staff">Staff</option>
          <option value="admin">Admin (full HR/payroll access)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={staff.active} />
        Active (uncheck to archive — blocks their login but keeps all their history)
      </label>

      <button
        type="submit"
        className="mt-2 self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Save changes
      </button>
    </form>

    <div className="mt-6 max-w-lg rounded-md border border-red-200 bg-red-50 p-4">
      <p className="mb-1 text-sm font-medium text-red-900">Danger zone</p>
      <p className="mb-3 text-sm text-red-800">
        Permanently deletes {staff.full_name} and all their requests/history. For a real leaver,
        use the &quot;Active&quot; checkbox above instead — this is for dummy/test staff or hires
        that never started.
      </p>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`Permanently delete ${staff.full_name}? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Delete staff member
        </button>
      </form>
    </div>
    </>
  );
}
