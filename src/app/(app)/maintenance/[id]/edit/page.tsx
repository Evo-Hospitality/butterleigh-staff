"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageError } from "@/components/page-error";
import { SubmitButton } from "@/components/submit-button";
import Loading from "../../../loading";
import { useMaintenanceView } from "../../data";
import { editMaintenanceRequestAction } from "./actions";

export default function EditMaintenanceRequestPage() {
  const { id } = useParams<{ id: string }>();
  // The loader sends you back to the request if it isn't yours to edit or
  // is already closed.
  const view = useMaintenanceView("edit", { id });
  if (view.notFound) return <p className="text-sm text-muted-foreground">Request not found.</p>;
  if (!view.data) return <Loading />;

  const request = view.data;
  const editBound = editMaintenanceRequestAction.bind(null, id);

  return (
    <div>
      <Link href={`/maintenance/${id}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to request
      </Link>

      <h1 className="mt-2 mb-6 text-2xl font-bold text-primary">Edit request</h1>

      <PageError />

      <form action={editBound} className="flex max-w-md flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            defaultValue={request.title}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description (optional)</label>
          <textarea
            name="description"
            rows={4}
            defaultValue={request.description ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Reassigning and the photo are handled on the request itself. Editing is recorded in the log.
        </p>

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          <Link
            href={`/maintenance/${id}`}
            className="self-start rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
