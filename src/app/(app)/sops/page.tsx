"use client";

import Link from "next/link";
import { SopSearch } from "@/components/sop-search";
import Loading from "../loading";
import { useSopsView } from "./data";

export default function SopsPage() {
  const view = useSopsView("list");
  if (!view.data) return <Loading />;
  const { canManage, searchEntries, unanswered, drafts } = view.data;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">SOPs &amp; FAQs</h1>
        <div className="flex gap-2">
          {canManage && (
            <Link
              href="/sops/new"
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold hover:border-accent"
            >
              New SOP
            </Link>
          )}
          <Link
            href="/sops/ask"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ask a question
          </Link>
        </div>
      </div>

      <SopSearch entries={searchEntries} />

      {canManage && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-primary">Unanswered questions</h2>
          <div className="flex flex-col gap-2">
            {unanswered.map((e) => (
              <Link
                key={e.id}
                href={`/sops/${e.id}`}
                className="rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <span className="font-medium">{e.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · asked by {e.asked_by_name ?? "someone no longer on the system"}
                </span>
              </Link>
            ))}
            {unanswered.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing waiting on an answer.</p>
            )}
          </div>
        </div>
      )}

      {canManage && drafts.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-primary">Drafts</h2>
          <div className="flex flex-col gap-2">
            {drafts.map((e) => (
              <Link
                key={e.id}
                href={`/sops/${e.id}`}
                className="rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <span className="font-medium">{e.title}</span>
                <span className="text-muted-foreground"> · not published</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
