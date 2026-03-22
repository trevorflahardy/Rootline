import { z } from "zod/v4";

const relationshipTypeEnum = z.enum([
  "parent_child",
  "spouse",
  "divorced",
  "adopted",
]);

export const createRelationshipSchema = z.object({
  tree_id: z.uuid(),
  from_member_id: z.uuid(),
  to_member_id: z.uuid(),
  relationship_type: relationshipTypeEnum,
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
