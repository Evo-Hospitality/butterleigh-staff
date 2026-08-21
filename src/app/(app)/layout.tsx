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

  // New starters get no access to any mini-app until their employment
  // details are in and an admin has approved them — payroll can't run
  // without an HMRC checklist, so there's no point letting them wander in.
  // /onboarding deliberately sits outside this layout, or this would loop.
  // Impersonation is exempt for the same reason as the password gate: an
  // admin acting for someone shouldn't be filling in their personal details.
  if (
    !impersonation &&
    profile.onboarding_status !== "not_required" &&
    profile.onboarding_status !== "approved"
  ) {
    redirect("/onboarding");
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
