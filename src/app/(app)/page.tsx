import { requireUser } from "@/lib/auth";
import { DashboardTiles } from "@/components/shell/dashboard-tiles";

export default async function DashboardPage() {
  const { profile, access } = await requireUser();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-primary">
        Welcome, {profile.full_name.split(" ")[0]}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose an app to get started.</p>
      <DashboardTiles canSee={access} />
    </div>
  );
}
