import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { LeaveBalance, LeaveRequest, LieuRequest } from "@/lib/types";
import { cancelLeaveRequest, cancelLieuRequest } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export default async function HolidayPage() {
  const { supabase, user, profile } = await requireUser();
  const year = new Date().getFullYear();
  const isSalaried = profile.employment_type === "salaried";

  const [{ data: balance }, { data: leaveRequests }, { data: lieuRequests }] = await Promise.all([
    supabase
      .from("leave_balances")
      .select("*")
      .eq("staff_id", user.id)
      .eq("leave_year", year)
      .maybeSingle<LeaveBalance>(),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("staff_id", user.id)
      .order("created_at", { ascending: false })
      .returns<LeaveRequest[]>(),
    isSalaried
      ? supabase
          .from("lieu_requests")
          .select("*")
          .eq("staff_id", user.id)
          .order("created_at", { ascending: false })
          .returns<LieuRequest[]>()
      : Promise.resolve({ data: [] as LieuRequest[] }),
  ]);

  const remaining = isSalaried
    ? (balance?.brought_forward ?? 0) + (balance?.base_allowance ?? profile.annual_allowance_days ?? 0) +
      (balance?.lieu_days_earned ?? 0) - (balance?.used_days ?? 0)
    : (balance?.brought_forward ?? 0) + (balance?.accrued_hours ?? 0) - (balance?.used_hours ?? 0);

  const unit = isSalaried ? "days" : "hours";

  const combined = [
    ...(leaveRequests ?? []).map((r) => ({ ...r, kind: "holiday" as const })),
    ...(lieuRequests ?? []).map((r) => ({ ...r, kind: "lieu" as const })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Holiday</h1>

      <div className="mb-6 rounded-lg border border-border bg-muted p-5">
        <p className="text-sm text-muted-foreground">Remaining balance for {year}</p>
        <p className="text-3xl font-bold text-primary">
          {remaining.toFixed(2)} {unit}
        </p>
        {balance && (
          <p className="mt-2 text-xs text-muted-foreground">
            Brought forward {balance.brought_forward} + {isSalaried
              ? `allowance ${balance.base_allowance} + lieu earned ${balance.lieu_days_earned}`
              : `accrued ${balance.accrued_hours.toFixed(2)}`} − used {isSalaried ? balance.used_days : balance.used_hours.toFixed(2)}
          </p>
        )}
      </div>

      <div className="mb-8 flex gap-3">
        <Link
          href="/holiday/request"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Request holiday
        </Link>
        {isSalaried && (
          <Link
            href="/holiday/lieu/request"
            className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-white"
          >
            Request a day in lieu
          </Link>
        )}
      </div>

      <h2 className="mb-3 text-lg font-bold text-primary">My requests</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Date(s)</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {combined.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-t border-border">
                <td className="px-4 py-2 capitalize">{r.kind === "holiday" ? "Holiday" : "Day in lieu"}</td>
                <td className="px-4 py-2">
                  {r.kind === "holiday" ? `${r.start_date} to ${r.end_date}` : r.work_date}
                </td>
                <td className="px-4 py-2">{r.kind === "holiday" ? `${r.amount} ${unit}` : "+1 day"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {r.status === "pending" && (
                    <form
                      action={(r.kind === "holiday" ? cancelLeaveRequest : cancelLieuRequest).bind(null, r.id)}
                    >
                      <button type="submit" className="text-red-600 hover:underline">
                        Cancel
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {combined.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
