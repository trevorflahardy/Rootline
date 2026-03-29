import { vi } from "vitest";

export function mockClerkAuth(userId: string = "user-owner") {
  vi.mock("@clerk/nextjs/server", () => ({
    auth: vi.fn().mockResolvedValue({ userId }),
    currentUser: vi.fn().mockResolvedValue({
      fullName: "Test User",
      firstName: "Test",
      emailAddresses: [{ emailAddress: "test@example.com" }],
      imageUrl: null,
    }),
  }));
}
