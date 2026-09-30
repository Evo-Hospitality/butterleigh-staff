"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageError } from "@/components/page-error";
import { SopBlockEditor, type InitialBlock } from "@/components/sop-block-editor";
import Loading from "../../loading";
import { useSopsView } from "../data";
import { publishAction, saveDraftAction } from "./actions";

export default function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const edit = useSearchParams().get("edit");
  const view = useSopsView("detail", { id });
  if (view.notFound) {
    return (
      <div>
        <Link href="/sops" className="text-sm text-muted-foreground hover:text-accent">
          &larr; Back to SOPs
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">This SOP couldn&apos;t be found — it may have been deleted.</p>
      </div>
    );
  }
  if (!view.data) return <Loading />;

  const { entry, canManage, blocks } = view.data;
  const isEditing = entry.status !== "answered" || edit === "1";

  if (isEditing) {
    if (!canManage) {
      return (
        <div>
          <Link href="/sops" className="text-sm text-muted-foreground hover:text-accent">
            &larr; Back to SOPs
          </Link>
          <h1 className="mt-2 mb-4 text-2xl font-bold text-primary">{entry.title}</h1>
          <p className="text-sm text-muted-foreground">
            Your question is with the team and hasn&apos;t been answered yet. We&apos;ll email you
            when it has.
          </p>
        </div>
      );
    }

    const initialBlocks: InitialBlock[] = blocks.map((b) => ({
      kind: b.kind,
      body: b.body,
      url: b.url,
      caption: b.caption,
    }));

    const publishBound = publishAction.bind(null, id);
    const draftBound = saveDraftAction.bind(null, id);
    const wasPublished = entry.status === "answered";

    return (
      <div>
        <Link href={wasPublished ? `/sops/${id}` : "/sops"} className="text-sm text-muted-foreground hover:text-accent">
          &larr; {wasPublished ? "Cancel" : "Back to SOPs"}
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">
          {wasPublished ? "Edit this SOP" : "Answer this question"}
        </h1>
        {entry.asked_by_name && (
          <p className="mb-6 text-sm text-muted-foreground">Asked by {entry.asked_by_name}</p>
        )}
        <PageError className="mb-4 max-w-2xl" />
        {/* The editor copies its starting content once. Keyed on that content
            so a background refresh that brings a newer version (someone else
            saved meanwhile) starts it afresh, while an unchanged refresh
            leaves anything being typed alone. */}
        <SopBlockEditor
          key={JSON.stringify([entry.title, initialBlocks])}
          publishAction={publishBound}
          publishLabel={wasPublished ? "Save changes" : "Publish"}
          draftAction={draftBound}
          draftLabel={wasPublished ? "Save as draft (unpublish)" : "Save as draft"}
          titleLabel="Title"
          initialTitle={entry.title}
          initialBlocks={initialBlocks}
        />
      </div>
    );
  }

  return (
    <div>
      <Link href="/sops" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to SOPs
      </Link>
      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-primary">{entry.title}</h1>
        {canManage && (
          <Link href={`/sops/${id}?edit=1`} className="text-sm font-medium text-accent hover:underline">
            Edit
          </Link>
        )}
      </div>
      {entry.answered_by_name && (
        <p className="mb-6 text-sm text-muted-foreground">Answered by {entry.answered_by_name}</p>
      )}

      <div className="flex max-w-2xl flex-col gap-4">
        {blocks.map((b) => (
          <div key={b.id}>
            {b.kind === "text" && <p className="whitespace-pre-wrap text-sm">{b.body}</p>}
            {b.kind === "photo" && (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url ?? undefined} alt="" className="max-w-md rounded-lg border border-border" />
                {b.caption && (
                  <figcaption className="mt-1 text-sm text-muted-foreground">{b.caption}</figcaption>
                )}
              </figure>
            )}
            {b.kind === "link" && (
              <p className="text-sm">
                <a
                  href={b.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  {b.caption || b.url}
                </a>
              </p>
            )}
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">No content yet.</p>
        )}
      </div>
    </div>
  );
}
