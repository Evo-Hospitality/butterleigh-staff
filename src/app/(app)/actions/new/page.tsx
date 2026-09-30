"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { SubmissionToken } from "@/components/submission-token";
import { PageError } from "@/components/page-error";
import { isRedirect } from "@/lib/client/save";
import Loading from "../../loading";
import { useActionsView } from "../data";
import { createActionAction, createActionAndAnotherAction } from "./actions";

export default function NewActionPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const created = searchParams.get("created");
  // Bumped after each "Save & add another" so the form starts empty with a
  // fresh submission token — landing back on /actions/new?created=1 from
  // /actions/new?created=1 wouldn't remount the page on its own, and a
  // reused token would quietly fold the next Action into the last one.
  const [round, setRound] = useState(0);
  const view = useActionsView("newForm");
  if (!view.data) return <Loading />;

  // Everyone who can reach this page is already a manager/admin (the
  // loader checks), so the "Assign to" dropdown always shows.
  const { assignees } = view.data;

  const saveAndAddAnother = async (formData: FormData) => {
    try {
      await createActionAndAnotherAction(formData);
    } catch (err) {
      // Only once it's saved — an ?error= redirect keeps what was typed
      // (and the token, since nothing was created).
      const digest = String((err as { digest?: unknown } | null)?.digest ?? "");
      if (isRedirect(err) && !digest.includes("error=")) setRound((r) => r + 1);
      throw err;
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Raise an Action</h1>
      <PageError />
      {created && !error && (
        <p className="mb-4 max-w-md rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Action raised. Add another below, or{" "}
          <Link href="/actions" className="font-semibold underline">
            go back to Actions
          </Link>
          .
        </p>
      )}

      <form
        key={round}
        action={createActionAction}
        encType="multipart/form-data"
        className="flex max-w-md flex-col gap-4"
      >
        {/* One per form, so both presses of one button carry the same
            value and the second is rejected as a duplicate server-side. */}
        <SubmissionToken />

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

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Submitting…">Submit</SubmitButton>
          <SubmitButton
            formAction={saveAndAddAnother}
            pendingLabel="Saving…"
            className="self-start rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save &amp; add another
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
