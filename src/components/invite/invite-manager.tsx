"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, Plus, Trash2, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createInvite, revokeInvite, type Invitation } from "@/lib/actions/invite";
import type { TreeMember } from "@/types";

interface InviteManagerProps {
  treeId: string;
  invites: Invitation[];
  members: TreeMember[];
}

export function InviteManager({ treeId, invites, members }: InviteManagerProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [targetNodeId, setTargetNodeId] = useState<string>("");
  const [maxUses, setMaxUses] = useState("1");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const invite = await createInvite({
        tree_id: treeId,
        role,
        target_node_id: targetNodeId || undefined,
        max_uses: parseInt(maxUses) || 1,
      });

      const url = `${window.location.origin}/invite/${invite.invite_code}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard!");
      setShowCreate(false);
      setTargetNodeId("");
      setMaxUses("1");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await revokeInvite(inviteId, treeId);
      toast.success("Invite revoked");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke");
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  const activeInvites = invites.filter(
    (i) => i.use_count < i.max_uses && (!i.expires_at || new Date(i.expires_at) > new Date())
  );
  const usedInvites = invites.filter(
    (i) => i.use_count >= i.max_uses || (i.expires_at && new Date(i.expires_at) <= new Date())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>Invite others to view or edit this tree.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Invite
        </Button>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No invites yet. Create one to share with family members.
          </p>
        ) : (
          <div className="space-y-3">
            {activeInvites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onCopy={() => copyLink(invite.invite_code)}
                onRevoke={() => handleRevoke(invite.id)}
              />
            ))}
            {usedInvites.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wider pt-2">
                  Expired / Used
                </p>
                {usedInvites.map((invite) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    expired
                    onCopy={() => copyLink(invite.invite_code)}
                    onRevoke={() => handleRevoke(invite.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>

      {/* Create invite dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invite Link</DialogTitle>
            <DialogDescription>
              Generate a link to invite someone to this tree.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor — can add and edit members</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "editor" && members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Link to member (optional)</Label>
                <Select value={targetNodeId} onValueChange={setTargetNodeId}>
                  <SelectTrigger><SelectValue placeholder="No link — full editor access" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No link — full editor access</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} — can edit descendants only
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If linked, the editor can only modify this member and their descendants.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Max uses</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              <Link2 className="h-4 w-4 mr-1.5" />
              {creating ? "Creating..." : "Create & Copy Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InviteRow({
  invite,
  expired,
  onCopy,
  onRevoke,
}: {
  invite: Invitation;
  expired?: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={expired ? "outline" : "secondary"} className="text-[10px]">
            {invite.role}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {invite.use_count}/{invite.max_uses} used
          </span>
          {invite.email && (
            <span className="text-xs text-muted-foreground truncate">{invite.email}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
          ...{invite.invite_code.slice(-8)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {!expired && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRevoke}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
