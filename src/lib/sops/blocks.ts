import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SopBlockKind } from "@/lib/types";

// What the block editor serializes into the hidden "blocks_json" field —
// photos are already uploaded to storage by the time this arrives (see
// components/sop-block-editor.tsx), so this is just plain text/URLs, kept
// deliberately small regardless of how many photos are in the answer.
type RawBlock = {
  kind: SopBlockKind;
  body?: string;
  url?: string;
  caption?: string;
};

function parseRawBlocks(blocksJson: string): RawBlock[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blocksJson);
  } catch {
    throw new Error("Malformed answer content.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Malformed answer content.");
  }

  return parsed.map((raw): RawBlock => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Malformed answer content.");
    }
    const { kind, body, url, caption } = raw as Record<string, unknown>;
    if (kind !== "text" && kind !== "photo" && kind !== "link") {
      throw new Error("Malformed answer content.");
    }
    if (kind === "text" && (typeof body !== "string" || !body.trim())) {
      throw new Error("A text block is empty.");
    }
    if ((kind === "photo" || kind === "link") && (typeof url !== "string" || !url.trim())) {
      throw new Error(kind === "photo" ? "A photo is missing." : "A link is missing its URL.");
    }
    return {
      kind,
      body: typeof body === "string" ? body.trim() : undefined,
      url: typeof url === "string" ? url.trim() : undefined,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
    };
  });
}

export async function insertBlocks(supabase: SupabaseClient, entryId: string, blocksJson: string) {
  const blocks = parseRawBlocks(blocksJson);
  if (blocks.length === 0) {
    throw new Error("Add at least one block before publishing.");
  }

  const rows = blocks.map((b, i) => ({
    entry_id: entryId,
    kind: b.kind,
    sort_order: i,
    body: b.kind === "text" ? b.body : null,
    url: b.kind === "text" ? null : b.url,
    caption: b.kind === "text" ? null : (b.caption ?? null),
  }));

  const { error } = await supabase.from("sop_blocks").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}
