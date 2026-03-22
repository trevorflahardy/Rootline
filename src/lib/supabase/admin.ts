import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client with service role key.
 * Bypasses RLS - use only for admin operations like webhook handlers.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}
