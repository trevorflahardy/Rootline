import { z } from "zod/v4";

const relationshipTypeEnum = z.enum([
  "parent_child",
  "spouse",
  "divorced",
  "adopted",
  "sibling",
  "step_parent",
  "step_child",
  "in_law",
  "guardian",
]);

export const createRelationshipSchema = z
  .object({
    tree_id: z.uuid(),
    from_member_id: z.uuid(),
    to_member_id: z.uuid(),
    relationship_type: relationshipTypeEnum,
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .refine((d) => d.from_member_id !== d.to_member_id, {
    message: "A member cannot have a relationship with themselves",
    path: ["to_member_id"],
  });

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
