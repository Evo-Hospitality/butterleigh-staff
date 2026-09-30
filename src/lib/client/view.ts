"use client";

// Browser side of src/lib/views: fetch a screen's data from
// /api/view/<module>/<name>, keep it in the saved cache, and act on a
// redirect or not-found the loader asked for.
//
//   import type { views as holidayViews } from "@/lib/views/holiday";
//   const { useView } = viewHooks<typeof holidayViews>("holiday");
//   const q = useView("overview", { year: "2026" });
//   if (!q.data) return <Loading />;

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ViewData, ViewMap, ViewParams } from "@/lib/views/types";

type ViewResponse<T> = { data: T } | { redirect: string } | { notFound: true };

function cleanParams(params: ViewParams | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

async function fetchView<T>(module: string, name: string, params: Record<string, string>): Promise<ViewResponse<T>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/view/${module}/${name}${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("Couldn't reach the server — check the connection and try again.");
  }
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error || "Couldn't load this page.");
  }
  return body as ViewResponse<T>;
}

export function viewKey(module: string, name: string, params?: ViewParams) {
  return ["view", module, name, cleanParams(params)] as const;
}

export function viewHooks<V extends ViewMap>(module: string) {
  function useView<K extends keyof V & string>(name: K, params?: ViewParams, opts?: { enabled?: boolean }) {
    type T = ViewData<V, K>;
    const router = useRouter();
    const clean = cleanParams(params);
    const q = useQuery({
      queryKey: viewKey(module, name, clean),
      queryFn: () => fetchView<T>(module, name, clean),
      enabled: opts?.enabled ?? true,
    });
    const body = q.data;
    const redirectTo = body && "redirect" in body ? body.redirect : null;
    useEffect(() => {
      if (redirectTo) router.replace(redirectTo);
    }, [redirectTo, router]);
    return {
      /** The loader's result; undefined until loaded (or when redirecting / not found). */
      data: body && "data" in body ? body.data : undefined,
      notFound: !!body && "notFound" in body,
      redirecting: !!redirectTo,
      error: q.error,
      isFetching: q.isFetching,
      refetch: q.refetch,
    };
  }
  return { useView };
}
