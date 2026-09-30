import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManagerOrAdmin, type SopBlock, type SopEntry } from "@/lib/types";
import type { ViewMap } from "./types";

function snippetFor(blocks: SopBlock[]): string {
  const firstText = blocks.find((b) => b.kind === "text" && b.body);
  if (firstText?.body) return firstText.body.slice(0, 160);
  const firstCaption = blocks.find((b) => b.caption);
  return firstCaption?.caption?.slice(0, 160) ?? "";
}

type EntrySummary = Pick<SopEntry, "id" | "title" | "asked_by_name">;

export const views = {
  // /sops — the searchable list, plus the questions/drafts queue for managers.
  list: async () => {
    const { supabase, access } = await requireUser();
    const canManage = access("sops", "manage");

    const { data: answered } = await supabase
      .from("sop_entries")
      .select("*")
      .eq("status", "answered")
      .order("title")
      .returns<SopEntry[]>();
    const answeredEntries = answered ?? [];

    // Independent of each other, so fetched side by side.
    const [unansweredRes, draftRes, blocksRes] = await Promise.all([
      canManage
        ? supabase.from("sop_entries").select("*").eq("status", "unanswered").order("created_at").returns<SopEntry[]>()
        : Promise.resolve({ data: [] as SopEntry[] }),
      canManage
        ? supabase.from("sop_entries").select("*").eq("status", "draft").order("created_at").returns<SopEntry[]>()
        : Promise.resolve({ data: [] as SopEntry[] }),
      answeredEntries.length > 0
        ? supabase
            .from("sop_blocks")
            .select("*")
            .in("entry_id", answeredEntries.map((e) => e.id))
            .order("sort_order")
            .returns<SopBlock[]>()
        : Promise.resolve({ data: [] as SopBlock[] }),
    ]);

    const blocksByEntry = new Map<string, SopBlock[]>();
    for (const b of blocksRes.data ?? []) {
      const list = blocksByEntry.get(b.entry_id) ?? [];
      list.push(b);
      blocksByEntry.set(b.entry_id, list);
    }

    const searchEntries = answeredEntries.map((e) => {
      const blocks = blocksByEntry.get(e.id) ?? [];
      const searchText = [e.title, ...blocks.map((b) => b.body ?? ""), ...blocks.map((b) => b.caption ?? "")]
        .join(" ")
        .toLowerCase();
      return { id: e.id, title: e.title, snippet: snippetFor(blocks), searchText };
    });

    const summary = (e: SopEntry): EntrySummary => ({ id: e.id, title: e.title, asked_by_name: e.asked_by_name });

    return {
      canManage,
      searchEntries,
      unanswered: (unansweredRes.data ?? []).map(summary),
      drafts: (draftRes.data ?? []).map(summary),
    };
  },

  // /sops/[id] — one entry and its blocks. Serves both the read view and the
  // editor (?edit=1 is decided in the browser, so flipping into edit mode
  // needs no extra round trip).
  detail: async ({ id }) => {
    const { supabase, profile } = await requireUser();
    if (!id) notFound();

    const [{ data: entry }, { data: blocks }] = await Promise.all([
      supabase.from("sop_entries").select("*").eq("id", id).maybeSingle<SopEntry>(),
      supabase.from("sop_blocks").select("*").eq("entry_id", id).order("sort_order").returns<SopBlock[]>(),
    ]);
    if (!entry) notFound();

    const canManage = isManagerOrAdmin(profile);
    // Staff only ever saw the content of a published answer — an unanswered
    // question or a draft shows them the "with the team" note instead.
    const showBlocks = entry.status === "answered" || canManage;

    return {
      entry: {
        id: entry.id,
        title: entry.title,
        status: entry.status,
        asked_by_name: entry.asked_by_name,
        answered_by_name: entry.answered_by_name,
      },
      canManage,
      blocks: showBlocks
        ? (blocks ?? []).map((b) => ({ id: b.id, kind: b.kind, body: b.body, url: b.url, caption: b.caption }))
        : [],
    };
  },
} satisfies ViewMap;
