import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role that sets the requesting user ID
 * for RLS policies. Use this in server actions after getting the userId from Clerk.
 */
export function createServerClient(userId?: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );

  if (userId) {
    return { client, userId };
  }

  return { client, userId: undefined };
}

/**
 * Executes a callback with the requesting_user_id set for RLS policies.
 * Wraps the query in a transaction that sets the session variable.
 */
export async function withUserContext<T>(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (client: SupabaseClient<any, any, any>) => Promise<T>
): Promise<T> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );

  // Set the requesting user ID for RLS policies
  await client.rpc("set_request_user_id", { user_id: userId });

  return callback(client);
}
