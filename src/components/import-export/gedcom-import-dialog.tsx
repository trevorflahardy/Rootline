"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseGedcom, type GedcomParseResult } from "@/lib/utils/gedcom-parser";
import { importGedcomData } from "@/lib/actions/import";

interface GedcomImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
}

export function GedcomImportDialog({ open, onOpenChange, treeId }: GedcomImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<GedcomParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setParseResult(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseGedcom(text);
      setParseResult(result);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      reset();
    };
    reader.readAsText(file);
  }, [reset]);

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.members.length === 0) return;

    setImporting(true);
    try {
      const result = await importGedcomData(treeId, parseResult.members, parseResult.relationships);

      if (result.errors.length > 0) {
        toast.warning(`Import completed with ${result.errors.length} warning(s)`, {
          description: result.errors[0],
        });
      } else {
        toast.success(
          `Imported ${result.members.length} member(s) and ${result.relationships.length} relationship(s)`
        );
      }

      onOpenChange(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [parseResult, treeId, onOpenChange, reset, router]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import GEDCOM File</DialogTitle>
          <DialogDescription>
            Upload a .ged file to import family members and relationships into this tree.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {fileName ? fileName : "Click to select a .ged file"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.gedcom"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Preview */}
          {parseResult && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Preview</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Members found:</div>
                <div className="font-medium">{parseResult.members.length}</div>
                <div className="text-muted-foreground">Relationships found:</div>
                <div className="font-medium">{parseResult.relationships.length}</div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{parseResult.errors.length} warning(s)</span>
                  </div>
                  <ul className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parseResult || parseResult.members.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
