import { requireAdmin } from "@/lib/auth";
import type { CheckinGroup } from "@/lib/types";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  addCheckinGroupAction,
  deleteCheckinGroupAction,
  moveCheckinGroupAction,
  renameCheckinGroupAction,
  setCheckinGroupActiveAction,
} from "./actions";

export default async function CheckinGroupsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase.from("checkin_groups").select("*").order("sort_order").returns<CheckinGroup[]>(),
    supabase.from("checkin_items").select("group_id"),
  ]);

  const itemCount = new Map<string, number>();
  for (const i of items ?? []) {
    itemCount.set(i.group_id, (itemCount.get(i.group_id) ?? 0) + 1);
  }

  const all = groups ?? [];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Agenda groups</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        The headings the weekly management meeting is structured around. Managers add discussion
        items under them; only admins change the headings themselves. Archive a group to retire it
        without losing what was discussed under it.
      </p>

      <form action={addCheckinGroupAction} className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">New group</label>
          <input
            name="name"
            required
            placeholder="e.g. Guest feedback"
            className="w-64 rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {all.map((g, i) => {
              const count = itemCount.get(g.id) ?? 0;
              return (
                <tr key={g.id} className={`border-t border-border ${g.active ? "" : "bg-muted/50"}`}>
                  <td className="px-4 py-2">
                    <form action={renameCheckinGroupAction.bind(null, g.id)} className="flex items-center gap-2">
                      <input
                        name="name"
                        defaultValue={g.name}
                        className="w-56 rounded-md border border-border px-2 py-1"
                      />
                      <button type="submit" className="text-xs font-medium text-accent hover:underline">
                        Save
                      </button>
                    </form>
                    {!g.active && (
                      <span className="text-xs text-muted-foreground">Archived — hidden from Overview</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{count}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <form action={moveCheckinGroupAction.bind(null, g.id, "up")}>
                        <button
                          type="submit"
                          disabled={i === 0}
                          className="rounded-md border border-border bg-white px-2 py-1 text-xs hover:border-accent disabled:opacity-30"
                          aria-label={`Move ${g.name} up`}
                        >
                          &uarr;
                        </button>
                      </form>
                      <form action={moveCheckinGroupAction.bind(null, g.id, "down")}>
                        <button
                          type="submit"
                          disabled={i === all.length - 1}
                          className="rounded-md border border-border bg-white px-2 py-1 text-xs hover:border-accent disabled:opacity-30"
                          aria-label={`Move ${g.name} down`}
                        >
                          &darr;
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={setCheckinGroupActiveAction.bind(null, g.id, !g.active)}>
                        <button
                          type="submit"
                          className="rounded-md border border-border bg-white px-3 py-1 text-sm font-medium hover:border-accent"
                        >
                          {g.active ? "Archive" : "Restore"}
                        </button>
                      </form>
                      {count === 0 && (
                        <ConfirmDeleteButton
                          action={deleteCheckinGroupAction.bind(null, g.id)}
                          label="Delete"
                          confirmMessage={`Delete the "${g.name}" group?`}
                          className="rounded-md border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
