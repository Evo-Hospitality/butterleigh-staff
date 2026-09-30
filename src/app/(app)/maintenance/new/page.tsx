"use client";

import { useState } from "react";
import { PageError } from "@/components/page-error";
import Loading from "../../loading";
import { useMaintenanceView } from "../data";
import { SubmitButton } from "@/components/submit-button";
import { createMaintenanceRequestAction } from "./actions";

export default function NewMaintenanceRequestPage() {
  const view = useMaintenanceView("newForm");
  // One per page visit, so both presses of one button carry the same value
  // and the second is rejected as a duplicate server-side.
  const [token] = useState(() => crypto.randomUUID());
  if (!view.data) return <Loading />;

  const { isAdmin, assignees } = view.data;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Report a maintenance issue</h1>
      <PageError />

      <form
        action={createMaintenanceRequestAction}
        className="flex max-w-md flex-col gap-4"
      >
        <input type="hidden" name="submission_token" value={token} />

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

        {isAdmin && (
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
