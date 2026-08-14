import Link from "next/link";
import { BookOpenText, CalendarDays, CheckSquare, ClipboardList, PartyPopper, Wrench } from "lucide-react";
import { canAccessMaintenance, isManagerOrAdmin, type Profile } from "@/lib/types";

// Add an entry here for each future mini-app.
const TILES = [
  {
    href: "/holiday",
    label: "Holiday",
    description: "Request holiday, request a day in lieu, check your balance",
    icon: CalendarDays,
    show: (_profile: Profile) => true,
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    description: "Report an issue and track progress until it's fixed",
    icon: Wrench,
    show: canAccessMaintenance,
  },
  {
    href: "/sops",
    label: "SOPs & FAQs",
    description: "Ask a question or search how something's meant to be done",
    icon: BookOpenText,
    show: (_profile: Profile) => true,
  },
  {
    href: "/events",
    label: "Event ideas",
    description: "Suggest an event and see what's been approved",
    icon: PartyPopper,
    show: (_profile: Profile) => true,
  },
  {
    href: "/actions",
    label: "Actions",
    description: "Raise and track things assigned between managers/admins",
    icon: ClipboardList,
    show: isManagerOrAdmin,
  },
  {
    href: "/tasks",
    label: "Tasks",
    description: "Create one-off or recurring tasks for yourself or others",
    icon: CheckSquare,
    show: (_profile: Profile) => true,
  },
];

export function DashboardTiles({ profile }: { profile: Profile }) {
  const tiles = TILES.filter((tile) => tile.show(profile));

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
