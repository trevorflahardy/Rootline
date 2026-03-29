"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { User, UserX, Unlink, Fingerprint, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  selfAssignToNode,
  selfUnassignFromNode,
  unlinkNodeProfile,
  getNodeMembership,
  updateMemberRole,
  type TreePermissions,
  type NodeProfileLink,
  type NodeMembership,
} from "@/lib/actions/permissions";

interface MemberPermissionsSectionProps {
  treeId: string;
  memberId: string;
  memberFirstName: string;
  currentUserId: string;
  permissions: TreePermissions | null;
  linkedProfile: NodeProfileLink | null;
}

export function MemberPermissionsSection({
  treeId,
  memberId,
  memberFirstName,
  currentUserId,
  permissions,
  linkedProfile,
}: MemberPermissionsSectionProps) {
  const router = useRouter();
  const [claimLoading, setClaimLoading] = useState(false);
  const [nodeMembership, setNodeMembership] = useState<NodeMembership | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);

  useEffect(() => {
    if (!permissions?.canEdit) {
      setNodeMembership(null);
      return;
    }
    getNodeMembership(treeId, memberId)
      .then(setNodeMembership)
      .catch(() => setNodeMembership(null));
  }, [treeId, memberId, permissions?.canEdit]);

  const canClaim = permissions && !permissions.linkedNodeId && !linkedProfile;
  const isSelfLinked = linkedProfile?.userId === currentUserId;
  const canOwnerUnlink = permissions?.isOwner && linkedProfile && !isSelfLinked;

  async function handleClaim() {
    setClaimLoading(true);
    try {
      await selfAssignToNode(treeId, memberId);
      toast.success(`You are now linked to ${memberFirstName}!`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to claim");
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleUnclaim() {
    setClaimLoading(true);
    try {
      await selfUnassignFromNode(treeId);
      toast.success("You have been unlinked from this node");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleOwnerUnlink() {
    if (!linkedProfile) return;
    setClaimLoading(true);
    try {
      await unlinkNodeProfile(treeId, linkedProfile.membershipId);
      toast.success(`Unlinked ${linkedProfile.displayName} from this node`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <>
      {/* Profile link */}
      {linkedProfile ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <Fingerprint className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-blue-900 dark:text-blue-100">
                Linked to {linkedProfile.displayName}
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                {isSelfLinked ? "Your account" : "Account linked"}
              </p>
            </div>
            {isSelfLinked && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 border border-blue-200 text-xs text-blue-700 dark:border-blue-700 dark:text-blue-300"
                onClick={handleUnclaim}
                disabled={claimLoading}
              >
                <UserX className="mr-1 h-3 w-3" />
                {claimLoading ? "..." : "Unlink"}
              </Button>
            )}
            {canOwnerUnlink && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7 border border-red-200 text-xs dark:border-red-800"
                onClick={handleOwnerUnlink}
                disabled={claimLoading}
              >
                <Unlink className="mr-1 h-3 w-3" />
                {claimLoading ? "..." : "Remove"}
              </Button>
            )}
          </div>
        </div>
      ) : canClaim ? (
        <button
          onClick={handleClaim}
          disabled={claimLoading}
          className="group w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/20 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 transition-transform group-hover:scale-105 dark:bg-blue-900/50">
              <Fingerprint className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {claimLoading ? "Linking..." : "This is me! Link my account"}
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                Link your account to show your profile picture and let relatives know it&apos;s you
              </p>
            </div>
          </div>
        </button>
      ) : null}

      {/* Permissions Section - visible to editors and owners */}
      {permissions?.canEdit && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
              <Shield className="h-3 w-3" />
              Permissions
            </p>

            {nodeMembership ? (
              <div className="space-y-2 rounded-lg border px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full">
                      {nodeMembership.avatarUrl ? (
                        <Image
                          src={nodeMembership.avatarUrl}
                          alt={nodeMembership.displayName}
                          className="h-6 w-6 rounded-full object-cover"
                          width={24}
                          height={24}
                        />
                      ) : (
                        <User className="text-primary h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{nodeMembership.displayName}</span>
                  </div>
                  {permissions.isOwner ? (
                    <select
                      className="bg-background rounded border px-2 py-1 text-xs"
                      value={nodeMembership.role}
                      disabled={roleUpdating || nodeMembership.role === "owner"}
                      onChange={async (e) => {
                        const newRole = e.target.value as "editor" | "viewer";
                        setRoleUpdating(true);
                        try {
                          await updateMemberRole(treeId, nodeMembership.id, newRole);
                          setNodeMembership((prev) => (prev ? { ...prev, role: newRole } : prev));
                          toast.success(`Role updated to ${newRole}`);
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Failed to update role"
                          );
                        } finally {
                          setRoleUpdating(false);
                        }
                      }}
                    >
                      {nodeMembership.role === "owner" && <option value="owner">Owner</option>}
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <Badge variant="outline" className="text-xs capitalize">
                      {nodeMembership.role}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No user linked to this member</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
