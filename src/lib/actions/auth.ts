"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/actions/profile";

/**
 * Gets the authenticated user ID and ensures their profile exists in Supabase.
 * Call this at the start of any server action that needs the user.
 * Handles the case where the Clerk webhook hasn't synced the profile yet.
 */
export async function getAuthUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Ensure profile exists (upsert is idempotent, fast on conflict)
  const user = await currentUser();
  if (user) {
    await ensureProfile(
      userId,
      user.fullName ?? user.firstName ?? "User",
      user.emailAddresses[0]?.emailAddress,
      user.imageUrl
    );
  }

  return userId;
}
