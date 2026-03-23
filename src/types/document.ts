export type DocumentType =
  | "birth_certificate"
  | "marriage_license"
  | "death_certificate"
  | "immigration"
  | "legal"
  | "medical"
  | "photo_album"
  | "other";

export interface Document {
  id: string;
  tree_id: string;
  member_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_type: DocumentType;
  description: string | null;
  is_private: boolean;
  created_at: string;
}
