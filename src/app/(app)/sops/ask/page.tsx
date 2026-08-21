import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import { askQuestionAction } from "./actions";

export default async function AskSopQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Ask a question</h1>
      {error && (
        <p className="mb-4 max-w-md rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={askQuestionAction} className="flex max-w-md flex-col gap-4">
        <input type="hidden" name="submission_token" value={crypto.randomUUID()} />
        <div>
          <label className="mb-1 block text-sm font-medium">Your question</label>
          <textarea
            name="title"
            required
            rows={4}
            placeholder="e.g. How do I process a refund on the EPOS?"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <SubmitButton pendingLabel="Submitting…">Submit</SubmitButton>
      </form>
    </div>
  );
}
