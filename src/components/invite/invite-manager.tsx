"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Copy, Link2, Plus, Trash2, User, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { cn } from "@/lib/utils/cn";
import type { TreeMember } from "@/types";

interface InviteManagerProps {
  treeId: string;
  invites: Invitation[];
  members: TreeMember[];
  initialCreateOpen?: boolean;
}

export function InviteManager({ treeId, invites, members, initialCreateOpen = false }: InviteManagerProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(initialCreateOpen);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
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
  const selectedMember = members.find((m) => m.id === targetNodeId);

  return (
    <Card className="glass-card glass-edge-top border-white/10">
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
                <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={memberSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedMember ? (
                        <span className="flex items-center gap-2 truncate">
                          <MemberAvatar member={selectedMember} />
                          {selectedMember.first_name} {selectedMember.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Search by name...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-85 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search people by name..." />
                      <CommandList>
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="no-link"
                            onSelect={() => {
                              setTargetNodeId("");
                              setMemberSearchOpen(false);
                            }}
                          >
                            <span>No link - full editor access</span>
                            <Check className={cn("ml-auto h-4 w-4", !targetNodeId ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                          {members.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={`${m.first_name} ${m.last_name ?? ""}`}
                              onSelect={() => {
                                setTargetNodeId(m.id);
                                setMemberSearchOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <MemberAvatar member={m} />
                                <span className="truncate">{m.first_name} {m.last_name}</span>
                              </div>
                              <Check className={cn("ml-auto h-4 w-4", targetNodeId === m.id ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedMember && (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="secondary" className="flex items-center gap-1.5 pr-1">
                      <MemberAvatar member={selectedMember} />
                      <span className="truncate max-w-55">
                        {selectedMember.first_name} {selectedMember.last_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTargetNodeId("")}
                        className="rounded-sm p-0.5 hover:bg-black/10"
                        aria-label="Clear linked member"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                )}
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

function MemberAvatar({ member }: { member: TreeMember }) {
  if (member.avatar_url) {
    return (
      <Image
        src={member.avatar_url}
        alt={member.first_name}
        className="h-5 w-5 rounded-full object-cover shrink-0"
        width={20}
        height={20}
      />
    );
  }

  return (
    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <User className="h-3 w-3 text-primary" />
    </div>
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
