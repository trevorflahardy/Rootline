"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadDocument } from "@/lib/actions/document";
import {
  MAX_DOCUMENT_SIZE,
  ALLOWED_DOCUMENT_MIMES,
} from "@/lib/validators/document";
import type { DocumentType } from "@/types/document";

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  memberId: string;
  onUploadComplete: () => void;
}

const documentTypeLabels: Record<DocumentType, string> = {
  birth_certificate: "Birth Certificate",
  marriage_license: "Marriage License",
  death_certificate: "Death Certificate",
  immigration: "Immigration",
  legal: "Legal",
  medical: "Medical",
  photo_album: "Photo Album",
  other: "Other",
};

export function DocumentUpload({
  open,
  onOpenChange,
  treeId,
  memberId,
  onUploadComplete,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("other");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.size > MAX_DOCUMENT_SIZE) {
      toast.error("File too large. Maximum 25MB.");
      return;
    }
    if (!ALLOWED_DOCUMENT_MIMES.includes(f.type)) {
      toast.error("Invalid type. Use PDF, JPEG, PNG, WebP, DOC, or DOCX.");
      return;
    }
    setFile(f);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }

  function clearState() {
    setFile(null);
    setDocumentType("other");
    setDescription("");
    setIsPrivate(false);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("treeId", treeId);
      formData.append("memberId", memberId);
      formData.append("document_type", documentType);
      if (description) formData.append("description", description);
      formData.append("is_private", String(isPrivate));

      await uploadDocument(formData);
      toast.success("Document uploaded!");
      clearState();
      onOpenChange(false);
      onUploadComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) clearState();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Attach a document to this family member.
          </DialogDescription>
        </DialogHeader>

        {file ? (
          <div className="rounded-lg border p-3 flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
            >
              Remove
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
            <p className="text-sm font-medium">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPEG, PNG, WebP, DOC, DOCX — Max 25MB
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_DOCUMENT_MIMES.join(",")}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Document Type
            </label>
            <Select
              value={documentType}
              onValueChange={(v) => setDocumentType(v as DocumentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(documentTypeLabels) as [DocumentType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              className="min-h-[60px]"
              maxLength={500}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-private"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked === true)}
            />
            <label htmlFor="is-private" className="text-sm">
              Make this document private
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            <FileText className="h-4 w-4 mr-1.5" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
