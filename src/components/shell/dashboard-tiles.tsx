import Link from "next/link";
import { CalendarDays, Wrench } from "lucide-react";
import { canAccessMaintenance, type Profile } from "@/lib/types";

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
