import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { BankFields, EmergencyFields, PersonalFields } from "@/components/employee-details-fields";
import { EmployeeDocumentPicker } from "@/components/employee-document-picker";
import { HmrcStatementPicker } from "@/components/hmrc-statement-picker";
import { documentsWithUrls } from "@/lib/onboarding/details";
import type { EmployeeDetails, EmployeeDocument } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { saveOnboardingDraftAction, submitOnboardingAction } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string; draft?: string }>;
}) {
  const { supabase, user, profile } = await requireUser();
  const { error, submitted, draft } = await searchParams;

  // Anyone who doesn't need this shouldn't be able to sit on the page.
  if (profile.onboarding_status === "approved" || profile.onboarding_status === "not_required") {
    redirect("/");
  }

  const [{ data: details }, { data: documents }] = await Promise.all([
    supabase.from("employee_details").select("*").eq("staff_id", user.id).maybeSingle<EmployeeDetails>(),
    supabase
      .from("employee_documents")
      .select("*")
      .eq("staff_id", user.id)
      .order("created_at")
      .returns<EmployeeDocument[]>(),
  ]);

  const uploaded = await documentsWithUrls(documents ?? []);

  const waiting = profile.onboarding_status === "submitted";
  const sentBack = profile.onboarding_status === "pending" && !!details?.review_note;
  // A row with no submitted_at is a part-finished draft they came back to.
  const resumed = !!details && !details.submitted_at;

  if (waiting) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-primary">Thanks — that&apos;s with us</h1>
        <div className="rounded-lg border border-border bg-muted p-5 text-sm">
          <p className="mb-2">
            Your details have been sent to a manager to check over. You&apos;ll get an email as soon
            as they&apos;re approved, and the rest of the portal will open up.
          </p>
          <p className="text-muted-foreground">
            If something needs correcting we&apos;ll send it back with a note rather than making you
            start again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Welcome — a few details first</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        We need these before we can put you on payroll, so the rest of the portal is closed until
        they&apos;re in and approved. It takes about five minutes.
      </p>

      {submitted && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Sent — thanks.</p>
      )}
      {draft && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Saved. Come back whenever you&apos;re ready — nothing has been sent yet.
        </p>
      )}
      {resumed && !draft && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          Picked up where you left off
          {details?.updated_at ? ` — last saved ${formatDateTime(details.updated_at)}` : ""}. Nothing
          has been sent yet.
        </p>
      )}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {sentBack && (
        <div className="mb-6 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <p className="mb-1 font-semibold">This needs a correction before we can approve it</p>
          <p>{details?.review_note}</p>
          <p className="mt-2 text-xs">Everything you filled in before is still here — just fix that bit.</p>
        </div>
      )}

      <form action={submitOnboardingAction} className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-lg font-bold text-primary">About you</h2>
          <PersonalFields details={details ?? null} email={profile.email} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-primary">HMRC Starter Checklist</h2>
          <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
            Fill in the{" "}
            <a
              href="https://www.gov.uk/guidance/starter-checklist-for-paye"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline"
            >
              HMRC Starter Checklist
            </a>
            , download the completed copy, and upload it here. Ignore the bit about working
            overseas. Without this we can&apos;t run your payroll.
          </p>
          <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
            If you printed it and filled it in by hand, photograph every page and add them all —
            you can attach as many files as you need.
          </p>

          {uploaded.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-sm font-medium text-green-700">Already uploaded</p>
              <ul className="flex flex-col gap-1 text-sm">
                {uploaded.map((d) => (
                  <li key={d.id}>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {d.file_name}
                      </a>
                    ) : (
                      d.file_name
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <EmployeeDocumentPicker staffId={user.id} label="+ Add a page" />

          <div className="mt-6">
            <p className="mb-1 text-sm font-medium">
              Which statement did you tick — A, B or C?
            </p>
            <p className="mb-3 max-w-2xl text-xs text-muted-foreground">
              It&apos;s the question on the checklist about whether you&apos;ve had another job
              since 6 April. Pick the one that matches what you put — it sets the tax code on your
              first payslip.
            </p>
            <HmrcStatementPicker defaultValue={details?.hmrc_statement} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-primary">Emergency contact</h2>
          <EmergencyFields details={details ?? null} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-primary">Where we pay you</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Changing these later needs a manager to ring you first — that&apos;s deliberate, it&apos;s
            how payroll fraud usually starts.
          </p>
          <BankFields details={details ?? null} />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Sending…">Send for approval</SubmitButton>
          {/* No validation on this one — the point is to save what you have
              when you're stuck, not to be blocked by the boxes you haven't
              got to yet. */}
          <SubmitButton
            formAction={saveOnboardingDraftAction}
            formNoValidate
            pendingLabel="Saving…"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Save and finish later
          </SubmitButton>
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          Stuck on the HMRC checklist? Save what you&apos;ve got and come back to it — everything
          stays exactly as you left it, and nothing goes to a manager until you send it.
        </p>
      </form>
    </div>
  );
}
