import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionManager } from "../permission-manager";
import type { MembershipWithActivity } from "@/lib/actions/permissions";
import type { TreeMember } from "@/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock server-only to allow importing server action modules
vi.mock("server-only", () => ({}));

// Mock server actions
const mockUpdateMemberRole = vi.fn();
const mockRevokeMembership = vi.fn();
const mockBulkUpdateRoles = vi.fn();
const mockBulkRevokeMemberships = vi.fn();

vi.mock("@/lib/actions/permissions", () => ({
  updateMemberRole: (...args: unknown[]) => mockUpdateMemberRole(...args),
  revokeMembership: (...args: unknown[]) => mockRevokeMembership(...args),
  bulkUpdateRoles: (...args: unknown[]) => mockBulkUpdateRoles(...args),
  bulkRevokeMemberships: (...args: unknown[]) => mockBulkRevokeMemberships(...args),
}));

const treeId = "tree-123";
const currentUserId = "user-owner";

const ownerMembership: MembershipWithActivity = {
  id: "m-owner",
  tree_id: treeId,
  user_id: currentUserId,
  role: "owner",
  linked_node_id: null,
  joined_at: "2026-01-01T00:00:00Z",
  profile: { display_name: "Owner User", email: "owner@test.com", avatar_url: null },
  last_active: new Date().toISOString(), // active today
};

const editorMembership: MembershipWithActivity = {
  id: "m-editor",
  tree_id: treeId,
  user_id: "user-editor",
  role: "editor",
  linked_node_id: "node-1",
  joined_at: "2026-01-02T00:00:00Z",
  profile: { display_name: "Editor User", email: "editor@test.com", avatar_url: null },
  last_active: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
};

const viewerMembership: MembershipWithActivity = {
  id: "m-viewer",
  tree_id: treeId,
  user_id: "user-viewer",
  role: "viewer",
  linked_node_id: null,
  joined_at: "2026-01-03T00:00:00Z",
  profile: { display_name: "Viewer User", email: "viewer@test.com", avatar_url: null },
  last_active: null, // never active
};

const memberships = [ownerMembership, editorMembership, viewerMembership];

const members: TreeMember[] = [
  {
    id: "node-1",
    tree_id: treeId,
    first_name: "Jane",
    last_name: "Doe",
    maiden_name: null,
    date_of_birth: null,
    birth_place: null,
    date_of_death: null,
    death_place: null,
    gender: "female",
    bio: null,
    avatar_url: null,
    is_deceased: false,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    position_x: null,
    position_y: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
  },
];

describe("PermissionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMemberRole.mockResolvedValue(undefined);
    mockRevokeMembership.mockResolvedValue(undefined);
    mockBulkUpdateRoles.mockResolvedValue(undefined);
    mockBulkRevokeMemberships.mockResolvedValue(undefined);
  });

  it("renders all memberships in the table", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    expect(screen.getByText("Owner User")).toBeInTheDocument();
    expect(screen.getByText("Editor User")).toBeInTheDocument();
    expect(screen.getByText("Viewer User")).toBeInTheDocument();
  });

  it("shows owner row as non-editable with badge instead of select", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    const ownerRow = screen.getByTestId("membership-row-m-owner");
    // Owner should have a badge, not a select
    const ownerBadge = screen.getByTestId("role-badge-m-owner");
    expect(ownerBadge).toHaveTextContent("owner");
    // Owner row should not have a checkbox
    expect(ownerRow.querySelector("[data-slot='checkbox']")).toBeNull();
  });

  it("shows role select for non-owner memberships when user is owner", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    expect(screen.getByTestId("role-select-m-editor")).toBeInTheDocument();
    expect(screen.getByTestId("role-select-m-viewer")).toBeInTheDocument();
  });

  it("shows revoke button for non-owner members", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    expect(screen.getByTestId("revoke-btn-m-editor")).toBeInTheDocument();
    expect(screen.getByTestId("revoke-btn-m-viewer")).toBeInTheDocument();
  });

  it("shows revoke confirmation dialog when revoke button clicked", async () => {
    const user = userEvent.setup();
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    await user.click(screen.getByTestId("revoke-btn-m-editor"));

    expect(screen.getByText("Revoke Access")).toBeInTheDocument();
    // "Editor User" appears in both the table and the dialog
    expect(screen.getAllByText(/Editor User/).length).toBeGreaterThanOrEqual(2);
  });

  it("displays linked node name for members with linked nodes", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("displays correct activity indicators", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    // Owner: active today -> green
    const ownerActivity = screen.getByTestId("activity-m-owner");
    expect(ownerActivity.className).toContain("bg-green-500");

    // Editor: 3 days ago -> yellow
    const editorActivity = screen.getByTestId("activity-m-editor");
    expect(editorActivity.className).toContain("bg-yellow-500");

    // Viewer: never -> gray
    const viewerActivity = screen.getByTestId("activity-m-viewer");
    expect(viewerActivity.className).toContain("bg-gray-400");
  });

  it("does not show action columns when user is not owner", () => {
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId="user-viewer"
      />
    );

    // Non-owner should see badges instead of selects
    expect(screen.queryByTestId("role-select-m-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revoke-btn-m-editor")).not.toBeInTheDocument();
  });

  it("shows bulk action bar when items are selected", async () => {
    const user = userEvent.setup();
    render(
      <PermissionManager
        treeId={treeId}
        memberships={memberships}
        members={members}
        currentUserId={currentUserId}
      />
    );

    // Select the editor checkbox
    const editorCheckbox = screen.getByLabelText("Select Editor User");
    await user.click(editorCheckbox);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Revoke Access")).toBeInTheDocument();
  });
});
