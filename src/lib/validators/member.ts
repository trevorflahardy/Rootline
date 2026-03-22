import { z } from "zod/v4";

const genderEnum = z.enum(["male", "female", "other", "unknown"]);

export const createMemberSchema = z.object({
  tree_id: z.uuid(),
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().max(100).optional(),
  maiden_name: z.string().max(100).optional(),
  gender: genderEnum.optional(),
  date_of_birth: z.string().optional(),
  date_of_death: z.string().optional(),
  birth_place: z.string().max(200).optional(),
  death_place: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  is_deceased: z.boolean().optional(),
});

export const updateMemberSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().max(100).optional(),
  maiden_name: z.string().max(100).optional(),
  gender: genderEnum.optional(),
  date_of_birth: z.string().optional(),
  date_of_death: z.string().optional(),
  birth_place: z.string().max(200).optional(),
  death_place: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  is_deceased: z.boolean().optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
