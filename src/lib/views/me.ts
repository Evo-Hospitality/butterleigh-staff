import "server-only";

import { requireUser } from "@/lib/auth";
import { getImpersonationState } from "@/lib/impersonation";
import type { AccessLevel } from "@/lib/access";
import type { ViewMap } from "./types";

// Who is signed in, what they can open, and whether an admin is viewing as
// them — everything the frame around every page (nav, banner, gates) needs.
export const views = {
  me: async () => {
    const [{ user, profile, grants }, impersonation] = await Promise.all([
      requireUser(),
      getImpersonationState(),
    ]);
    return {
      user,
      profile,
      grants: Object.fromEntries(grants) as Record<string, AccessLevel>,
      impersonation,
    };
  },
} satisfies ViewMap;
