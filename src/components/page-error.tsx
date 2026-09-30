"use client";

import { useSearchParams } from "next/navigation";

// The red "?error=" message server actions leave behind via their fail()
// redirect — the browser-drawn twin of reading searchParams.error on the
// server.
export function PageError({ className = "mb-4 max-w-md" }: { className?: string }) {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return <p className={`${className} rounded-md bg-red-50 px-3 py-2 text-sm text-red-700`}>{error}</p>;
}
