"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase invite/recovery emails redirect here with the session either as
// tokens in the URL hash (never sent to the server) or as a `code` query
// param, depending on the project's auth flow setting — handle both. Where
// to go next is carried in our own `?next=` query param (set explicitly
// when we generate the link) rather than inferred from Supabase's `type`,
// which isn't reliable to branch on across flow types.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const search = new URLSearchParams(window.location.search);
    const next = search.get("next") ?? "/";
    const code = search.get("code");

    async function finish() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return;
      }

      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (!accessToken || !refreshToken) {
        throw new Error("This link is missing or has expired. Ask an admin to send a new invite.");
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    }

    finish()
      .then(() => router.replace(next))
      .catch((err: Error) => setError(err.message));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <p className="text-sm text-muted-foreground">{error ?? "Signing you in…"}</p>
    </div>
  );
}
