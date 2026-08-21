import { requireApprover } from "@/lib/auth";
import type { LeaveRequest, LieuRequest, Profile } from "@/lib/types";
import { approveLeave, rejectLeave, approveLieu, rejectLieu } from "./actions";
import { RejectButton } from "./reject-button";
import { formatDateOnly } from "@/lib/format";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, user } = await requireApprover();
  const { error } = await searchParams;

  const [{ data: leaveRequests }, { data: lieuRequests }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at")
      .returns<LeaveRequest[]>(),
    supabase
      .from("lieu_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at")
      .returns<LieuRequest[]>(),
  ]);

  // RLS already scoped these to "my reports, or all if I'm admin" — drop my
  // own pending requests, which I can't approve for myself.
  const pendingLeave = (leaveRequests ?? []).filter((r) => r.staff_id !== user.id);
  const pendingLieu = (lieuRequests ?? []).filter((r) => r.staff_id !== user.id);

  const staffIds = Array.from(new Set([...pendingLeave, ...pendingLieu].map((r) => r.staff_id)));
  const { data: staff } = staffIds.length
    ? await supabase.from("profiles").select("*").in("id", staffIds).returns<Profile[]>()
    : { data: [] as Profile[] };
  const nameById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Approvals</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <h2 className="mb-3 text-lg font-bold text-primary">Holiday requests</h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Dates</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Notes</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {pendingLeave.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{nameById.get(r.staff_id) ?? "—"}</td>
                <td className="px-4 py-2">{formatDateOnly(r.start_date)} to {formatDateOnly(r.end_date)}</td>
                <td className="px-4 py-2">
                  {r.amount}
                  {r.is_unpaid && (
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      unpaid
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <form action={approveLeave.bind(null, r.id)}>
                      <button type="submit" className="text-green-700 hover:underline">
                        Approve
                      </button>
                    </form>
                    <RejectButton action={rejectLeave.bind(null, r.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {pendingLeave.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                  Nothing pending.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">Day-in-lieu requests</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Work date</th>
              <th className="px-4 py-2 font-medium">Notes</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {pendingLieu.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{nameById.get(r.staff_id) ?? "—"}</td>
                <td className="px-4 py-2">{formatDateOnly(r.work_date)}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <form action={approveLieu.bind(null, r.id)}>
                      <button type="submit" className="text-green-700 hover:underline">
                        Approve
                      </button>
                    </form>
                    <RejectButton action={rejectLieu.bind(null, r.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {pendingLieu.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                  Nothing pending.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
