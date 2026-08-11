import Link from "next/link";
import { canAccessMaintenance as canAccessMaintenanceCheck, type Profile } from "@/lib/types";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "./logo";

export function Nav({ profile }: { profile: Profile }) {
  const canApprove = profile.is_manager || profile.role === "admin";
  const canAccessMaintenance = canAccessMaintenanceCheck(profile);

  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:py-6">
        <Link href="/" className="flex items-center gap-2 font-serif text-lg font-bold sm:gap-3 sm:text-2xl">
          <Logo className="h-9 w-9 sm:h-14 sm:w-14" />
          Butterleigh Inn
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm sm:gap-6 sm:text-[1.75rem]">
          <Link href="/holiday" className="hover:text-accent">
            Holiday
          </Link>
          <Link href="/sops" className="hover:text-accent">
            SOPs
          </Link>
          {canAccessMaintenance && (
            <Link href="/maintenance" className="hover:text-accent">
              Maintenance
            </Link>
          )}
          {canApprove && (
            <Link href="/holiday/approvals" className="hover:text-accent">
              Approvals
            </Link>
          )}
          {profile.role === "admin" && (
            <Link href="/admin/staff" className="hover:text-accent">
              Admin
            </Link>
          )}
          <span className="text-primary-foreground/70">{profile.full_name}</span>
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
