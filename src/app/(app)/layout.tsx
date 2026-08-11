import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/shell/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  if (profile.must_change_password) {
    redirect("/auth/set-password");
  }

  return (
    <>
      <Nav profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
