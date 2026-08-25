import Link from "next/link";
import type { Profile } from "@/lib/types";
import type { AppKey } from "@/lib/access";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "./logo";

// Order matters: Overview first for anyone who has it, since it's the way
// in to everything else. Which links appear comes from the same per-app
// access as the tiles and the pages themselves (0038) — no role guessing.
const LINKS: { href: string; label: string; app: AppKey; level?: "use" | "manage" }[] = [
  { href: "/checkins", label: "Overview", app: "overview" },
  { href: "/tasks", label: "Tasks", app: "tasks" },
  { href: "/holiday", label: "Holiday", app: "holiday" },
  { href: "/social-photos", label: "Photos", app: "social_photos" },
  { href: "/events", label: "Events", app: "events" },
  { href: "/maintenance", label: "Maintenance", app: "maintenance" },
  { href: "/sops", label: "SOPs", app: "sops" },
  { href: "/actions", label: "Actions", app: "actions" },
  { href: "/stocktake", label: "Stocktake", app: "stocktake" },
  // Approving is the Manage half of Holiday, so it appears only for the
  // people who actually do it.
  { href: "/holiday/approvals", label: "Approvals", app: "holiday", level: "manage" },
];

export function Nav({
  profile,
  canSee,
}: {
  profile: Profile;
  canSee: (app: AppKey, level?: "use" | "manage") => boolean;
}) {
  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:py-6">
        <Link href="/" className="flex items-center gap-2 font-serif text-lg font-bold sm:gap-3 sm:text-2xl">
          <Logo className="h-9 w-9 sm:h-14 sm:w-14" />
          Butterleigh Inn
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm sm:gap-6 sm:text-[1.75rem]">
          {LINKS.filter((link) => canSee(link.app, link.level)).map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-accent">
              {link.label}
            </Link>
          ))}
          {profile.role === "admin" && (
            <Link href="/admin/staff" className="hover:text-accent">
              Admin
            </Link>
          )}
          {/* Their own name is the way in to their payroll record — no room
              in the bar for another top-level link. */}
          <Link href="/my-details" className="text-primary-foreground/70 hover:text-accent">
            {profile.full_name}
          </Link>
          <form action={signOut}>
            <button type="submit" className="hover:text-accent">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
