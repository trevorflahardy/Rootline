import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getInviteByCode } from "@/lib/actions/invite";
import { getTreeById } from "@/lib/actions/tree";
import { AcceptInviteCard } from "@/components/invite/accept-invite-card";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await getInviteByCode(code);
  if (!invite) return { title: "Invalid Invite" };

  return { title: "Join Family Tree" };
}

export default async function InviteAcceptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await getInviteByCode(code);

  if (!invite) notFound();

  const { userId } = await auth();

  // Check validity
  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const isMaxedOut = invite.use_count >= invite.max_uses;

  let treeName = "a family tree";
  try {
    // Use admin fetch since the user may not be a member yet
    const tree = await getTreeById(invite.tree_id).catch(() => null);
    if (tree) treeName = tree.name;
  } catch {
    // Tree name is nice-to-have, not critical
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <AcceptInviteCard
        inviteCode={code}
        treeName={treeName}
        role={invite.role}
        isExpired={!!isExpired}
        isMaxedOut={isMaxedOut}
        isLoggedIn={!!userId}
      />
    </div>
  );
}
