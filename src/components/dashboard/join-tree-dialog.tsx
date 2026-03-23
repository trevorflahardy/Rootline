"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/actions/invite";

interface JoinTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinTreeDialog({ open, onOpenChange }: JoinTreeDialogProps) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function extractInviteCode(input: string): string {
    const trimmed = input.trim();
    // Support pasting full invite URLs like /invite/abc123
    const match = trimmed.match(/\/invite\/([a-f0-9]+)\/?$/i);
    if (match) return match[1];
    return trimmed;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractInviteCode(inviteCode);
    if (!code) {
      toast.error("Please enter an invite code");
      return;
    }

    setIsSubmitting(true);
    try {
      const { treeId } = await acceptInvite(code);
      toast.success("You've joined the family tree!");
      onOpenChange(false);
      setInviteCode("");
      router.push(`/tree/${treeId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to join tree"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Family Tree</DialogTitle>
          <DialogDescription>
            Enter an invite code or paste an invite link to join an existing
            family tree.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              placeholder="Paste invite code or link..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !inviteCode.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />
              {isSubmitting ? "Joining..." : "Join Tree"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
