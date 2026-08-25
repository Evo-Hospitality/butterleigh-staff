import { requireMaintenanceAccess } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { staffWithAppAccess } from "@/lib/access-query";
import { SubmitButton } from "@/components/submit-button";
import { createMaintenanceRequestAction } from "./actions";

export default async function NewMaintenanceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile, supabase } = await requireMaintenanceAccess();
  const { error } = await searchParams;

  let assignees: Profile[] = [];
  if (profile.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>();
    assignees = await staffWithAppAccess(supabase, "maintenance", "manage");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Report a maintenance issue</h1>
      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form
        action={createMaintenanceRequestAction}
        encType="multipart/form-data"
        className="flex max-w-md flex-col gap-4"
      >
        {/* Fresh per render, so both presses of one button carry the same
            value and the second is rejected as a duplicate server-side. */}
        <input type="hidden" name="submission_token" value={crypto.randomUUID()} />

        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="e.g. Leaking pipe under the bar sink"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Details (optional)</label>
          <textarea
            name="description"
            rows={4}
            placeholder="Where exactly, how bad, anything already tried…"
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

        {profile.role === "admin" && (
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
        )}

        <SubmitButton pendingLabel="Submitting…">Submit</SubmitButton>
      </form>
    </div>
  );
}
