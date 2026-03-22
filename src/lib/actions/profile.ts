"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Profile {
  clerk_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  return data as Profile | null;
}

export async function ensureProfile(clerkId: string, displayName: string, email?: string, avatarUrl?: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("profiles").upsert(
    {
      clerk_id: clerkId,
      display_name: displayName,
      email: email ?? null,
      avatar_url: avatarUrl ?? null,
    },
    { onConflict: "clerk_id" }
  );

  if (error) throw new Error(`Failed to ensure profile: ${error.message}`);
}
