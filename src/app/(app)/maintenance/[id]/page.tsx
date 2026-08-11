import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMaintenanceAccess } from "@/lib/auth";
import { canBeAssignedMaintenance, type MaintenanceRequest, type MaintenanceUpdateEntry, type Profile } from "@/lib/types";
import { addNoteAction, deleteRequestAction, reassignAction, setStatusAction } from "./actions";
import { DeleteRequestButton } from "./delete-button";

function StatusBadge({ status }: { status: string }) {
  const style = status === "open" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>{status}</span>;
}

const KIND_LABEL: Record<string, string> = {
  note: "",
  reassigned: "Reassigned",
  status_changed: "Status change",
};

export default async function MaintenanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireMaintenanceAccess();

  const [{ data: request }, { data: updates }] = await Promise.all([
    supabase.from("maintenance_requests").select("*").eq("id", id).single<MaintenanceRequest>(),
    supabase
      .from("maintenance_updates")
      .select("*")
      .eq("request_id", id)
      .order("created_at")
      .returns<MaintenanceUpdateEntry[]>(),
  ]);

  if (!request) {
    notFound();
  }

  const canManage = request.assigned_to === user.id || profile.role === "admin";

  let assignees: Profile[] = [];
  if (canManage) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("full_name")
      .returns<Profile[]>();
    assignees = (data ?? []).filter((a) => canBeAssignedMaintenance(a) && a.id !== request.assigned_to);
  }

  const closeAction = setStatusAction.bind(null, id, "closed");
  const reopenAction = setStatusAction.bind(null, id, "open");
  const noteAction = addNoteAction.bind(null, id);
  const reassignBound = reassignAction.bind(null, id);
  const deleteBound = deleteRequestAction.bind(null, id);
  const canDelete = profile.role === "admin" && request.status === "closed";

  return (
    <div>
      <Link href="/maintenance" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to Maintenance
      </Link>

      <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-primary">{request.title}</h1>
        <StatusBadge status={request.status} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Reported by {request.submitted_by_name} · Assigned to {request.assigned_to_name}
      </p>

      {error && (
        <p className="mb-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {request.description && (
        <p className="mb-4 max-w-lg whitespace-pre-wrap text-sm">{request.description}</p>
      )}

      {request.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={request.photo_url}
          alt=""
          className="mb-6 max-w-sm rounded-lg border border-border"
        />
      )}

      {canManage && (
        <div className="mb-8 flex max-w-lg flex-col gap-3 rounded-lg border border-border bg-muted p-4">
          <form action={noteAction} className="flex flex-col gap-2">
            <label className="text-sm font-medium">Add an update</label>
            <textarea
              name="note"
              required
              rows={2}
              placeholder="What's been done, what's next…"
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Post update
            </button>
          </form>

          <div className="flex flex-wrap gap-3 border-t border-border pt-3">
            <form action={reassignBound} className="flex items-center gap-2">
              <select name="assigned_to" className="rounded-md border border-border px-2 py-1.5 text-sm">
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
              >
                Reassign
              </button>
            </form>

            <form action={request.status === "open" ? closeAction : reopenAction}>
              <button
                type="submit"
                className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium hover:border-accent"
              >
                {request.status === "open" ? "Mark complete" : "Reopen"}
              </button>
            </form>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold text-primary">Log</h2>
      <div className="space-y-3">
        {(updates ?? []).map((u) => (
          <div key={u.id} className="rounded-md border border-border p-3 text-sm">
            <p className="mb-1 text-xs text-muted-foreground">
              {u.author_name} · {new Date(u.created_at).toLocaleString()}
              {KIND_LABEL[u.kind] && ` · ${KIND_LABEL[u.kind]}`}
            </p>
            <p>{u.note}</p>
          </div>
        ))}
        {(!updates || updates.length === 0) && (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        )}
      </div>

      {canDelete && (
        <div className="mt-8 max-w-lg">
          <DeleteRequestButton title={request.title} action={deleteBound} />
        </div>
      )}
    </div>
  );
}
