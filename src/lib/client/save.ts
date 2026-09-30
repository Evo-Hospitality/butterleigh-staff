"use client";

// Instant feedback for one-tap changes (tick a task, mark a photo used,
// approve a request): patch the cached screen straight away, run the server
// action, and put the screen back with a message if the server refuses.
// Whatever happens, the providers re-sync the screen from the server once
// the action lands (see useResyncAfterServerActions), so the patch only has
// to be a good guess, not exact.
//
// Plain <form action={serverAction}> forms don't need this — they already
// re-sync after saving. Use it where waiting ~half a second for a tick to
// appear would feel sluggish.

import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/client/toast";

/** Server actions that call redirect() reject with this — not a failure. */
export function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function describe(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (!message || /fetch|network|load failed/i.test(message))
    return "Couldn't reach the server — check the connection and try again.";
  // Production builds hide thrown server errors behind a generic message.
  if (/Server Components render|digest|Minified React error/i.test(message))
    return "Couldn't save that — please try again.";
  return message;
}

export function useSave() {
  const qc = useQueryClient();
  return useCallback(
    async <T,>(fn: () => Promise<T>, opts: { optimistic?: (qc: QueryClient) => void; ok?: string } = {}) => {
      const snapshot = qc.getQueriesData({ queryKey: ["view"] });
      if (opts.optimistic) {
        await qc.cancelQueries({ queryKey: ["view"] });
        opts.optimistic(qc);
      }
      try {
        const data = await fn();
        if (opts.ok) toast(opts.ok);
        return { ok: true as const, data };
      } catch (err) {
        if (isRedirect(err)) return { ok: true as const, data: undefined };
        for (const [k, d] of snapshot) qc.setQueryData(k, d);
        toast(describe(err), "error");
        return { ok: false as const, data: undefined };
      }
    },
    [qc],
  );
}

/**
 * Immutable update of every cached copy of one view (any params), e.g.
 *   patchView<TasksData>(qc, "tasks", "list", (d) => ({ ...d, tasks: ... }))
 */
export function patchView<T>(qc: QueryClient, module: string, name: string, fn: (d: T) => T) {
  qc.setQueriesData<{ data: T } | { redirect: string } | { notFound: true }>(
    { queryKey: ["view", module, name] },
    (body) => (body && "data" in body ? { data: fn(body.data) } : body),
  );
}
