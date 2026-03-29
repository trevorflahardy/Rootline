import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-123" }),
  currentUser: vi.fn().mockResolvedValue({
    fullName: "Test User",
    firstName: "Test",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    imageUrl: null,
  }),
}));

// Do NOT mock @/lib/actions/profile since we are testing it

function makeMockClient() {
  const client = {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return client;
}

const mockClient = makeMockClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

import { ensureProfile, getProfile, updateProfilePreferences } from "../profile";

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a profile with all fields", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockClient.from.mockImplementation(() => ({
      upsert: mockUpsert,
    }));

    await ensureProfile(
      "clerk-1",
      "John Doe",
      "john@example.com",
      "https://example.com/avatar.jpg"
    );

    expect(mockClient.from).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        clerk_id: "clerk-1",
        display_name: "John Doe",
        email: "john@example.com",
        avatar_url: "https://example.com/avatar.jpg",
      },
      { onConflict: "clerk_id" }
    );
  });

  it("sets email and avatar to null when not provided", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockClient.from.mockImplementation(() => ({
      upsert: mockUpsert,
    }));

    await ensureProfile("clerk-2", "Jane");

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        clerk_id: "clerk-2",
        display_name: "Jane",
        email: null,
        avatar_url: null,
      },
      { onConflict: "clerk_id" }
    );
  });

  it("throws when upsert fails", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: "DB error" } });

    mockClient.from.mockImplementation(() => ({
      upsert: mockUpsert,
    }));

    await expect(ensureProfile("clerk-3", "Bob")).rejects.toThrow("Failed to ensure profile");
  });
});

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile data for authenticated user", async () => {
    const mockProfile = {
      clerk_id: "user-123",
      display_name: "Test User",
      avatar_url: null,
      email: "test@example.com",
      descendant_highlight_depth: 3,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    }));

    const result = await getProfile();

    expect(result).toEqual(mockProfile);
    expect(mockClient.from).toHaveBeenCalledWith("profiles");
  });

  it("returns null when user is not authenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });

    const result = await getProfile();

    expect(result).toBeNull();
  });
});

describe("updateProfilePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates descendant_highlight_depth", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockClient.from.mockImplementation(() => ({
      update: mockUpdate,
    }));

    const result = await updateProfilePreferences({
      descendant_highlight_depth: 5,
    });

    expect(result).toEqual({ descendant_highlight_depth: 5 });
    expect(mockClient.from).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ descendant_highlight_depth: 5 });
  });

  it("throws on invalid input (negative depth)", async () => {
    await expect(updateProfilePreferences({ descendant_highlight_depth: -1 })).rejects.toThrow();
  });

  it("throws on invalid input (depth > 10)", async () => {
    await expect(updateProfilePreferences({ descendant_highlight_depth: 11 })).rejects.toThrow();
  });

  it("throws when user is not authenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });

    await expect(updateProfilePreferences({ descendant_highlight_depth: 3 })).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("throws when update fails", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: { message: "DB constraint error" },
      }),
    });

    mockClient.from.mockImplementation(() => ({
      update: mockUpdate,
    }));

    await expect(updateProfilePreferences({ descendant_highlight_depth: 3 })).rejects.toThrow(
      "Failed to update profile preferences"
    );
  });
});
