import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMaintenanceAccess } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import type { MaintenanceRequest } from "@/lib/types";
import { editMaintenanceRequestAction } from "./actions";

export default async function EditMaintenanceRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireMaintenanceAccess();

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", id)
    .single<MaintenanceRequest>();

  if (!request) {
    notFound();
  }

  // Mirrors edit_maintenance_request()'s own check — UX only; the RPC is
  // the real boundary.
  const canEdit =
    request.submitted_by === user.id || request.assigned_to === user.id || profile.role === "admin";
  if (!canEdit || request.status !== "open") {
    redirect(`/maintenance/${id}`);
  }

  const editBound = editMaintenanceRequestAction.bind(null, id);

  return (
    <div>
      <Link href={`/maintenance/${id}`} className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to request
      </Link>

      <h1 className="mt-2 mb-6 text-2xl font-bold text-primary">Edit request</h1>

      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

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
