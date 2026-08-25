// Who can open what, in one place. Every gate in the app asks this and
// nothing else — see 0038_app_access.sql for the database half.

export const ACCESS_LEVELS = ["none", "use", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const APPS = [
  {
    key: "overview",
    label: "Overview",
    href: "/checkins",
    use: "Open the weekly meeting board and add agenda items",
    manage: "Same as Use — nothing extra",
  },
  {
    key: "tasks",
    label: "Tasks",
    href: "/tasks",
    use: "See and complete tasks assigned to them",
    manage: "Raise tasks for other people, and see the full history",
  },
  {
    key: "holiday",
    label: "Holiday",
    href: "/holiday",
    use: "Request holiday and days in lieu, see their own balance",
    manage: "Approve and decline requests from the people they manage",
  },
  {
    key: "social_photos",
    label: "Social photos",
    href: "/social-photos",
    use: "Submit photos",
    manage: "Mark photos as used, download and delete them",
  },
  {
    key: "events",
    label: "Event ideas",
    href: "/events",
    use: "Suggest an event and see what's been approved",
    manage: "Approve and decline suggestions",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    use: "Report a fault and follow their own reports",
    manage: "Assign, update and close off any report",
  },
  {
    key: "sops",
    label: "SOPs & FAQs",
    href: "/sops",
    use: "Read them and ask a question",
    manage: "Write and edit SOPs, answer questions",
  },
  {
    key: "actions",
    label: "Actions",
    href: "/actions",
    use: "Raise actions and work on their own",
    manage: "Same as Use — Actions stay private to their raiser and owner",
  },
  {
    key: "stocktake",
    label: "Stocktake",
    href: "/stocktake",
    use: "Count wet or dry stock and submit it",
    manage: "Delete counts and manage locations",
  },
] as const;

export type AppKey = (typeof APPS)[number]["key"];

export const APP_KEYS = APPS.map((a) => a.key);

export function appLabel(key: string): string {
  return APPS.find((a) => a.key === key)?.label ?? key;
}

// Admins are deliberately not represented in the grid: they always have
// everything, so an editing mistake can never lock the business out of its
// own payroll and staff records.
export function levelFor(
  grants: Map<string, AccessLevel>,
  app: AppKey,
  isAdmin: boolean,
): AccessLevel {
  if (isAdmin) return "manage";
  return grants.get(app) ?? "none";
}

export function meets(level: AccessLevel, required: Exclude<AccessLevel, "none">): boolean {
  if (level === "manage") return true;
  return level === "use" && required === "use";
}
