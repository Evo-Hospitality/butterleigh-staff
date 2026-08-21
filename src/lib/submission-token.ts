import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Postgres unique-violation. On an insert carrying a submission token it
// means only one thing: this exact form was already submitted (double press,
// browser retry, second tab).
const UNIQUE_VIOLATION = "23505";

export function readSubmissionToken(formData: FormData): string | null {
  const raw = String(formData.get("submission_token") ?? "").trim();
  return raw || null;
}

// Given the error from an insert that carried a token, returns the id of the
// row the *first* submission created — or null if this wasn't a duplicate
// and the caller should handle the error normally.
export async function findDuplicateId(
  supabase: SupabaseClient,
  table: string,
  error: PostgrestError | null,
  token: string | null,
): Promise<string | null> {
  if (!token || error?.code !== UNIQUE_VIOLATION) return null;

  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("submission_token", token)
    .maybeSingle();

  return data?.id ?? null;
}
