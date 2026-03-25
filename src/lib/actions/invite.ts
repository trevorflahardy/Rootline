"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { createInviteSchema, type CreateInviteInput } from "@/lib/validators/invite";
import { rateLimit } from "@/lib/rate-limit";

export interface Invitation {
  id: string;
  tree_id: string;
  invite_code: string;
  created_by: string;
  target_node_id: string | null;
  email: string | null;
  role: "editor" | "viewer";
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

function generateInviteCode(): string {
  return randomBytes(16).toString("hex");
}

export async function createInvite(input: CreateInviteInput): Promise<Invitation> {
  const userId = await getAuthUser();
  rateLimit(userId, 'createInvite', 5, 60_000);
  const validated = createInviteSchema.parse(input);
  const supabase = createAdminClient();

  // Only owners can create invites
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", validated.tree_id)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only tree owners can create invites");
  }

  // Check if target node already has a linked user
  if (validated.target_node_id) {
    const { data: existingLink } = await supabase
      .from("tree_memberships")
      .select("id, user_id, profiles(display_name)")
      .eq("tree_id", validated.tree_id)
      .eq("linked_node_id", validated.target_node_id)
      .single();

    if (existingLink) {
      const profile = existingLink.profiles as unknown as { display_name: string } | null;
      throw new Error(
        `This node is already linked to ${profile?.display_name ?? "another user"}. Unlink them first before creating a new invite for this node.`
      );
    }
  }

  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tree_id: validated.tree_id,
      invite_code: inviteCode,
      created_by: userId,
      target_node_id: validated.target_node_id || null,
      email: validated.email || null,
      role: validated.role,
      max_uses: validated.max_uses,
      use_count: 0,
      expires_at: validated.expires_at || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  revalidatePath(`/tree/${validated.tree_id}/settings`);
  return data as Invitation;
}

export async function getInvitesByTreeId(treeId: string): Promise<Invitation[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only owners can view invites");
  }

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch invites: ${error.message}`);
  return (data ?? []) as Invitation[];
}

export async function getInviteByCode(code: string): Promise<Invitation | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("invite_code", code)
    .single();

  if (error || !data) return null;
  return data as Invitation;
}

export async function acceptInvite(inviteCode: string): Promise<{ treeId: string }> {
  const userId = await getAuthUser();
  rateLimit(userId, 'acceptInvite', 10, 60_000);
  const supabase = createAdminClient();

  // Get the invite
  const { data: invite, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("invite_code", inviteCode)
    .single();

  if (inviteError || !invite) throw new Error("Invalid invite code");

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new Error("This invite has expired");
  }

  // Check usage
  if (invite.use_count >= invite.max_uses) {
    throw new Error("This invite has reached its maximum uses");
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("tree_memberships")
    .select("id")
    .eq("tree_id", invite.tree_id)
    .eq("user_id", userId)
    .single();

  if (existing) {
    return { treeId: invite.tree_id };
  }

  // Create membership
  const { error: membershipError } = await supabase
    .from("tree_memberships")
    .insert({
      tree_id: invite.tree_id,
      user_id: userId,
      role: invite.role,
      linked_node_id: invite.target_node_id || null,
    });

  if (membershipError) throw new Error(`Failed to join tree: ${membershipError.message}`);

  // Increment use count
  await supabase
    .from("invitations")
    .update({ use_count: invite.use_count + 1 })
    .eq("id", invite.id);

  revalidatePath("/dashboard");
  return { treeId: invite.tree_id };
}

export async function revokeInvite(inviteId: string, treeId: string): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only owners can revoke invites");
  }

  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", inviteId)
    .eq("tree_id", treeId);

  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
  revalidatePath(`/tree/${treeId}/settings`);
}
