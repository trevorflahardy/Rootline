"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { canEditMember } from "@/lib/actions/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText, sanitizeStoragePath } from "@/lib/sanitize";
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  MAX_DOCUMENT_SIZE,
  ALLOWED_DOCUMENT_MIMES,
} from "@/lib/validators/document";
import type { Document } from "@/types/document";

const BUCKET = "tree-documents";

export async function uploadDocument(formData: FormData): Promise<Document> {
  const userId = await getAuthUser();
  rateLimit(userId, 'uploadDocument', 10, 60_000);
  const supabase = createAdminClient();

  const treeId = formData.get("treeId") as string;
  const memberId = formData.get("memberId") as string;
  const file = formData.get("file") as File | null;

  if (!treeId || !memberId) throw new Error("Missing treeId or memberId");
  if (!file) throw new Error("No file provided");

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error("File too large. Maximum size is 25MB.");
  }

  if (!ALLOWED_DOCUMENT_MIMES.includes(file.type)) {
    throw new Error(
      "Invalid file type. Allowed: PDF, JPEG, PNG, WebP, DOC, DOCX."
    );
  }

  // Parse metadata
  const metadata = uploadDocumentSchema.parse({
    document_type: formData.get("document_type"),
    description: formData.get("description") || undefined,
    is_private: formData.get("is_private") === "true",
  });

  // Permission check
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role, linked_node_id")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  if (membership.role === "viewer") {
    throw new Error("Viewers cannot upload documents");
  }

  // Scoped editors: check branch access
  if (membership.role === "editor" && membership.linked_node_id) {
    const allowed = await canEditMember(treeId, memberId);
    if (!allowed) {
      throw new Error("You can only upload documents to members in your branch");
    }
  }

  // Generate unique storage path
  const uuid = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = sanitizeStoragePath(
    `${treeId}/${memberId}/${uuid}_${sanitizedName}`
  );

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Document upload failed:", uploadError.message);
    throw new Error("Upload failed");
  }

  // Create DB record
  const { data, error } = await supabase
    .from("documents")
    .insert({
      tree_id: treeId,
      member_id: memberId,
      uploaded_by: userId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      document_type: metadata.document_type,
      description: metadata.description ? sanitizeText(metadata.description) : null,
      is_private: metadata.is_private,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save document record:", error.message);
    throw new Error("Failed to save document");
  }

  revalidatePath(`/tree/${treeId}`);
  return data as Document;
}

export async function getDocumentsByMember(
  treeId: string,
  memberId: string
): Promise<Document[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  // Check tree membership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("tree_id", treeId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

  const docs = (data ?? []) as Document[];

  // Filter private documents: only visible to uploader + tree owner
  if (membership.role !== "owner") {
    return docs.filter((d) => !d.is_private || d.uploaded_by === userId);
  }

  return docs;
}

export async function getDocumentsByTree(treeId: string): Promise<Document[]> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  // Owner only
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only the tree owner can view all documents");
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data ?? []) as Document[];
}

export async function deleteDocument(
  documentId: string,
  treeId: string
): Promise<void> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  // Check membership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  // Get the document
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("tree_id", treeId)
    .single();

  if (!doc) throw new Error("Document not found");

  // Only uploader or owner can delete
  if (doc.uploaded_by !== userId && membership.role !== "owner") {
    throw new Error("You don't have permission to delete this document");
  }

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);

  // Delete record
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
  revalidatePath(`/tree/${treeId}`);
}

export async function updateDocument(
  documentId: string,
  treeId: string,
  data: { document_type?: string; description?: string; is_private?: boolean }
): Promise<Document> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  const raw = updateDocumentSchema.parse(data);
  const validated = {
    ...raw,
    ...(raw.description !== undefined ? { description: raw.description ? sanitizeText(raw.description) : null } : {}),
  };

  // Check membership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  // Get the document
  const { data: doc } = await supabase
    .from("documents")
    .select("uploaded_by")
    .eq("id", documentId)
    .eq("tree_id", treeId)
    .single();

  if (!doc) throw new Error("Document not found");

  // Only uploader or owner can update
  if (doc.uploaded_by !== userId && membership.role !== "owner") {
    throw new Error("You don't have permission to update this document");
  }

  const { data: updated, error } = await supabase
    .from("documents")
    .update(validated)
    .eq("id", documentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update document: ${error.message}`);
  revalidatePath(`/tree/${treeId}`);
  return updated as Document;
}

export async function getDocumentDownloadUrl(
  documentId: string,
  treeId: string
): Promise<string> {
  const userId = await getAuthUser();
  const supabase = createAdminClient();

  // Check membership
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  // Get the document
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("tree_id", treeId)
    .single();

  if (!doc) throw new Error("Document not found");

  // Check privacy
  if (doc.is_private && doc.uploaded_by !== userId && membership.role !== "owner") {
    throw new Error("You don't have access to this private document");
  }

  // Create signed URL (60 second expiry)
  const { data: signedData, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60);

  if (error || !signedData?.signedUrl) {
    throw new Error("Failed to generate download URL");
  }

  return signedData.signedUrl;
}
