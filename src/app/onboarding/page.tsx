import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { BankFields, EmergencyFields, PersonalFields } from "@/components/employee-details-fields";
import type { EmployeeDetails } from "@/lib/types";
import { submitOnboardingAction } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { supabase, user, profile } = await requireUser();
  const { error, submitted } = await searchParams;

  // Anyone who doesn't need this shouldn't be able to sit on the page.
  if (profile.onboarding_status === "approved" || profile.onboarding_status === "not_required") {
    redirect("/");
  }

  const { data: details } = await supabase
    .from("employee_details")
    .select("*")
    .eq("staff_id", user.id)
    .maybeSingle<EmployeeDetails>();

  const waiting = profile.onboarding_status === "submitted";
  const sentBack = profile.onboarding_status === "pending" && !!details?.review_note;

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
              href="https://www.tax.service.gov.uk/register-employee/employment-details"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline"
            >
              HMRC Starter Checklist
            </a>
            , download the completed copy, and upload it here. Ignore the bit about working
            overseas. Without this we can&apos;t run your payroll.
            {details?.hmrc_checklist_path && (
              <span className="mt-1 block text-green-700">
                You&apos;ve already uploaded one — only choose a file if you&apos;re replacing it.
              </span>
            )}
          </p>
          <input
            type="file"
            name="hmrc_checklist"
            accept=".pdf,image/*"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:border-accent hover:file:text-accent"
          />
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

        <SubmitButton pendingLabel="Sending…">Send for approval</SubmitButton>
      </form>
    </div>
  );
}
