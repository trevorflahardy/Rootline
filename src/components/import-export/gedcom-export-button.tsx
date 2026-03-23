"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";
import { exportGedcom } from "@/lib/utils/gedcom-exporter";

interface GedcomExportButtonProps {
  treeId: string;
  treeName?: string;
}

export function GedcomExportButton({ treeId, treeName }: GedcomExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const [members, relationships] = await Promise.all([
        getMembersByTreeId(treeId),
        getRelationshipsByTreeId(treeId),
      ]);

      if (members.length === 0) {
        toast.error("No members to export");
        return;
      }

      const gedcom = exportGedcom(members, relationships, treeName);
      const blob = new Blob([gedcom], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${(treeName ?? "family-tree").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.ged`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("GEDCOM file exported successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [treeId, treeName]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Export GEDCOM</TooltipContent>
    </Tooltip>
  );
}
