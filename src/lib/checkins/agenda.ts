import "server-only";

import type { CheckinGroup, CheckinItem } from "@/lib/types";

export type AgendaGroup = {
  id: string;
  name: string;
  open: CheckinItem[];
  carried: CheckinItem[];
  discussed: CheckinItem[];
};

// Splits each group's items three ways. Lives here rather than inline in the
// page because reading the clock is impure, and a Server Component body is
// still a render — the lint rule that flags it is right, even though this
// one only renders on the server.
export function partitionAgenda(
  groups: CheckinGroup[],
  items: CheckinItem[],
  now: number = Date.now(),
): AgendaGroup[] {
  const isParked = (i: CheckinItem) =>
    !!i.deferred_until && new Date(i.deferred_until).getTime() > now;

  return groups.map((g) => {
    const mine = items.filter((i) => i.group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      open: mine.filter((i) => !i.discussed && !isParked(i)),
      carried: mine.filter((i) => !i.discussed && isParked(i)),
      // Most recently discussed first — that's what you'd look back at.
      discussed: mine
        .filter((i) => i.discussed)
        .sort((a, b) => (b.discussed_at ?? "").localeCompare(a.discussed_at ?? "")),
    };
  });
}
