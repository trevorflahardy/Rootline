"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shield, UserX } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  updateMemberRole,
  revokeMembership,
  bulkUpdateRoles,
  bulkRevokeMemberships,
  type MembershipWithActivity,
} from "@/lib/actions/permissions";
import type { TreeMember } from "@/types";

interface PermissionManagerProps {
  treeId: string;
  memberships: MembershipWithActivity[];
  members: TreeMember[];
  currentUserId: string;
}

function getActivityIndicator(lastActive: string | null) {
  if (!lastActive) return { color: "bg-gray-400", label: "No activity" };

  const now = new Date();
  const active = new Date(lastActive);
  const diffMs = now.getTime() - active.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return { color: "bg-green-500", label: "Active today" };
  if (diffDays < 7) return { color: "bg-yellow-500", label: "Active this week" };
  return { color: "bg-gray-400", label: "Inactive" };
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";

  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PermissionManager({
  treeId,
  memberships,
  members,
  currentUserId,
}: PermissionManagerProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MembershipWithActivity | null>(null);
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);

  const isOwner = memberships.some(
    (m) => m.user_id === currentUserId && m.role === "owner"
  );

  const selectableMembers = memberships.filter((m) => m.role !== "owner");

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(selectableMembers.map((m) => m.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [selectableMembers]
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleRoleChange = useCallback(
    async (membershipId: string, newRole: "editor" | "viewer") => {
      setLoading(membershipId);
      try {
        await updateMemberRole(treeId, membershipId, newRole);
        toast.success("Role updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update role");
      } finally {
        setLoading(null);
      }
    },
    [treeId, router]
  );

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setLoading(revokeTarget.id);
    try {
      await revokeMembership(treeId, revokeTarget.id);
      toast.success("Membership revoked");
      setRevokeTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(revokeTarget.id);
        return next;
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setLoading(null);
    }
  }, [treeId, revokeTarget, router]);

  const handleBulkRoleChange = useCallback(
    async (newRole: "editor" | "viewer") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setLoading("bulk");
      try {
        await bulkUpdateRoles(treeId, ids, newRole);
        toast.success(`Updated ${ids.length} member(s) to ${newRole}`);
        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update roles");
      } finally {
        setLoading(null);
      }
    },
    [treeId, selectedIds, router]
  );

  const handleBulkRevoke = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setLoading("bulk");
    try {
      await bulkRevokeMemberships(treeId, ids);
      toast.success(`Revoked ${ids.length} membership(s)`);
      setSelectedIds(new Set());
      setBulkRevokeOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setLoading(null);
    }
  }, [treeId, selectedIds, router]);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const allSelectableSelected =
    selectableMembers.length > 0 &&
    selectableMembers.every((m) => selectedIds.has(m.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Members &amp; Permissions</h2>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && isOwner && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Select onValueChange={(v) => handleBulkRoleChange(v as "editor" | "viewer")}>
            <SelectTrigger size="sm" className="w-[130px]" disabled={loading === "bulk"}>
              <SelectValue placeholder="Change role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkRevokeOpen(true)}
            disabled={loading === "bulk"}
          >
            <UserX className="h-3.5 w-3.5 mr-1" />
            Revoke Access
          </Button>
        </div>
      )}

      <div className="glass-card glass-edge-top rounded-lg border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              {isOwner && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelectableSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all members"
                  />
                </TableHead>
              )}
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked Node</TableHead>
              <TableHead>Last Active</TableHead>
              {isOwner && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.map((m) => {
              const isOwnerRow = m.role === "owner";
              const linkedNode = m.linked_node_id
                ? memberMap.get(m.linked_node_id)
                : null;
              const activity = getActivityIndicator(m.last_active);
              const displayName = m.profile?.display_name ?? "Unknown";

              return (
                <TableRow
                  key={m.id}
                  className={isOwnerRow ? "opacity-60" : undefined}
                  data-testid={`membership-row-${m.id}`}
                >
                  {isOwner && (
                    <TableCell>
                      {!isOwnerRow ? (
                        <Checkbox
                          checked={selectedIds.has(m.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(m.id, !!checked)
                          }
                          aria-label={`Select ${displayName}`}
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar size="sm">
                          {m.profile?.avatar_url ? (
                            <AvatarImage
                              src={m.profile.avatar_url}
                              alt={displayName}
                            />
                          ) : null}
                          <AvatarFallback>
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${activity.color}`}
                          title={activity.label}
                          data-testid={`activity-${m.id}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayName}
                        </p>
                        {m.profile?.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {m.profile.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && !isOwnerRow ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          handleRoleChange(m.id, v as "editor" | "viewer")
                        }
                        disabled={loading === m.id}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-[100px]"
                          data-testid={`role-select-${m.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={isOwnerRow ? "default" : "outline"}
                        className="capitalize"
                        data-testid={`role-badge-${m.id}`}
                      >
                        {m.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {linkedNode ? (
                      <span className="text-sm">
                        {linkedNode.first_name} {linkedNode.last_name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {getRelativeTime(m.last_active)}
                    </span>
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {!isOwnerRow && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(m)}
                          disabled={loading === m.id}
                          data-testid={`revoke-btn-${m.id}`}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Single revoke confirmation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke{" "}
              {revokeTarget?.profile?.display_name ?? "this member"}&apos;s
              access to this tree? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk revoke confirmation */}
      <AlertDialog open={bulkRevokeOpen} onOpenChange={setBulkRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for {selectedIds.size}{" "}
              member(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
