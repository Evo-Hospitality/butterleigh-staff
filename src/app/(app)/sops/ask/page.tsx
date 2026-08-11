import { requireUser } from "@/lib/auth";
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
        <button
          type="submit"
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
