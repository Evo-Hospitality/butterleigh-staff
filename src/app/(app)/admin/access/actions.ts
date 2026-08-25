"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ACCESS_LEVELS, APP_KEYS, type AccessLevel } from "@/lib/access";

function fail(message: string): never {
  redirect(`/admin/access?error=${encodeURIComponent(message)}`);
}

// The whole row for one person, saved together. Reading the form back as a
// complete set means a cell that was cleared is stored as 'none' rather than
// silently keeping its old value.
export async function saveAppAccessAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) {
    redirect("/admin/access");
  }

  const rows = APP_KEYS.map((app) => {
    const level = String(formData.get(`level_${app}`) ?? "none") as AccessLevel;
    return {
      staff_id: staffId,
      app,
      level: ACCESS_LEVELS.includes(level) ? level : "none",
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("app_access")
    .upsert(rows, { onConflict: "staff_id,app" });
  if (error) {
    fail(error.message);
  }

  revalidatePath("/admin/access");
  redirect("/admin/access?saved=1");
}

// Sets one app to one level for everybody at once — the quick way to open a
// new app up to the whole team, or shut it again.
export async function setAppForEveryoneAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const app = String(formData.get("app") ?? "");
  const level = String(formData.get("level") ?? "") as AccessLevel;

  if (!APP_KEYS.includes(app as (typeof APP_KEYS)[number]) || !ACCESS_LEVELS.includes(level)) {
    fail("That isn't a valid app or level.");
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("id")
    .eq("active", true)
    .returns<{ id: string }[]>();

  const { error } = await supabase.from("app_access").upsert(
    (staff ?? []).map((s) => ({
      staff_id: s.id,
      app,
      level,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "staff_id,app" },
  );
  if (error) {
    fail(error.message);
  }

  revalidatePath("/admin/access");
  redirect("/admin/access?saved=1");
}
