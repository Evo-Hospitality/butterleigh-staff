import Link from "next/link";
import {
  BookOpenText,
  Camera,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Package,
  PartyPopper,
  Wrench,
} from "lucide-react";
import type { AppKey } from "@/lib/access";

// Add an entry here for each future mini-app. Order matters — the first
// tile is Overview for anyone who has it, since it's the way in to
// everything else.
//
// Which tiles appear is no longer guessed from role: each one names the app
// it belongs to and is shown only to people granted it (0038).
const TILES = [
  {
    href: "/checkins",
    label: "Overview",
    description: "What's in flight across the apps, and the meeting agenda",
    icon: ClipboardCheck,
    app: "overview" as AppKey,
  },
  {
    href: "/tasks",
    label: "Tasks",
    description: "Physical jobs around the pub — bins, cellar, stocktake",
    icon: CheckSquare,
    app: "tasks" as AppKey,
  },
  {
    href: "/holiday",
    label: "Holiday",
    description: "Request holiday, request a day in lieu, check your balance",
    icon: CalendarDays,
    app: "holiday" as AppKey,
  },
  {
    href: "/social-photos",
    label: "Photos for socials",
    description: "Submit photos for the company's social media accounts",
    icon: Camera,
    app: "social_photos" as AppKey,
  },
  {
    href: "/events",
    label: "Event ideas",
    description: "Suggest an event and see what's been approved",
    icon: PartyPopper,
    app: "events" as AppKey,
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    description: "Report an issue and track progress until it's fixed",
    icon: Wrench,
    app: "maintenance" as AppKey,
  },
  {
    href: "/sops",
    label: "SOPs & FAQs",
    description: "Ask a question or search how something's meant to be done",
    icon: BookOpenText,
    app: "sops" as AppKey,
  },
  {
    href: "/actions",
    label: "Actions",
    description: "Non-physical things to chase, decide or review",
    icon: ClipboardList,
    app: "actions" as AppKey,
  },
  {
    href: "/stocktake",
    label: "Stocktake",
    description: "Count wet or dry stock, valued by location",
    icon: Package,
    app: "stocktake" as AppKey,
  },
];

export function DashboardTiles({ canSee }: { canSee: (app: AppKey) => boolean }) {
  const tiles = TILES.filter((tile) => canSee(tile.app));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {tiles.map(({ href, label, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col gap-2 rounded-lg border border-border bg-background p-5 shadow-sm transition hover:border-accent hover:shadow-md"
        >
          <Icon className="h-6 w-6 text-accent" />
          <span className="font-serif text-lg font-bold text-primary">{label}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </Link>
      ))}
    </div>
  );
}
