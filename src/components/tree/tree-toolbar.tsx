"use client";

import { useReactFlow } from "@xyflow/react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Search,
  Upload,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TreeImageExport } from "@/components/import-export/tree-image-export";
import { GedcomExportButton } from "@/components/import-export/gedcom-export-button";

interface TreeToolbarProps {
  treeId: string;
  onAddMember: () => void;
  onSearch: () => void;
  onImportGedcom?: () => void;
  onLinkMembers?: () => void;
  treeName?: string;
  canEdit: boolean;
}

export function TreeToolbar({ treeId, onAddMember, onSearch, onImportGedcom, onLinkMembers, treeName, canEdit }: TreeToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1 glass-card glass-light glass-edge-top rounded-xl p-1.5" data-export-exclude>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomIn()}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom in</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomOut()}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom out</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit view</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Search members (Ctrl+K)</TooltipContent>
      </Tooltip>

      {canEdit && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddMember}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add member</TooltipContent>
          </Tooltip>

          {onLinkMembers && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLinkMembers}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Link members</TooltipContent>
            </Tooltip>
          )}
        </>
      )}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {canEdit && onImportGedcom && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onImportGedcom}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import GEDCOM</TooltipContent>
        </Tooltip>
      )}

      <GedcomExportButton treeId={treeId} treeName={treeName} />

      <TreeImageExport treeName={treeName} />
    </div>
  );
}
