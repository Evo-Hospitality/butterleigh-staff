import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses the service_role key, which bypasses RLS entirely. Only ever import
// this from Server Actions/Route Handlers that have already verified the
// caller is an admin — never expose it to the client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
