"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getDocumentsByMember, uploadDocument } from "@/lib/actions/document";
import { getPhotosByMemberId, type Media } from "@/lib/actions/photo";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotoUpload } from "@/components/photos/photo-upload";
import type { Document } from "@/types";

function DocumentDropZone({
  treeId,
  memberId,
  onUploaded,
}: {
  treeId: string;
  memberId: string;
  onUploaded: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.value = "";
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("treeId", treeId);
      formData.set("memberId", memberId);
      formData.set("file", file);
      formData.set("document_type", "other");
      await uploadDocument(formData);
      toast.success(`Uploaded ${file.name}`);
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <label
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-3 transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-muted-foreground/40"
      } ${uploading ? "pointer-events-none opacity-50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="text-muted-foreground h-4 w-4" />
      <span className="text-muted-foreground text-center text-xs">
        {uploading ? "Uploading..." : "Drop file or click to upload"}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx"
        onChange={handleFileSelect}
        disabled={uploading}
      />
    </label>
  );
}

interface MemberPhotoSectionProps {
  treeId: string;
  memberId: string;
  photos: Media[];
  documents: Document[];
  canEdit: boolean;
  onPhotosChange: (photos: Media[]) => void;
  onDocumentsChange: (documents: Document[]) => void;
}

export function MemberPhotoSection({
  treeId,
  memberId,
  photos,
  documents,
  canEdit,
  onPhotosChange,
  onDocumentsChange,
}: MemberPhotoSectionProps) {
  const router = useRouter();
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
            <Camera className="h-3 w-3" />
            Photos
            {photos.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {photos.length}
              </Badge>
            )}
          </p>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setPhotoUploadOpen(true)}
            >
              <Upload className="mr-1 h-3 w-3" />
              Add
            </Button>
          )}
        </div>
        <PhotoGallery photos={photos} treeId={treeId} canEdit={canEdit} />
        <PhotoUpload
          open={photoUploadOpen}
          onOpenChange={setPhotoUploadOpen}
          treeId={treeId}
          memberId={memberId}
          onUploaded={() => {
            getPhotosByMemberId(memberId, treeId)
              .then(onPhotosChange)
              .catch(() => {});
            router.refresh();
          }}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
            <FileText className="h-3 w-3" />
            Documents
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {documents.length}
              </Badge>
            )}
          </p>
        </div>
        {documents.length > 0 ? (
          <div className="space-y-1">
            {documents.slice(0, 3).map((doc) => (
              <div
                key={doc.id}
                className="hover:bg-accent/30 flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
              >
                <FileText className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{doc.file_name}</span>
                <DocumentTypeBadge documentType={doc.document_type} />
              </div>
            ))}
            {documents.length > 3 && (
              <p className="text-muted-foreground px-2 text-xs">+{documents.length - 3} more</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No documents attached</p>
        )}

        {canEdit && (
          <DocumentDropZone
            treeId={treeId}
            memberId={memberId}
            onUploaded={() => {
              getDocumentsByMember(treeId, memberId)
                .then(onDocumentsChange)
                .catch(() => {});
              router.refresh();
            }}
          />
        )}
      </div>
    </>
  );
}
