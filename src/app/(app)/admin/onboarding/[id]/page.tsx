import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/format";
import { adminDocumentPrefix, documentTypeNames, documentsWithUrls } from "@/lib/onboarding/details";
import { EmployeeDocumentPicker } from "@/components/employee-document-picker";
import { DocumentTypeSelect } from "@/components/document-type-select";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SortCodeInput } from "@/components/sort-code-input";
import type { EmployeeDetails, EmployeeDocument, Profile } from "@/lib/types";
import {
  approveOnboardingAction,
  deleteEmployeeDocumentAction,
  saveEmployeeDetailsAction,
  setDocumentVisibilityAction,
  sendBackOnboardingAction,
  setOnboardingRequiredAction,
  uploadEmployeeDocumentsAction,
} from "../actions";

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

export default async function AdminEmployeeDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { data: person } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!person) {
    notFound();
  }

  const [{ data: details }, { data: documents }] = await Promise.all([
    supabase.from("employee_details").select("*").eq("staff_id", id).maybeSingle<EmployeeDetails>(),
    supabase
      .from("employee_documents")
      .select("*")
      .eq("staff_id", id)
      .order("created_at")
      .returns<EmployeeDocument[]>(),
  ]);

  // Minted per view and short-lived — the bucket is private, so there is no
  // URL that keeps working after this page is closed.
  const [uploaded, typeNames] = await Promise.all([
    documentsWithUrls(documents ?? []),
    documentTypeNames(supabase),
  ]);

  const awaitingReview = person.onboarding_status === "submitted";

  return (
    <div>
      <Link href="/admin/onboarding" className="mb-4 inline-block text-sm text-accent hover:underline">
        ← Back to employee details
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-primary">{person.full_name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {person.email} ·{" "}
        <Link href={`/admin/staff/${person.id}`} className="text-accent hover:underline">
          change login email
        </Link>
      </p>

      {saved && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Saved.</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {awaitingReview && (
        <section className="mb-8 rounded-lg border border-accent bg-muted p-5">
          <h2 className="mb-1 text-lg font-bold text-primary">Waiting for your review</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Submitted {details?.submitted_at ? formatDateTime(details.submitted_at) : "—"}. Until you
            approve it, they can&apos;t open any part of the portal.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <form action={approveOnboardingAction}>
              <input type="hidden" name="staff_id" value={person.id} />
              <SubmitButton pendingLabel="Approving…">Approve</SubmitButton>
            </form>
            <form action={sendBackOnboardingAction} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="staff_id" value={person.id} />
              <div className="min-w-[16rem] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  What needs correcting? (they&apos;ll see this)
                </label>
                <input
                  name="review_note"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
              </div>
              <SubmitButton
                pendingLabel="Sending…"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Send back
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold text-primary">Documents</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          Their whole staff file — starter checklist, contract, warning letters, right-to-work
          checks. Several photos of a printed form count as one document filed several times over;
          add them all.
        </p>

        {uploaded.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">Nothing uploaded.</p>
        ) : (
          <ul className="mb-4 flex max-w-xl flex-col gap-2">
            {uploaded.map((d) => (
              <li key={d.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-primary">
                      {d.document_type}
                    </span>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent hover:underline"
                      >
                        {d.file_name}
                      </a>
                    ) : (
                      d.file_name
                    )}
                  </span>
                  <ConfirmDeleteButton
                    action={deleteEmployeeDocumentAction.bind(null, d.id, person.id)}
                    label="Delete"
                    confirmMessage={`Delete "${d.file_name}"? This removes the file for good.`}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {formatDateTime(d.created_at)}
                    {d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      d.visible_to_staff ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-900"
                    }`}
                  >
                    {d.visible_to_staff ? "They can see this" : "Internal — they can't see it"}
                  </span>
                  <form action={setDocumentVisibilityAction.bind(null, d.id, person.id, !d.visible_to_staff)}>
                    <button
                      type="submit"
                      className="rounded-md border border-border bg-white px-2 py-0.5 font-semibold text-primary hover:border-accent hover:text-accent"
                    >
                      {d.visible_to_staff ? "Make internal" : "Share with them"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Numbered, and the file comes first: setting a type and a
            visibility before you've chosen anything reads as unrelated to
            the document you're about to add, which is exactly how it got
            missed. */}
        <form
          action={uploadEmployeeDocumentsAction}
          className="flex max-w-xl flex-col gap-5 rounded-lg border border-border bg-muted p-5"
        >
          <h3 className="font-bold text-primary">Add a document</h3>
          <input type="hidden" name="staff_id" value={person.id} />

          <div>
            <p className="mb-2 text-sm font-medium">1. Choose the file or files</p>
            {/* Filed outside their own storage folder, so an internal
                document can't be read straight out of storage. */}
            <EmployeeDocumentPicker
              staffId={person.id}
              pathPrefix={adminDocumentPrefix(person.id)}
              label="+ Choose a file"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">2. What is it?</p>
            <DocumentTypeSelect types={typeNames} label={null} />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              3. Can {person.full_name} see it?
            </legend>
            {/* Two explicit choices rather than a tick box: whether someone
                reads their own warning letter is too consequential to hinge
                on an unticked box nobody noticed. */}
            <label className="mb-2 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="visible_to_staff"
                value="0"
                defaultChecked
                className="mt-1"
              />
              <span>
                <span className="font-medium">No — internal only</span>
                <span className="block text-xs text-muted-foreground">
                  Admins only. A warning letter, a note to file, anything they shouldn&apos;t read.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="visible_to_staff" value="1" className="mt-1" />
              <span>
                <span className="font-medium">Yes — show it on their My details page</span>
                <span className="block text-xs text-muted-foreground">
                  Their contract, offer letter, training certificate. You can change this later.
                </span>
              </span>
            </label>
          </fieldset>

          <SubmitButton pendingLabel="Saving…">Save to their file</SubmitButton>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold text-primary">Details on file</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Editable here — this is also how you copy an existing member of staff&apos;s details
          across from the old records.
        </p>
        <form action={saveEmployeeDetailsAction} className="flex max-w-xl flex-col gap-4">
          <input type="hidden" name="staff_id" value={person.id} />
          <Field label="Full name" name="full_name" defaultValue={details?.full_name ?? person.full_name} />
          <Field label="Start date" name="start_date" type="date" defaultValue={details?.start_date} />
          <Field label="Date of birth" name="date_of_birth" type="date" defaultValue={details?.date_of_birth} />
          <Field label="National Insurance number" name="ni_number" defaultValue={details?.ni_number} />
          <div>
            <label className="mb-1 block text-sm font-medium">Home address</label>
            <textarea
              name="home_address"
              rows={3}
              defaultValue={details?.home_address ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <Field label="Mobile phone number" name="mobile_phone" type="tel" defaultValue={details?.mobile_phone} />

          <h3 className="mt-2 font-semibold text-primary">Emergency contact</h3>
          <Field label="Name" name="emergency_contact_name" defaultValue={details?.emergency_contact_name} />
          <Field
            label="Phone number"
            name="emergency_contact_phone"
            type="tel"
            defaultValue={details?.emergency_contact_phone}
          />
          <Field
            label="Email"
            name="emergency_contact_email"
            type="email"
            defaultValue={details?.emergency_contact_email}
          />

          <h3 className="mt-2 font-semibold text-primary">Bank details</h3>
          <Field label="Bank name" name="bank_name" defaultValue={details?.bank_name} />
          <div>
            <label className="mb-1 block text-sm font-medium">Sort code</label>
            <SortCodeInput defaultValue={details?.bank_sort_code} required={false} />
          </div>
          <Field label="Account number" name="bank_account_number" defaultValue={details?.bank_account_number} />

          <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold text-primary">Onboarding form</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          {person.onboarding_status === "not_required"
            ? "They aren't being asked to fill the starter form in — the portal is open to them as normal."
            : person.onboarding_status === "approved"
              ? "Approved. They have full access."
              : "The portal is closed to them until this is completed and approved."}
        </p>
        <form action={setOnboardingRequiredAction}>
          <input type="hidden" name="staff_id" value={person.id} />
          <input
            type="hidden"
            name="required"
            value={person.onboarding_status === "not_required" ? "1" : "0"}
          />
          <SubmitButton
            pendingLabel="Saving…"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {person.onboarding_status === "not_required"
              ? "Ask them to complete the starter form"
              : "Skip the starter form for this person"}
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
