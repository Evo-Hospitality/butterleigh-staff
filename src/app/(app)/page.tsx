"use client";

import { useMe } from "@/lib/client/me";
import { DashboardTiles } from "@/components/shell/dashboard-tiles";

export default function DashboardPage() {
  // The shell only draws pages once the profile is loaded.
  const me = useMe()!;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-primary">
        Welcome, {me.profile.full_name.split(" ")[0]}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose an app to get started.</p>
      <DashboardTiles canSee={me.access} />
    </div>
  );
}
