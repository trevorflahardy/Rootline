import { z } from "zod/v4";

export const documentTypeEnum = z.enum([
  "birth_certificate",
  "marriage_license",
  "death_certificate",
  "immigration",
  "legal",
  "medical",
  "photo_album",
  "other",
]);

export const uploadDocumentSchema = z.object({
  document_type: documentTypeEnum,
  description: z.string().max(500).optional(),
  is_private: z.boolean().optional().default(false),
});

export const updateDocumentSchema = z.object({
  document_type: documentTypeEnum.optional(),
  description: z.string().max(500).optional(),
  is_private: z.boolean().optional(),
});

export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

export const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
