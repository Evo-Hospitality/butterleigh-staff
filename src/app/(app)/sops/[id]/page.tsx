import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManagerOrAdmin, type SopBlock, type SopEntry } from "@/lib/types";
import { SopBlockEditor } from "@/components/sop-block-editor";
import { answerAction } from "./actions";

export default async function SopDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, profile } = await requireUser();

  const { data: entry } = await supabase
    .from("sop_entries")
    .select("*")
    .eq("id", id)
    .single<SopEntry>();
  if (!entry) {
    notFound();
  }

  const canManage = isManagerOrAdmin(profile);

  if (entry.status === "unanswered") {
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

    const answerBound = answerAction.bind(null, id);
    return (
      <div>
        <Link href="/sops" className="text-sm text-muted-foreground hover:text-accent">
          &larr; Back to SOPs
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">Answer this question</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Asked by {entry.asked_by_name ?? "someone no longer on the system"}
        </p>
        {error && (
          <p className="mb-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <SopBlockEditor
          action={answerBound}
          titleLabel="Title"
          initialTitle={entry.title}
          submitLabel="Publish answer"
        />
      </div>
    );
  }

  const { data: blocks } = await supabase
    .from("sop_blocks")
    .select("*")
    .eq("entry_id", id)
    .order("sort_order")
    .returns<SopBlock[]>();

  return (
    <div>
      <Link href="/sops" className="text-sm text-muted-foreground hover:text-accent">
        &larr; Back to SOPs
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-primary">{entry.title}</h1>
      {entry.answered_by_name && (
        <p className="mb-6 text-sm text-muted-foreground">Answered by {entry.answered_by_name}</p>
      )}

      <div className="flex max-w-2xl flex-col gap-4">
        {(blocks ?? []).map((b) => (
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
        {(!blocks || blocks.length === 0) && (
          <p className="text-sm text-muted-foreground">No content yet.</p>
        )}
      </div>
    </div>
  );
}
