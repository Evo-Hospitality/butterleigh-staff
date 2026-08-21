import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { BankChangeRequest, EmployeeDetails, Profile } from "@/lib/types";
import { decideBankChangeAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  not_required: "Not required",
  pending: "Not started",
  submitted: "Waiting on you",
  approved: "Approved",
};

export default async function AdminOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const [{ data: staff }, { data: details }, { data: bankRequests }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase.from("employee_details").select("*").returns<EmployeeDetails[]>(),
    supabase
      .from("bank_change_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at")
      .returns<BankChangeRequest[]>(),
  ]);

  const detailsByStaff = new Map((details ?? []).map((d) => [d.staff_id, d]));
  const all = staff ?? [];
  const waiting = all.filter((p) => p.onboarding_status === "submitted");
  const pendingBank = bankRequests ?? [];

  const notice =
    (params.approved && "Approved — they've got full access now.") ||
    (params.sentback && "Sent back with your note.") ||
    (params.bankapproved && "Bank details updated.") ||
    (params.bankrejected && "Bank change rejected — nothing was altered.") ||
    null;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Employee details</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        New starters can&apos;t use any part of the portal until their details are in and approved
        here. Existing staff are marked &quot;not required&quot; — fill their details in yourself
        from the old records.
      </p>

      {notice && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {params.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-primary">Waiting for review ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-semibold">{person.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {detailsByStaff.get(person.id)?.submitted_at
                      ? formatDateTime(detailsByStaff.get(person.id)!.submitted_at!)
                      : "—"}
                  </p>
                </div>
                <Link
                  href={`/admin/onboarding/${person.id}`}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold text-primary">
          Bank changes to approve ({pendingBank.length})
        </h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          <strong>Ring them first.</strong> A bank change arriving by email is exactly what payroll
          fraud looks like, so confirm by voice — on the number already on file, not one in the
          request — that they really asked for it.
        </p>
        {pendingBank.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingBank.map((request) => (
              <li key={request.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold">{request.staff_name}</p>
                <p className="mb-1 text-xs text-muted-foreground">
                  Requested {formatDateTime(request.requested_at)} · phone on file:{" "}
                  {detailsByStaff.get(request.staff_id)?.mobile_phone ?? "none"}
                </p>
                <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Currently</dt>
                    <dd>
                      {request.previous_bank_name ?? "—"} · {request.previous_bank_sort_code ?? "—"} ·{" "}
                      {request.previous_bank_account_number ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Requested</dt>
                    <dd className="font-medium">
                      {request.bank_name} · {request.bank_sort_code} · {request.bank_account_number}
                    </dd>
                  </div>
                </dl>
                <form action={decideBankChangeAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <div className="min-w-[16rem] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Note (optional — they&apos;ll see it)
                    </label>
                    <input
                      name="review_note"
                      className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  {/* Plain buttons, not SubmitButton: which one was pressed
                      is carried by name/value, which SubmitButton doesn't
                      forward. */}
                  <button
                    type="submit"
                    name="approve"
                    value="1"
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    name="approve"
                    value="0"
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-700"
                  >
                    Reject
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-primary">Everyone</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Onboarding</th>
                <th className="py-2 pr-3">Details on file</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {all.map((person) => {
                const detail = detailsByStaff.get(person.id);
                const complete = !!(detail?.home_address && detail?.ni_number && detail?.bank_account_number);
                return (
                  <tr key={person.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{person.full_name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {STATUS_LABEL[person.onboarding_status] ?? person.onboarding_status}
                    </td>
                    <td className="py-2 pr-3">
                      {complete ? (
                        <span className="text-green-700">Complete</span>
                      ) : detail ? (
                        <span className="text-yellow-700">Partial</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/admin/onboarding/${person.id}`} className="text-accent hover:underline">
                        {detail ? "View / edit" : "Add details"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
