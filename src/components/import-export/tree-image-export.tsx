"use client";

import { useCallback, useState } from "react";
import { toPng, toSvg } from "html-to-image";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import {
  Download,
  ImageIcon,
  FileImage,
  Printer,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ExportFormat = "png" | "svg" | "print";

interface TreeImageExportProps {
  treeName?: string;
}

function getFlowElement(): HTMLElement | null {
  return document.querySelector(".react-flow") as HTMLElement | null;
}

function downloadFile(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const CAPTURE_OPTIONS = {
  backgroundColor: "#ffffff",
  quality: 1,
  pixelRatio: 2,
  filter: (node: HTMLElement) => {
    // Exclude minimap, toolbar overlays, and panels from the export
    const isOverlay =
      node.classList?.contains("react-flow__minimap") ||
      node.classList?.contains("react-flow__controls") ||
      node.closest?.("[data-export-exclude]") != null;
    return !isOverlay;
  },
};

export function TreeImageExport({ treeName }: TreeImageExportProps) {
  const [exporting, setExporting] = useState(false);
  const { fitView } = useReactFlow();

  const exportImage = useCallback(
    async (format: ExportFormat) => {
      const el = getFlowElement();
      if (!el) {
        toast.error("Could not find the tree canvas");
        return;
      }

      if (format === "print") {
        handlePrint(el, treeName);
        return;
      }

      setExporting(true);
      const toastId = toast.loading(
        `Exporting as ${format.toUpperCase()}...`
      );

      try {
        // Fit the view before capture so the full tree is visible
        await fitView({ padding: 0.15, duration: 0 });
        // Small delay for the layout to settle
        await new Promise((r) => setTimeout(r, 200));

        const baseName = treeName
          ? sanitizeFilename(treeName)
          : "family-tree";

        if (format === "png") {
          const dataUrl = await toPng(el, CAPTURE_OPTIONS);
          downloadFile(dataUrl, `${baseName}.png`);
        } else {
          const dataUrl = await toSvg(el, CAPTURE_OPTIONS);
          downloadFile(dataUrl, `${baseName}.svg`);
        }

        toast.success(`Exported as ${format.toUpperCase()}`, { id: toastId });
      } catch {
        toast.error("Failed to export image. Please try again.", {
          id: toastId,
        });
      } finally {
        setExporting(false);
      }
    },
    [fitView, treeName]
  );

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Export tree</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" sideOffset={8}>
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportImage("png")}>
          <ImageIcon className="h-4 w-4" />
          PNG Image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportImage("svg")}>
          <FileImage className="h-4 w-4" />
          SVG Vector
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportImage("print")}>
          <Printer className="h-4 w-4" />
          Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function handlePrint(el: HTMLElement, treeName?: string) {
  const toastId = toast.loading("Preparing print view...");

  toPng(el, CAPTURE_OPTIONS)
    .then((dataUrl) => {
      toast.dismiss(toastId);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Pop-up blocked. Please allow pop-ups and try again.");
        return;
      }

      const title = treeName ?? "Family Tree";
      const doc = printWindow.document;

      // Build the print page using DOM methods
      const style = doc.createElement("style");
      style.textContent = [
        "@page { margin: 0.5in; }",
        "* { margin: 0; padding: 0; box-sizing: border-box; }",
        "body { display: flex; flex-direction: column; align-items: center; padding: 20px; font-family: system-ui, sans-serif; }",
        "h1 { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #333; }",
        "img { max-width: 100%; height: auto; }",
      ].join("\n");
      doc.head.appendChild(style);

      doc.title = title;

      const heading = doc.createElement("h1");
      heading.textContent = title;
      doc.body.appendChild(heading);

      const img = doc.createElement("img");
      img.src = dataUrl;
      img.alt = title;
      img.onload = () => {
        setTimeout(() => printWindow.print(), 300);
      };
      doc.body.appendChild(img);
    })
    .catch(() => {
      toast.error("Failed to prepare print view.", { id: toastId });
    });
}
