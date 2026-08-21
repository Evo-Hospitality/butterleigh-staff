import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateTime } from "@/lib/format";
import type { BankChangeRequest, EmployeeDetails } from "@/lib/types";
import { requestBankChangeAction, updateMyContactDetailsAction } from "./actions";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-1 text-xs text-muted-foreground">{hint}</p>}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

export default async function MyDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; bank?: string }>;
}) {
  const { supabase, user, profile } = await requireUser();
  const { error, saved, bank } = await searchParams;

  const [{ data: details }, { data: bankRequests }] = await Promise.all([
    supabase.from("employee_details").select("*").eq("staff_id", user.id).maybeSingle<EmployeeDetails>(),
    supabase
      .from("bank_change_requests")
      .select("*")
      .eq("staff_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(5)
      .returns<BankChangeRequest[]>(),
  ]);

  const pendingBank = (bankRequests ?? []).find((r) => r.status === "pending");
  const decided = (bankRequests ?? []).filter((r) => r.status !== "pending");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">My details</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        What payroll holds for you. Keep your address, phone number and emergency contact up to
        date — we use them if something goes wrong on a shift.
      </p>

      {saved && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>}
      {bank && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Sent. A manager will ring you to check it&apos;s really you before it takes effect.
        </p>
      )}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mb-8 max-w-xl rounded-lg border border-border bg-muted p-5">
        <h2 className="mb-1 text-lg font-bold text-primary">On record</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          If any of this is wrong, ask an admin — it can&apos;t be changed here.
        </p>
        <Row label="Name" value={details?.full_name || profile.full_name} />
        <Row label="Start date" value={details?.start_date ? formatDate(details.start_date) : null} />
        <Row label="Date of birth" value={details?.date_of_birth ? formatDate(details.date_of_birth) : null} />
        <Row label="National Insurance number" value={details?.ni_number ?? null} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-primary">Contact details</h2>
        <form action={updateMyContactDetailsAction} className="flex max-w-xl flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Home address</label>
            <textarea
              name="home_address"
              required
              rows={3}
              defaultValue={details?.home_address ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <Field label="Mobile phone number" name="mobile_phone" type="tel" defaultValue={details?.mobile_phone} />
          <Field
            label="Email address"
            name="email"
            type="email"
            defaultValue={profile.email}
            hint="This is also how you sign in — changing it changes your login."
          />
          <Field
            label="Emergency contact name"
            name="emergency_contact_name"
            defaultValue={details?.emergency_contact_name}
          />
          <Field
            label="Emergency contact phone number"
            name="emergency_contact_phone"
            type="tel"
            defaultValue={details?.emergency_contact_phone}
          />
          <Field
            label="Emergency contact email"
            name="emergency_contact_email"
            type="email"
            required={false}
            defaultValue={details?.emergency_contact_email}
          />
          <SubmitButton pendingLabel="Saving…">Save contact details</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold text-primary">Bank details</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          These don&apos;t change straight away. A manager rings you on the number above to check
          the request really came from you — a fake &quot;please pay me here instead&quot; email is
          the usual way payroll gets stolen, so the phone call is the point.
        </p>

        <div className="mb-4 max-w-xl rounded-lg border border-border bg-muted p-5">
          <Row label="Bank" value={details?.bank_name ?? null} />
          <Row label="Sort code" value={details?.bank_sort_code ?? null} />
          <Row label="Account number" value={details?.bank_account_number ?? null} />
        </div>

        {pendingBank ? (
          <div className="max-w-xl rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            <p className="mb-1 font-semibold">A change is waiting to be approved</p>
            <p>
              {pendingBank.bank_name} · {pendingBank.bank_sort_code} · {pendingBank.bank_account_number}
            </p>
            <p className="mt-1 text-xs">Requested {formatDateTime(pendingBank.requested_at)}.</p>
          </div>
        ) : (
          <form action={requestBankChangeAction} className="flex max-w-xl flex-col gap-4">
            <Field label="Bank name" name="bank_name" defaultValue={details?.bank_name} />
            <Field
              label="Sort code"
              name="bank_sort_code"
              defaultValue={details?.bank_sort_code}
              hint="Six digits, e.g. 12-34-56"
            />
            <Field
              label="Account number"
              name="bank_account_number"
              defaultValue={details?.bank_account_number}
              hint="Eight digits"
            />
            <SubmitButton pendingLabel="Sending…">Request bank change</SubmitButton>
          </form>
        )}

        {decided.length > 0 && (
          <div className="mt-6 max-w-xl text-sm">
            <h3 className="mb-2 font-semibold text-primary">Previous requests</h3>
            <ul className="flex flex-col gap-2">
              {decided.map((r) => (
                <li key={r.id} className="rounded-md border border-border px-3 py-2">
                  <span className={r.status === "approved" ? "text-green-700" : "text-red-700"}>
                    {r.status === "approved" ? "Approved" : "Rejected"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {r.reviewed_at ? formatDateTime(r.reviewed_at) : ""}
                    {r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}
                  </span>
                  {r.review_note && <p className="mt-1 text-muted-foreground">{r.review_note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
