import { vi } from "vitest";

// Mock server-only (it throws when imported outside server context)
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Clerk
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-123" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Test User",
    firstName: "Test",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    imageUrl: "https://example.com/avatar.jpg",
  }),
}));

// Mock ensureProfile (called by getAuthUser)
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));

/**
 * Creates a mock Supabase client with chainable query builder.
 * Each method returns the builder so .from().select().eq().single() works.
 */
export function createMockSupabaseClient() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "not",
    "single",
    "order",
    "limit",
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis();
  }

  builder.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  const client = {
    from: vi.fn().mockReturnValue(builder),
    rpc: builder.rpc,
  };

  return { client, builder };
}
