"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Screens are drawn in the browser now, so a tab left open keeps running the
// code it loaded until something reloads it — after an update, people would
// carry on seeing the old version. This checks which version is live (on
// returning to the tab, and every few minutes) and, once a newer one is out,
// reloads at a moment that can't lose anything: the next move to another
// page, or coming back to the tab while nothing is being typed.

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY = 5 * 60_000;

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export function VersionWatcher() {
  const pathname = usePathname();
  const outdated = useRef(false);
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (BUILD_ID === "dev") return;

    async function check() {
      if (outdated.current) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== "dev" && version !== BUILD_ID) outdated.current = true;
      } catch {
        // Offline or mid-deploy — try again next time.
      }
    }

    async function onVisible() {
      if (document.visibilityState !== "visible") return;
      await check();
      if (outdated.current && !isTyping()) window.location.reload();
    }

    void check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Moving to another page: if a newer version is live, load that page
  // fresh instead — nothing is on screen yet to lose.
  useEffect(() => {
    if (pathname === firstPath.current) return;
    firstPath.current = pathname;
    if (outdated.current) window.location.reload();
  }, [pathname]);

  return null;
}
