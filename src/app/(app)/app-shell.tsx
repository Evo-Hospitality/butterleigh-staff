"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/client/me";
import { Nav } from "@/components/shell/nav";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";
import Loading from "./loading";

const OWNER_KEY = "butterleigh-staff-cache-owner";

// The signed-in frame around every page, drawn in the browser from the cached
// profile (useMe) so it appears instantly instead of waiting on the server.
// Does what the old server layout did: the forced password change and the
// new-starter onboarding gate (both skipped while an admin is "logged in as"
// someone). Pages aren't drawn until those pass, so nothing flashes past them.
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();

  const impersonating = !!me?.impersonation;
  const mustChangePassword = !!me && me.profile.must_change_password && !impersonating;
  const mustOnboard =
    !!me &&
    !impersonating &&
    me.profile.onboarding_status !== "not_required" &&
    me.profile.onboarding_status !== "approved";

  useEffect(() => {
    if (mustChangePassword) router.replace("/auth/set-password");
    else if (mustOnboard) router.replace("/onboarding");
  }, [mustChangePassword, mustOnboard, router]);

  // The saved cache belongs to whoever filled it. If a different person is
  // now signed in on this browser (or an admin started/stopped "log in as"),
  // drop the previous person's screens before anything else is drawn.
  const userId = me?.user.id;
  useEffect(() => {
    if (!userId) return;
    let owner: string | null = null;
    try {
      owner = localStorage.getItem(OWNER_KEY);
    } catch {}
    if (owner && owner !== userId) {
      qc.removeQueries({ predicate: (q) => !(q.queryKey[0] === "view" && q.queryKey[1] === "me") });
    }
    try {
      localStorage.setItem(OWNER_KEY, userId);
    } catch {}
  }, [userId, qc]);

  const ready = !!me && !mustChangePassword && !mustOnboard;

  return (
    <>
      {me?.impersonation && (
        <ImpersonationBanner adminName={me.impersonation.adminName} targetName={me.impersonation.targetName} />
      )}
      {me ? (
        <Nav profile={me.profile} canSee={me.access} />
      ) : (
        <header className="h-[61px] border-b border-border bg-primary sm:h-[105px]" />
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{ready ? <Suspense fallback={<Loading />}>{children}</Suspense> : <Loading />}</main>
    </>
  );
}
