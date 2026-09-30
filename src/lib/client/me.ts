"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { views as meViews } from "@/lib/views/me";
import { levelFor, meets, type AccessLevel, type AppKey } from "@/lib/access";
import { viewHooks } from "@/lib/client/view";

const { useView } = viewHooks<typeof meViews>("me");

/**
 * Browser twin of requireUser(): who is signed in, their profile, what they
 * can open (`access`, same rules as the server) and any "log in as" session.
 * Undefined until the first load — straight from the saved cache after that.
 */
export function useMe() {
  const q = useView("me");
  const data = q.data;
  return useMemo(() => {
    if (!data) return undefined;
    const grants = new Map<string, AccessLevel>(Object.entries(data.grants));
    const isAdmin = data.profile.role === "admin";
    const access = (app: AppKey, required: "use" | "manage" = "use") =>
      meets(levelFor(grants, app, isAdmin), required);
    return { ...data, isAdmin, access };
  }, [data]);
}

export type Me = NonNullable<ReturnType<typeof useMe>>;

/**
 * Browser twin of requireAppAccess()/requireAdmin() for screens whose data
 * loader doesn't already gate them (e.g. a "new" form with nothing to load).
 * Returns the signed-in person once allowed; otherwise sends them to
 * `fallback`. Null while loading or redirecting.
 */
export function useRequire(allowed: (me: Me) => boolean, fallback = "/"): Me | null {
  const me = useMe();
  const router = useRouter();
  const ok = !!me && allowed(me);
  useEffect(() => {
    if (me && !ok) router.replace(fallback);
  }, [me, ok, router, fallback]);
  return ok ? me : null;
}
