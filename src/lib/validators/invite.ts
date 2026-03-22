import { z } from "zod/v4";

export const createInviteSchema = z.object({
  tree_id: z.uuid(),
  email: z.email().optional(),
  target_node_id: z.uuid().optional(),
  role: z.enum(["editor", "viewer"]).default("editor"),
  max_uses: z.number().int().min(1).max(100).default(1),
  expires_at: z.string().optional(),
});

export const acceptInviteSchema = z.object({
  invite_code: z.string().min(1),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
