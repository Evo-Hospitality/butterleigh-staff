import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isManagerOrAdmin, type SopBlock, type SopEntry } from "@/lib/types";
import { SopSearch, type SopSearchEntry } from "@/components/sop-search";

function snippetFor(blocks: SopBlock[]): string {
  const firstText = blocks.find((b) => b.kind === "text" && b.body);
  if (firstText?.body) return firstText.body.slice(0, 160);
  const firstCaption = blocks.find((b) => b.caption);
  return firstCaption?.caption?.slice(0, 160) ?? "";
}

export default async function SopsPage() {
  const { supabase, profile } = await requireUser();
  const canManage = isManagerOrAdmin(profile);

  const { data: answered } = await supabase
    .from("sop_entries")
    .select("*")
    .eq("status", "answered")
    .order("title")
    .returns<SopEntry[]>();
  const answeredEntries = answered ?? [];

  let unanswered: SopEntry[] = [];
  let drafts: SopEntry[] = [];
  if (canManage) {
    const [{ data: unansweredData }, { data: draftData }] = await Promise.all([
      supabase.from("sop_entries").select("*").eq("status", "unanswered").order("created_at").returns<SopEntry[]>(),
      supabase.from("sop_entries").select("*").eq("status", "draft").order("created_at").returns<SopEntry[]>(),
    ]);
    unanswered = unansweredData ?? [];
    drafts = draftData ?? [];
  }

  let blocksByEntry = new Map<string, SopBlock[]>();
  if (answeredEntries.length > 0) {
    const { data: allBlocks } = await supabase
      .from("sop_blocks")
      .select("*")
      .in("entry_id", answeredEntries.map((e) => e.id))
      .order("sort_order")
      .returns<SopBlock[]>();
    blocksByEntry = new Map();
    for (const b of allBlocks ?? []) {
      const list = blocksByEntry.get(b.entry_id) ?? [];
      list.push(b);
      blocksByEntry.set(b.entry_id, list);
    }
  }

  const searchEntries: SopSearchEntry[] = answeredEntries.map((e) => {
    const blocks = blocksByEntry.get(e.id) ?? [];
    const searchText = [e.title, ...blocks.map((b) => b.body ?? ""), ...blocks.map((b) => b.caption ?? "")]
      .join(" ")
      .toLowerCase();
    return { id: e.id, title: e.title, snippet: snippetFor(blocks), searchText };
  });

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
