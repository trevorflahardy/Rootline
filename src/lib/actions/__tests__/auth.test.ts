import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockCurrentUser = vi.hoisted(() => vi.fn());
const mockEnsureProfile = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}));
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: mockEnsureProfile,
}));

import { getAuthUser } from "../auth";

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId when authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: "user-123" });
    mockCurrentUser.mockResolvedValue({
      fullName: "Test User",
      firstName: "Test",
      emailAddresses: [{ emailAddress: "test@example.com" }],
      imageUrl: "https://example.com/avatar.jpg",
    });

    const result = await getAuthUser();

    expect(result).toBe("user-123");
    expect(mockEnsureProfile).toHaveBeenCalledWith(
      "user-123",
      "Test User",
      "test@example.com",
      "https://example.com/avatar.jpg"
    );
  });

  it("uses firstName when fullName is null", async () => {
    mockAuth.mockResolvedValue({ userId: "user-456" });
    mockCurrentUser.mockResolvedValue({
      fullName: null,
      firstName: "Jane",
      emailAddresses: [{ emailAddress: "jane@example.com" }],
      imageUrl: null,
    });

    const result = await getAuthUser();

    expect(result).toBe("user-456");
    expect(mockEnsureProfile).toHaveBeenCalledWith("user-456", "Jane", "jane@example.com", null);
  });

  it("uses 'User' fallback when both fullName and firstName are null", async () => {
    mockAuth.mockResolvedValue({ userId: "user-789" });
    mockCurrentUser.mockResolvedValue({
      fullName: null,
      firstName: null,
      emailAddresses: [{ emailAddress: "anon@example.com" }],
      imageUrl: null,
    });

    const result = await getAuthUser();

    expect(result).toBe("user-789");
    expect(mockEnsureProfile).toHaveBeenCalledWith("user-789", "User", "anon@example.com", null);
  });

  it("throws when auth() returns null userId", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(getAuthUser()).rejects.toThrow("Unauthorized");
    expect(mockEnsureProfile).not.toHaveBeenCalled();
  });

  it("skips ensureProfile when currentUser returns null", async () => {
    mockAuth.mockResolvedValue({ userId: "user-abc" });
    mockCurrentUser.mockResolvedValue(null);

    const result = await getAuthUser();

    expect(result).toBe("user-abc");
    expect(mockEnsureProfile).not.toHaveBeenCalled();
  });
});
