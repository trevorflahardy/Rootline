"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadPhoto } from "@/lib/actions/photo";

interface PhotoUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  memberId?: string;
  isProfilePhoto?: boolean;
  onUploaded: () => void;
}

export function PhotoUpload({
  open,
  onOpenChange,
  treeId,
  memberId,
  isProfilePhoto = false,
  onUploaded,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum 5MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      toast.error("Invalid type. Use JPEG, PNG, WebP, or GIF.");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }

  function clearFile() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadPhoto(formData, treeId, memberId, isProfilePhoto);
      toast.success("Photo uploaded!");
      clearFile();
      onOpenChange(false);
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) clearFile(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isProfilePhoto ? "Upload Profile Photo" : "Upload Photo"}</DialogTitle>
          <DialogDescription>
            {isProfilePhoto
              ? "Choose a photo to use as the profile picture."
              : "Add a photo to this family tree."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="relative">
            <div className="relative w-full" style={{ minHeight: "200px", maxHeight: "256px" }}>
              <Image
                src={preview}
                alt="Preview"
                className="object-contain rounded-lg border"
                fill
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={clearFile}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drop an image here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, GIF — Max 5MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            <ImageIcon className="h-4 w-4 mr-1.5" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
