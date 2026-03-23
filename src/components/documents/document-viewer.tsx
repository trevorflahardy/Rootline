"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentTypeBadge } from "./document-type-badge";
import type { Document } from "@/types/document";

interface DocumentViewerProps {
  document: Document | null;
  signedUrl: string | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentViewer({
  document,
  signedUrl,
  onClose,
}: DocumentViewerProps) {
  if (!document) return null;

  const isImage = document.mime_type.startsWith("image/");
  const isPdf = document.mime_type === "application/pdf";

  return (
    <Dialog open={!!document} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="truncate">{document.file_name}</span>
            <DocumentTypeBadge documentType={document.document_type} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {isImage && signedUrl ? (
            <div className="relative w-full min-h-[300px] max-h-[60vh]">
              <Image
                src={signedUrl}
                alt={document.file_name}
                className="object-contain rounded-lg"
                fill
                unoptimized
              />
            </div>
          ) : isPdf && signedUrl ? (
            <div className="space-y-3">
              <iframe
                src={signedUrl}
                className="w-full h-[60vh] rounded-lg border"
                title={document.file_name}
              />
              <p className="text-xs text-muted-foreground text-center">
                PDF not loading?{" "}
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Download directly
                </a>
              </p>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type.
              </p>
              <p className="text-xs text-muted-foreground">
                {document.file_name} — {formatFileSize(document.file_size)}
              </p>
            </div>
          )}
        </div>

        {document.description && (
          <p className="text-sm text-muted-foreground border-t pt-3">
            {document.description}
          </p>
        )}

        <div className="flex justify-end pt-2">
          {signedUrl && (
            <Button asChild>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
