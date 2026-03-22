"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePhoto, type Media } from "@/lib/actions/photo";
import { getPhotoUrl } from "@/lib/utils/photo-url";

interface PhotoGalleryProps {
  photos: Media[];
  treeId: string;
  canEdit: boolean;
}

export function PhotoGallery({ photos, treeId, canEdit }: PhotoGalleryProps) {
  const router = useRouter();
  const [lightboxPhoto, setLightboxPhoto] = useState<Media | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePhoto(deleteTarget.id, treeId);
      toast.success("Photo deleted");
      setDeleteTarget(null);
      setLightboxPhoto(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No photos yet.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setLightboxPhoto(photo)}
            className="aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
          >
            <img
              src={getPhotoUrl(photo.storage_path)}
              alt={photo.caption ?? photo.file_name}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={getPhotoUrl(lightboxPhoto.storage_path)}
                alt={lightboxPhoto.caption ?? lightboxPhoto.file_name}
                className="w-full max-h-[80vh] object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                {canEdit && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDeleteTarget(lightboxPhoto)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {lightboxPhoto.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2">
                  <p className="text-white text-sm">{lightboxPhoto.caption}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete photo?"
        description="This will permanently delete this photo."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
