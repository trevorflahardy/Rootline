import { z } from "zod/v4";

export const updateProfilePreferencesSchema = z.object({
  descendant_highlight_depth: z.number().int().min(0).max(10),
});

export type UpdateProfilePreferencesInput = z.infer<typeof updateProfilePreferencesSchema>;
