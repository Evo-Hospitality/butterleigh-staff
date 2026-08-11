import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/shell/nav";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";
import { getImpersonationState } from "@/lib/impersonation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const impersonation = await getImpersonationState();

  // Forcing the admin through the target's own password-change flow makes
  // no sense for a "submit this one thing on their behalf" session, and the
  // admin shouldn't be setting the target's real password anyway.
  if (profile.must_change_password && !impersonation) {
    redirect("/auth/set-password");
  }

  return (
    <>
      {impersonation && (
        <ImpersonationBanner adminName={impersonation.adminName} targetName={impersonation.targetName} />
      )}
      <Nav profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
