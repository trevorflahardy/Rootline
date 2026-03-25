"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2, ArrowLeft, User, Crown, Eye, Edit, Unlink, Link as LinkIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { updateTree, deleteTree, updateMembership, removeMembership } from "@/lib/actions/tree";
import { unlinkNodeProfile } from "@/lib/actions/permissions";
import { updateTreeSchema, type UpdateTreeInput } from "@/lib/validators/tree";
import type { FamilyTree, TreeMember, TreeMembership, TreeRole } from "@/types";

interface MembershipWithProfile extends TreeMembership {
  profile?: { display_name: string; email: string | null; avatar_url: string | null };
}

interface TreeSettingsFormProps {
  tree: FamilyTree;
  memberships: MembershipWithProfile[];
  members: TreeMember[];
  currentUserId: string;
}

const roleIcons: Record<TreeRole, typeof Crown> = {
  owner: Crown,
  editor: Edit,
  viewer: Eye,
};

export function TreeSettingsForm({ tree, memberships, members, currentUserId }: TreeSettingsFormProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPublic, setIsPublic] = useState(tree.is_public);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateTreeInput>({
    resolver: zodResolver(updateTreeSchema),
    defaultValues: {
      name: tree.name,
      description: tree.description ?? "",
    },
  });

  async function onSubmit(data: UpdateTreeInput) {
    try {
      await updateTree(tree.id, { ...data, is_public: isPublic });
      toast.success("Tree settings updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/share/${tree.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTogglePublic(checked: boolean) {
    setIsPublic(checked);
    try {
      await updateTree(tree.id, { is_public: checked });
      toast.success(checked ? "Tree is now public" : "Tree is now private");
    } catch {
      setIsPublic(!checked);
      toast.error("Failed to update visibility");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTree(tree.id);
      toast.success("Tree deleted");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleRoleChange(membershipId: string, role: TreeRole) {
    try {
      await updateMembership(membershipId, tree.id, role);
      toast.success("Role updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  }

  async function handleRemoveMember(membershipId: string) {
    try {
      await removeMembership(membershipId, tree.id);
      toast.success("Member removed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove");
    }
  }

  async function handleUnlinkNode(membershipId: string) {
    try {
      await unlinkNodeProfile(tree.id, membershipId);
      toast.success("Profile unlinked from node");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink");
    }
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push(`/tree/${tree.id}`)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to tree
      </Button>

      {/* General settings */}
      <Card className="glass-card glass-edge-top border-white/10">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your tree&apos;s name and description.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty} size="sm">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card className="glass-card glass-edge-top border-white/10">
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Control who can view your family tree.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Public tree</p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? "Anyone with the link can view this tree"
                  : "Only invited members can view this tree"}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={handleTogglePublic} />
          </div>
          {isPublic && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted/50 px-2 py-1.5 rounded font-mono truncate">
                {typeof window !== "undefined" ? `${window.location.origin}/share/${tree.id}` : `/share/${tree.id}`}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-shrink-0">
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="glass-card glass-edge-top border-white/10">
        <CardHeader>
          <CardTitle>Members ({memberships.length})</CardTitle>
          <CardDescription>People who have access to this tree.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {memberships.map((m) => {
              const Icon = roleIcons[m.role];
              const isCurrentUser = m.user_id === currentUserId;
              const isOwner = m.role === "owner";

              return (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {m.profile?.avatar_url ? (
                      <Image src={m.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" width={36} height={36} />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {m.profile?.display_name ?? "Unknown"}
                      {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                    </p>
                    {m.profile?.email && (
                      <p className="text-xs text-muted-foreground truncate">{m.profile.email}</p>
                    )}
                    {m.linked_node_id && (() => {
                      const linkedMember = memberMap.get(m.linked_node_id!);
                      return linkedMember ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <LinkIcon className="h-3 w-3 text-blue-500" />
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">
                            Linked to {linkedMember.first_name} {linkedMember.last_name ?? ""}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnlinkNode(m.id)}
                            title="Remove profile link"
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {isOwner ? (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Icon className="h-3 w-3" /> Owner
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={m.role}
                        onValueChange={(v) => handleRoleChange(m.id, v as TreeRole)}
                      >
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="glass-card glass-edge-top border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for this tree.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this tree</p>
              <p className="text-xs text-muted-foreground">
                All members, relationships, photos, and history will be permanently deleted.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Tree
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete tree?"
        description={`This will permanently delete "${tree.name}" and all its data. This action cannot be undone.`}
        confirmLabel="Delete Forever"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
