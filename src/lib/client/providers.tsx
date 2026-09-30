"use client";

// The browser-side data store. Every screen's data lives in the TanStack Query
// cache, which is saved to IndexedDB so the app opens instantly from what was
// there last time, then refreshes quietly in the background.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";
import { Toaster } from "@/components/toaster";
import { VersionWatcher } from "@/components/version-watcher";

const CACHE_KEY = "butterleigh-staff-cache";
const WEEK = 7 * 86_400_000;

/** Wipe the saved browser copy of the data (on sign-in / sign-out). */
export async function clearSavedData() {
  try {
    await del(CACHE_KEY);
  } catch {}
}

/** Forget everything cached in this browser — used when signing out. */
export function useForgetData() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.clear();
    void clearSavedData();
  }, [qc]);
}

const persister = createAsyncStoragePersister({
  storage:
    typeof window === "undefined"
      ? undefined
      : {
          getItem: (k: string) => get<string>(k).then((v) => v ?? null),
          setItem: (k: string, v: string) => set(k, v),
          removeItem: (k: string) => del(k),
        },
  key: CACHE_KEY,
  throttleTime: 1000,
});

// Every save in this app is a server action (a POST carrying a Next-Action
// header). Rather than each form knowing which screens its change affects,
// any completed server action re-syncs whatever is on screen and marks the
// rest stale — so a save can never leave a screen showing old data.
function useResyncAfterServerActions(qc: QueryClient) {
  useEffect(() => {
    const original = window.fetch;
    const patched: typeof fetch = async (input, init) => {
      const response = await original(input, init);
      try {
        if (init?.method === "POST" && new Headers(init.headers).has("next-action")) {
          void qc.invalidateQueries();
        }
      } catch {}
      return response;
    };
    window.fetch = patched;
    return () => {
      if (window.fetch === patched) window.fetch = original;
    };
  }, [qc]);
}

function ResyncAfterServerActions({ qc }: { qc: QueryClient }) {
  useResyncAfterServerActions(qc);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Show cached data immediately; refresh in the background.
            staleTime: 3_000,
            gcTime: WEEK,
            refetchOnWindowFocus: true,
            // Picks up changes other people make (approvals, new tasks).
            refetchInterval: 120_000,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <PersistQueryClientProvider
      client={qc}
      persistOptions={{
        persister,
        maxAge: WEEK,
        buster: "bl-v1",
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
    >
      <ResyncAfterServerActions qc={qc} />
      <VersionWatcher />
      {children}
      <Toaster />
    </PersistQueryClientProvider>
  );
}
