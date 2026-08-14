import { requireActionItemsAccess } from "@/lib/auth";
import { isManagerOrAdmin, type Profile } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActionAction } from "./actions";

export default async function NewActionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireActionItemsAccess();
  const { error } = await searchParams;

  // Everyone who can reach this page is already a manager/admin, so the
  // "Assign to" dropdown always shows — unlike Maintenance, there's no
  // auto-routing branch for regular staff. Uses the admin client rather
  // than the caller's own — profiles' own RLS only lets a non-admin
  // manager see themselves and their direct reports, not the wider
  // manager/admin pool this dropdown needs (same reasoning as
  // lib/maintenance/routing.ts's resolveDefaultAssignee()).
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>();
  const assignees = (data ?? []).filter(isManagerOrAdmin);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Raise an Action</h1>
      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={createActionAction}
        encType="multipart/form-data"
        className="flex max-w-md flex-col gap-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="e.g. Chase supplier about the Q3 price increase"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            name="notes"
            rows={4}
            placeholder="Context, what needs doing, anything already tried…"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Photo (optional)</label>
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:border-accent hover:file:text-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Assign to</label>
          <select
            name="assigned_to"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="">Choose someone…</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
