import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { requestLieuDay } from "./actions";

export default async function RequestLieuDayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireUser();
  const { error } = await searchParams;

  if (profile.employment_type !== "salaried") {
    redirect("/holiday");
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-primary">Request a day in lieu</h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Use this when you&apos;ve been asked to work on a day outside your normal working days (for
        example, a bank holiday Monday when you don&apos;t usually work Mondays). Once approved, it
        adds a day to your holiday allowance for the year.
      </p>
      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={requestLieuDay} className="flex max-w-md flex-col gap-4">
        <input type="hidden" name="submission_token" value={crypto.randomUUID()} />
        <div>
          <label className="mb-1 block text-sm font-medium">Date you worked / will work</label>
          <input
            name="work_date"
            type="date"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>
      </form>
    </div>
  );
}
