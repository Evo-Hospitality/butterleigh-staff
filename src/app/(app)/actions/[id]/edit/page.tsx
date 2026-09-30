"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { PageError } from "@/components/page-error";
import Loading from "../../../loading";
import { useActionsView } from "../../data";
import { editActionAction } from "./actions";

export default function EditActionPage() {
  const { id } = useParams<{ id: string }>();
  // The loader sends anyone who can't edit this (or once it's closed) back
  // to the Action itself.
  const view = useActionsView("edit", { id });
  if (view.notFound) return <p className="text-sm text-muted-foreground">Action not found.</p>;
  if (!view.data) return <Loading />;

  const action = view.data;
  const editBound = editActionAction.bind(null, id);

  return (
    <div>
      <Link href={`/actions/${id}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Action
      </Link>

      <h1 className="mt-2 mb-6 text-2xl font-bold text-primary">Edit Action</h1>

      <PageError />

      <form action={editBound} className="flex max-w-md flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            defaultValue={action.title}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={action.notes ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Reassigning and the photo are handled on the Action itself. Editing is recorded in the log.
        </p>

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          <Link
            href={`/actions/${id}`}
            className="self-start rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
