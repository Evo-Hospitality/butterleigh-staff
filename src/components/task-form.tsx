"use client";

import { useState } from "react";
import type { Profile, RecurrenceUnit, Task } from "@/lib/types";

type Mode = "One-off" | "Daily" | "Weekly" | "Monthly" | "Custom";

function modeFor(unit: RecurrenceUnit | null, value: number | null): Mode {
  if (!unit || !value) return "One-off";
  if (value === 1 && unit === "days") return "Daily";
  if (value === 1 && unit === "weeks") return "Weekly";
  if (value === 1 && unit === "months") return "Monthly";
  return "Custom";
}

export function TaskForm({
  action,
  profiles,
  currentUserId,
  task,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  profiles: Profile[];
  currentUserId: string;
  task?: Task;
  submitLabel: string;
}) {
  const [mode, setMode] = useState<Mode>(task ? modeFor(task.recurrence_unit, task.recurrence_value) : "One-off");
  const [customUnit, setCustomUnit] = useState<Exclude<RecurrenceUnit, null>>(task?.recurrence_unit ?? "days");
  const [customValue, setCustomValue] = useState(String(task?.recurrence_value ?? 1));

  let finalUnit = "";
  let finalValue = "";
  if (mode === "Daily") {
    finalUnit = "days";
    finalValue = "1";
  } else if (mode === "Weekly") {
    finalUnit = "weeks";
    finalValue = "1";
  } else if (mode === "Monthly") {
    finalUnit = "months";
    finalValue = "1";
  } else if (mode === "Custom") {
    finalUnit = customUnit;
    finalValue = customValue;
  }

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Task</label>
        <input
          name="title"
          required
          defaultValue={task?.title}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={task?.description ?? ""}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Assign to</label>
          <select
            name="assigned_to"
            defaultValue={task?.assigned_to ?? currentUserId}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === currentUserId ? "Myself" : p.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Due date (optional)</label>
          <input
            name="due_date"
            type="date"
            defaultValue={task?.due_date ?? ""}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Due time (optional)</label>
          <input
            name="due_time"
            type="time"
            defaultValue={task?.due_time ? task.due_time.slice(0, 5) : ""}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Defaults to end of day</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">Repeats</legend>
        <div className="flex flex-wrap gap-2">
          {(["One-off", "Daily", "Weekly", "Monthly", "Custom"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                mode === m ? "border-accent bg-accent text-white" : "border-border hover:border-accent"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "Custom" && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">Every</span>
            <input
              type="number"
              min={1}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-16 rounded-md border border-border px-2 py-1.5 text-sm"
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as Exclude<RecurrenceUnit, null>)}
              className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>
        )}

        <input type="hidden" name="recurrence_unit" value={finalUnit} />
        <input type="hidden" name="recurrence_value" value={finalValue} />
      </fieldset>

      {task && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={task.is_active} />
          Active (uncheck to pause a recurring task without losing its history)
        </label>
      )}

      <button
        type="submit"
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
