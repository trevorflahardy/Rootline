"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { TreePine, AlertCircle, UserPlus, Crown, Eye, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { acceptInvite } from "@/lib/actions/invite";

interface AcceptInviteCardProps {
  inviteCode: string;
  treeName: string;
  role: "editor" | "viewer";
  isExpired: boolean;
  isMaxedOut: boolean;
  isLoggedIn: boolean;
}

const roleInfo = {
  editor: { icon: Edit, label: "Editor", description: "You can add and edit family members" },
  viewer: { icon: Eye, label: "Viewer", description: "You can view the family tree" },
};

export function AcceptInviteCard({
  inviteCode,
  treeName,
  role,
  isExpired,
  isMaxedOut,
  isLoggedIn,
}: AcceptInviteCardProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const info = roleInfo[role];
  const RoleIcon = info.icon;

  const isInvalid = isExpired || isMaxedOut;

  async function handleAccept() {
    setAccepting(true);
    try {
      const { treeId } = await acceptInvite(inviteCode);
      toast.success("You've joined the family tree!");
      router.push(`/tree/${treeId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept invite");
      setAccepting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          {isInvalid ? (
            <AlertCircle className="h-8 w-8 text-destructive" />
          ) : (
            <TreePine className="h-8 w-8 text-primary" />
          )}
        </div>
        <CardTitle className="text-xl">
          {isInvalid ? "Invite Unavailable" : "You're Invited!"}
        </CardTitle>
        <CardDescription>
          {isExpired
            ? "This invite link has expired."
            : isMaxedOut
              ? "This invite link has reached its maximum uses."
              : `You've been invited to join "${treeName}"`}
        </CardDescription>
      </CardHeader>

      {!isInvalid && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
              <RoleIcon className="h-3.5 w-3.5" />
              {info.label}
            </Badge>
          </div>
          <p className="text-sm text-center text-muted-foreground">{info.description}</p>
        </CardContent>
      )}

      <CardFooter className="flex flex-col gap-2">
        {isInvalid ? (
          <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        ) : isLoggedIn ? (
          <Button className="w-full" onClick={handleAccept} disabled={accepting}>
            <UserPlus className="h-4 w-4 mr-2" />
            {accepting ? "Joining..." : "Accept Invite"}
          </Button>
        ) : (
          <>
            <SignInButton mode="modal" forceRedirectUrl={`/invite/${inviteCode}`}>
              <Button className="w-full">
                Sign In to Accept
              </Button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl={`/invite/${inviteCode}`}>
              <Button variant="outline" className="w-full">
                Create Account
              </Button>
            </SignUpButton>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
