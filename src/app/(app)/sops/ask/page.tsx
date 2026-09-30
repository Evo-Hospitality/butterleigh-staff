"use client";

import { PageError } from "@/components/page-error";
import { SubmissionToken } from "@/components/submission-token";
import { SubmitButton } from "@/components/submit-button";
import { askQuestionAction } from "./actions";

// Anyone signed in can ask — the app shell has already made sure of that.
export default function AskSopQuestionPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Ask a question</h1>
      <PageError />

      <form action={askQuestionAction} className="flex max-w-md flex-col gap-4">
        <SubmissionToken />
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
