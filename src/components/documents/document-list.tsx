"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, ImageIcon, File, Download, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentTypeBadge } from "./document-type-badge";
import { DocumentViewer } from "./document-viewer";
import { deleteDocument, getDocumentDownloadUrl } from "@/lib/actions/document";
import type { Document } from "@/types/document";

interface DocumentListProps {
  documents: Document[];
  canEdit: boolean;
  currentUserId: string;
  treeId: string;
  onDelete?: () => void;
  onRefresh?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return ImageIcon;
  return File;
}

export function DocumentList({
  documents,
  canEdit,
  currentUserId,
  treeId,
  onDelete,
  onRefresh,
}: DocumentListProps) {
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(doc: Document) {
    setDownloading(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.id, treeId);
      window.open(url, "_blank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  async function handleView(doc: Document) {
    try {
      const url = await getDocumentDownloadUrl(doc.id, treeId);
      setViewerDoc(doc);
      setViewerUrl(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load document");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id, treeId);
      toast.success("Document deleted");
      setDeleteTarget(null);
      onDelete?.();
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function canDeleteDoc(doc: Document): boolean {
    return canEdit || doc.uploaded_by === currentUserId;
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No documents attached
      </p>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.mime_type);
          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors cursor-pointer group"
              onClick={() => handleView(doc)}
            >
              <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  {doc.is_private && (
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <DocumentTypeBadge documentType={doc.document_type} />
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(doc.created_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(doc);
                  }}
                  disabled={downloading === doc.id}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {canDeleteDoc(doc) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(doc);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DocumentViewer
        document={viewerDoc}
        signedUrl={viewerUrl}
        onClose={() => {
          setViewerDoc(null);
          setViewerUrl(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete document?"
        description={`This will permanently delete "${deleteTarget?.file_name}".`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
