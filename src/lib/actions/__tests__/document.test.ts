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
vi.mock("@/lib/actions/profile", () => ({
  ensureProfile: vi.fn(),
}));

const validTreeId = "550e8400-e29b-41d4-a716-446655440000";
const validMemberId = "660e8400-e29b-41d4-a716-446655440001";
const validDocId = "770e8400-e29b-41d4-a716-446655440002";

function makeMockStorage() {
  return {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null }),
    }),
  };
}

const mockStorage = makeMockStorage();

const mockClient = {
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  storage: mockStorage,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

vi.mock("@/lib/actions/permissions", () => ({
  canEditMember: vi.fn().mockResolvedValue(true),
}));

import {
  uploadDocument,
  getDocumentsByMember,
  getDocumentsByTree,
  deleteDocument,
  updateDocument,
} from "../document";

function makeFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("treeId", validTreeId);
  fd.append("memberId", validMemberId);
  fd.append(
    "file",
    new File(["content"], "test.pdf", { type: "application/pdf" })
  );
  fd.append("document_type", "birth_certificate");
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

function mockMembership(role: string, linkedNodeId: string | null = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role, linked_node_id: linkedNodeId },
            error: null,
          }),
        }),
      }),
    }),
  };
}

function mockDocumentsSelect(docs: Record<string, unknown>[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: docs, error: null }),
          single: vi.fn().mockResolvedValue({
            data: docs[0] ?? null,
            error: docs.length ? null : { message: "not found" },
          }),
        }),
      }),
    }),
  };
}

describe("uploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null }),
    });
  });

  it("owner can upload anywhere", async () => {
    const mockDoc = {
      id: validDocId,
      tree_id: validTreeId,
      member_id: validMemberId,
      uploaded_by: "user-123",
      storage_path: "path/to/file",
      file_name: "test.pdf",
      file_size: 7,
      mime_type: "application/pdf",
      document_type: "birth_certificate",
      description: null,
      is_private: false,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("owner");
      if (table === "documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await uploadDocument(makeFormData());
    expect(result.file_name).toBe("test.pdf");
    expect(result.document_type).toBe("birth_certificate");
  });

  it("viewer cannot upload (rejected)", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("viewer");
      return {};
    });

    await expect(uploadDocument(makeFormData())).rejects.toThrow(
      "Viewers cannot upload documents"
    );
  });

  it("scoped editor within branch succeeds", async () => {
    const { canEditMember } = await import("@/lib/actions/permissions");
    (canEditMember as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const mockDoc = {
      id: validDocId,
      tree_id: validTreeId,
      member_id: validMemberId,
      uploaded_by: "user-123",
      storage_path: "path/to/file",
      file_name: "test.pdf",
      file_size: 7,
      mime_type: "application/pdf",
      document_type: "birth_certificate",
      description: null,
      is_private: false,
      created_at: "2026-01-01T00:00:00Z",
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships")
        return mockMembership("editor", "root-node");
      if (table === "documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await uploadDocument(makeFormData());
    expect(result.file_name).toBe("test.pdf");
  });

  it("scoped editor outside branch fails", async () => {
    const { canEditMember } = await import("@/lib/actions/permissions");
    (canEditMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships")
        return mockMembership("editor", "root-node");
      return {};
    });

    await expect(uploadDocument(makeFormData())).rejects.toThrow(
      "You can only upload documents to members in your branch"
    );
  });
});

describe("getDocumentsByMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns documents, filters private for non-owner/non-uploader", async () => {
    const docs = [
      {
        id: "doc-1",
        uploaded_by: "user-123",
        is_private: false,
        file_name: "public.pdf",
      },
      {
        id: "doc-2",
        uploaded_by: "other-user",
        is_private: true,
        file_name: "private.pdf",
      },
      {
        id: "doc-3",
        uploaded_by: "user-123",
        is_private: true,
        file_name: "own-private.pdf",
      },
    ];

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("editor");
      if (table === "documents") return mockDocumentsSelect(docs);
      return {};
    });

    const result = await getDocumentsByMember(validTreeId, validMemberId);
    // Should filter out doc-2 (private, not uploader, not owner)
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toContain("doc-1");
    expect(result.map((d) => d.id)).toContain("doc-3");
    expect(result.map((d) => d.id)).not.toContain("doc-2");
  });
});

describe("getDocumentsByTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owner can view all documents", async () => {
    const docs = [
      { id: "doc-1", file_name: "file1.pdf" },
      { id: "doc-2", file_name: "file2.pdf" },
    ];

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("owner");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: docs, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await getDocumentsByTree(validTreeId);
    expect(result).toHaveLength(2);
  });

  it("non-owner is rejected", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("editor");
      return {};
    });

    await expect(getDocumentsByTree(validTreeId)).rejects.toThrow(
      "Only the tree owner can view all documents"
    );
  });
});

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null }),
    });
  });

  it("uploader can delete own document", async () => {
    const doc = {
      id: validDocId,
      uploaded_by: "user-123",
      storage_path: "path/to/file",
      tree_id: validTreeId,
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("editor");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: doc, error: null }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    await expect(deleteDocument(validDocId, validTreeId)).resolves.toBeUndefined();
  });

  it("owner can delete any document", async () => {
    const doc = {
      id: validDocId,
      uploaded_by: "other-user",
      storage_path: "path/to/file",
      tree_id: validTreeId,
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("owner");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: doc, error: null }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    await expect(deleteDocument(validDocId, validTreeId)).resolves.toBeUndefined();
  });

  it("other users cannot delete", async () => {
    const doc = {
      id: validDocId,
      uploaded_by: "other-user",
      storage_path: "path/to/file",
      tree_id: validTreeId,
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("editor");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: doc, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(deleteDocument(validDocId, validTreeId)).rejects.toThrow(
      "You don't have permission to delete this document"
    );
  });
});

describe("updateDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploader can update metadata", async () => {
    const doc = { uploaded_by: "user-123" };
    const updatedDoc = {
      id: validDocId,
      uploaded_by: "user-123",
      description: "Updated",
      document_type: "legal",
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("editor");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: doc, error: null }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: updatedDoc, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await updateDocument(validDocId, validTreeId, {
      description: "Updated",
      document_type: "legal",
    });
    expect(result.description).toBe("Updated");
  });

  it("owner can update any document", async () => {
    const doc = { uploaded_by: "other-user" };
    const updatedDoc = {
      id: validDocId,
      uploaded_by: "other-user",
      is_private: true,
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === "tree_memberships") return mockMembership("owner");
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: doc, error: null }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: updatedDoc, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await updateDocument(validDocId, validTreeId, {
      is_private: true,
    });
    expect(result.is_private).toBe(true);
  });
});
