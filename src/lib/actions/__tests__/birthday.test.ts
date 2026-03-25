import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "./setup";

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
vi.mock("@/lib/actions/profile", () => ({ ensureProfile: vi.fn() }));
vi.mock("@/lib/validate", () => ({ assertUUID: vi.fn() }));

const { client } = createMockSupabaseClient();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));

import { getBirthdayReminders } from "../birthday";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Produces a date string (YYYY-MM-DD) whose month/day is exactly `days` from
 * today so that daysUntilBirthday() returns that value when using birth year 1990.
 */
function birthDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `1990-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mockMembershipOk() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: "viewer" }, error: null }),
        }),
      }),
    }),
  };
}

function mockMembersResult(members: object[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: members, error: null }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBirthdayReminders", () => {
  it("excludes members with no date_of_birth", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembershipOk();
      if (table === "tree_members") {
        return mockMembersResult([
          { id: "m1", first_name: "Alice", last_name: null, date_of_birth: null, avatar_url: null },
        ]);
      }
      return {};
    });

    const result = await getBirthdayReminders(validUuid);
    expect(result).toEqual([]);
  });

  it("excludes deceased members (date_of_death filter applied in query)", async () => {
    // The query uses .is("date_of_death", null) so DB never returns them;
    // here we confirm that an empty array from the DB yields an empty result.
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembershipOk();
      if (table === "tree_members") return mockMembersResult([]);
      return {};
    });

    const result = await getBirthdayReminders(validUuid);
    expect(result).toEqual([]);
  });

  it("returns members with birthday within 7 days", async () => {
    const dob = birthDateDaysFromNow(3);

    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembershipOk();
      if (table === "tree_members") {
        return mockMembersResult([
          { id: "m2", first_name: "Bob", last_name: "Smith", date_of_birth: dob, avatar_url: null },
        ]);
      }
      return {};
    });

    const result = await getBirthdayReminders(validUuid);
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe("m2");
    expect(result[0].name).toBe("Bob Smith");
    expect(result[0].daysUntil).toBe(3);
    expect(result[0].dateOfBirth).toBe(dob);
  });

  it("excludes members with birthday more than 7 days away", async () => {
    const dob = birthDateDaysFromNow(30);

    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembershipOk();
      if (table === "tree_members") {
        return mockMembersResult([
          { id: "m3", first_name: "Carol", last_name: null, date_of_birth: dob, avatar_url: null },
        ]);
      }
      return {};
    });

    const result = await getBirthdayReminders(validUuid);
    expect(result).toEqual([]);
  });

  it("throws when user has no tree access", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(getBirthdayReminders(validUuid)).rejects.toThrow("No access to this tree");
  });
});
