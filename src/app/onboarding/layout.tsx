import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/shell/logo";

// Deliberately not inside the (app) group: that layout redirects anyone
// mid-onboarding to here, so nesting would loop. Sign out is the only way
// out, and it must always be reachable.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  // Password first, details second — the same order the new starter is told
  // to expect.
  if (profile.must_change_password) {
    redirect("/auth/set-password");
  }

  return (
    <>
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="flex items-center gap-3 font-serif text-lg font-bold sm:text-2xl">
            <Logo className="h-10 w-10" />
            Butterleigh Inn
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-primary-foreground/70">{profile.full_name}</span>
            <form action={signOut}>
              <button type="submit" className="hover:text-accent">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
