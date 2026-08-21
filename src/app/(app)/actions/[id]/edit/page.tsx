import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActionItemsAccess } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import type { ActionItem } from "@/lib/types";
import { editActionAction } from "./actions";

export default async function EditActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireActionItemsAccess();

  const { data: action } = await supabase
    .from("action_items")
    .select("*")
    .eq("id", id)
    .single<ActionItem>();

  if (!action) {
    notFound();
  }

  // Mirrors edit_action_item()'s own check — this is for the UX (don't show
  // a form that's going to be refused); the RPC is the real boundary.
  const canEdit =
    action.submitted_by === user.id || action.assigned_to === user.id || profile.role === "admin";
  if (!canEdit || action.status !== "open") {
    redirect(`/actions/${id}`);
  }

  const editBound = editActionAction.bind(null, id);

  return (
    <div>
      <Link href={`/actions/${id}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Action
      </Link>

      <h1 className="mt-2 mb-6 text-2xl font-bold text-primary">Edit Action</h1>

      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

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
