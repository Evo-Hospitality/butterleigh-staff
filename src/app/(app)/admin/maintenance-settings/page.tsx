"use client";

import { saveMaintenanceSettingsAction } from "./actions";
import Loading from "../../loading";
import { useSettingsView } from "../settings-data";

export default function MaintenanceSettingsPage() {
  const view = useSettingsView("maintenanceSettings");
  if (!view.data) return <Loading />;

  const { assigneeId, staff } = view.data;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Maintenance settings</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        New maintenance requests from regular staff are routed here automatically. If nobody&apos;s
        set, they go to the first available admin instead. Admins raising a request choose who to
        assign it to themselves, regardless of this setting.
      </p>

      {/* Keyed by the saved value so the picker shows it after a save. */}
      <form key={assigneeId} action={saveMaintenanceSettingsAction} className="flex max-w-md items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Default assignee</label>
          <select
            name="default_maintenance_assignee_id"
            defaultValue={assigneeId}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">No default — route to any admin</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  );
}
