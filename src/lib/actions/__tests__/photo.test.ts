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
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITS: new Proxy({}, { get: () => [100, 60_000] }),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
// memberId reserved for future use in photo tests

const { client, builder } = createMockSupabaseClient();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// Mock storage
const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockRemove = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: "https://storage.example.com/photo.jpg" },
});

(client as Record<string, unknown>).storage = {
  from: vi.fn().mockReturnValue({
    upload: mockUpload,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
  }),
};

import { uploadPhoto, deletePhoto, getPhotosByTreeId } from "../photo";

function makeFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function makeFormData(file: File): FormData {
  const fd = new FormData();
  fd.set("file", file);
  return fd;
}

describe("uploadPhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(builder)) {
      if (typeof builder[key]?.mockReturnThis === "function") {
        builder[key].mockReturnThis();
      }
    }
  });

  it("uploads a valid photo successfully", async () => {
    const mockMedia = {
      id: "media-1",
      tree_id: validUuid,
      uploaded_by: "user-123",
      storage_path: "some/path.jpg",
      file_name: "test.jpg",
      file_size: 1024,
      mime_type: "image/jpeg",
      member_id: null,
      is_profile_photo: false,
      caption: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "media") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMedia,
                error: null,
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const file = makeFile("test.jpg", 1024, "image/jpeg");
    const fd = makeFormData(file);

    const result = await uploadPhoto(fd, validUuid);

    expect(result.id).toBe("media-1");
    expect(result.file_name).toBe("test.jpg");
  });

  it("rejects files over 5MB", async () => {
    // Set up membership mock first (getAuthUser + membership check happen before file check)
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const bigFile = makeFile("huge.jpg", 6 * 1024 * 1024, "image/jpeg");
    const fd = makeFormData(bigFile);

    await expect(uploadPhoto(fd, validUuid)).rejects.toThrow("File too large");
  });

  it("rejects non-image MIME types", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const pdfFile = makeFile("doc.pdf", 1024, "application/pdf");
    const fd = makeFormData(pdfFile);

    await expect(uploadPhoto(fd, validUuid)).rejects.toThrow("Invalid file type");
  });

  it("rejects when no file is provided", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "editor" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const fd = new FormData();

    await expect(uploadPhoto(fd, validUuid)).rejects.toThrow("No file provided");
  });

  it("rejects when user is a viewer", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "viewer" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const file = makeFile("test.jpg", 1024, "image/jpeg");
    const fd = makeFormData(file);

    await expect(uploadPhoto(fd, validUuid)).rejects.toThrow(
      "You don't have permission to upload photos"
    );
  });

  it("rejects when user has no membership", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    const file = makeFile("test.jpg", 1024, "image/jpeg");
    const fd = makeFormData(file);

    await expect(uploadPhoto(fd, validUuid)).rejects.toThrow(
      "You don't have permission to upload photos"
    );
  });
});

describe("deletePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when user is a viewer", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "viewer" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    await expect(deletePhoto(validUuid, validUuid)).rejects.toThrow(
      "You don't have permission to delete photos"
    );
  });
});

describe("getPhotosByTreeId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when user has no membership", async () => {
    client.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return builder;
    });

    await expect(getPhotosByTreeId(validUuid)).rejects.toThrow("No access to this tree");
  });
});
