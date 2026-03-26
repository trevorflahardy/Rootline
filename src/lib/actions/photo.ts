"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/actions/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeStoragePath, sanitizeText } from "@/lib/sanitize";
import { assertUUID } from "@/lib/validate";

export interface Media {
  id: string;
  tree_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  member_id: string | null;
  is_profile_photo: boolean;
  caption: string | null;
  created_at: string;
}

const BUCKET = "tree-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadPhoto(
  formData: FormData,
  treeId: string,
  memberId?: string,
  isProfilePhoto = false
): Promise<Media> {
  const userId = await getAuthUser();
  rateLimit(userId, 'uploadPhoto', 10, 60_000);
  assertUUID(treeId, 'treeId');
  if (memberId) assertUUID(memberId, 'memberId');
  const supabase = createAdminClient();

  // Check tree access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role === "viewer") {
    throw new Error("You don't have permission to upload photos");
  }

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF.");
  }

  // Generate unique path
  const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, '');
  const timestamp = Date.now();
  const storagePath = sanitizeStoragePath(
    `${treeId}/${memberId ?? "general"}/${timestamp}.${ext}`
  );

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Photo upload failed:", uploadError.message);
    throw new Error("Upload failed");
  }

  // If this is a profile photo, unset any existing profile photo for this member
  if (isProfilePhoto && memberId) {
    await supabase
      .from("media")
      .update({ is_profile_photo: false })
      .eq("tree_id", treeId)
      .eq("member_id", memberId)
      .eq("is_profile_photo", true);
  }

  // Create media record
  const { data, error } = await supabase
    .from("media")
    .insert({
      tree_id: treeId,
      uploaded_by: userId,
      storage_path: storagePath,
      file_name: sanitizeText(file.name),
      file_size: file.size,
      mime_type: file.type,
      member_id: memberId ?? null,
      is_profile_photo: isProfilePhoto,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save photo record:", error.message);
    throw new Error("Failed to save photo");
  }

  // If profile photo, update member's avatar_url
  if (isProfilePhoto && memberId) {
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    await supabase
      .from("tree_members")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", memberId);
  }

  revalidatePath(`/tree/${treeId}`);
  return data as Media;
}

export async function getPhotosByTreeId(treeId: string): Promise<Media[]> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  // Check access
  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch photos: ${error.message}`);
  return (data ?? []) as Media[];
}

export async function getPhotosByMemberId(memberId: string, treeId: string): Promise<Media[]> {
  const userId = await getAuthUser();
  assertUUID(treeId, 'treeId');
  assertUUID(memberId, 'memberId');
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership) throw new Error("No access to this tree");

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("tree_id", treeId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch photos: ${error.message}`);
  return (data ?? []) as Media[];
}

export async function deletePhoto(photoId: string, treeId: string): Promise<void> {
  const userId = await getAuthUser();
  assertUUID(photoId, 'photoId');
  assertUUID(treeId, 'treeId');
  const supabase = createAdminClient();

  const { data: membership } = await supabase
    .from("tree_memberships")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", userId)
    .single();

  if (!membership || membership.role === "viewer") {
    throw new Error("You don't have permission to delete photos");
  }

  // Get the photo record to find storage path
  const { data: photo } = await supabase
    .from("media")
    .select("storage_path, member_id, is_profile_photo")
    .eq("id", photoId)
    .eq("tree_id", treeId)
    .single();

  if (!photo) throw new Error("Photo not found");

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([photo.storage_path]);

  // If it was a profile photo, clear the member's avatar
  if (photo.is_profile_photo && photo.member_id) {
    await supabase
      .from("tree_members")
      .update({ avatar_url: null })
      .eq("id", photo.member_id);
  }

  // Delete record
  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", photoId);

  if (error) throw new Error(`Failed to delete photo: ${error.message}`);
  revalidatePath(`/tree/${treeId}`);
}

// Note: getPhotoUrl moved to @/lib/utils/photo-url for sync client-side use
