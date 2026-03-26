"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, ChevronRight, ChevronLeft, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getOwnedTreesForMerge,
  previewMerge,
  mergeTree,
} from "@/lib/actions/merge";
import type { MergeConflict, MemberMapping, ConflictResolution } from "@/lib/actions/merge";
import type { TreeSummary } from "@/types";

interface MergeTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTreeId: string;
  targetTreeName: string;
}

const STEPS = ["Select source", "Preview conflicts", "Resolve", "Confirm"] as const;

export function MergeTreeDialog({
  open,
  onOpenChange,
  targetTreeId,
  targetTreeName,
}: MergeTreeDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ownedTrees, setOwnedTrees] = useState<TreeSummary[]>([]);
  const [sourceTreeId, setSourceTreeId] = useState<string>("");
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSourceTreeId("");
    setConflicts([]);
    setResolutions({});
    getOwnedTreesForMerge(targetTreeId).then(setOwnedTrees).catch(() => {
      toast.error("Failed to load trees");
    });
  }, [open, targetTreeId]);

  const sourceTree = ownedTrees.find((t) => t.id === sourceTreeId);

  async function handlePreview() {
    if (!sourceTreeId) return;
    setLoading(true);
    try {
      const found = await previewMerge(sourceTreeId, targetTreeId);
      setConflicts(found);
      const defaultResolutions: Record<string, ConflictResolution> = {};
      for (const c of found) {
        defaultResolutions[c.sourceMemberId] = "merge";
      }
      setResolutions(defaultResolutions);
      setStep(found.length > 0 ? 2 : 3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview merge");
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge() {
    setMerging(true);
    try {
      const mappings: MemberMapping[] = conflicts.map((c) => ({
        sourceMemberId: c.sourceMemberId,
        resolution: resolutions[c.sourceMemberId] ?? "merge",
        targetMemberId:
          resolutions[c.sourceMemberId] === "merge" ? c.targetMemberId : undefined,
      }));

      await mergeTree(sourceTreeId, targetTreeId, mappings);
      toast.success("Trees merged successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  const mergedCount = conflicts.filter((c) => resolutions[c.sourceMemberId] === "merge").length;
  const skippedCount = conflicts.filter((c) => resolutions[c.sourceMemberId] === "skip").length;
  const copiedConflicts = conflicts.filter((c) => resolutions[c.sourceMemberId] === "copy").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card glass-elevated glass-edge-top glass-edge-left border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Merge into &ldquo;{targetTreeName}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Copy members and relationships from another tree you own.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {STEPS.map((label, i) => (
            <span key={label} className="flex items-center gap-1">
              <span className={i === step ? "text-primary font-medium" : ""}>{label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>

        <div className="min-h-[160px]">
          {/* Step 0: Select source */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a tree to merge into this one. The source tree will be deleted after merging.
              </p>
              {ownedTrees.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  You have no other trees to merge from.
                </p>
              ) : (
                <Select value={sourceTreeId} onValueChange={setSourceTreeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source tree…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedTrees.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({t.member_count} members)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Step 1: Preview (skipped automatically if no conflicts) */}
          {step === 1 && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Checking for duplicate members…</p>
            </div>
          )}

          {/* Step 2: Resolve conflicts */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {conflicts.length} member{conflicts.length !== 1 ? "s" : ""} matched by name and date of birth.
                Choose how to handle each one.
              </p>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {conflicts.map((c) => (
                  <div key={c.sourceMemberId} className="rounded-lg border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{c.sourceDisplayName}</span>
                      {c.dateOfBirth && (
                        <Badge variant="outline" className="text-xs font-normal">
                          b. {c.dateOfBirth}
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={resolutions[c.sourceMemberId] ?? "merge"}
                      onValueChange={(v: ConflictResolution) =>
                        setResolutions((prev) => ({ ...prev, [c.sourceMemberId]: v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merge">Merge into &ldquo;{c.targetDisplayName}&rdquo;</SelectItem>
                        <SelectItem value="copy">Keep as separate member</SelectItem>
                        <SelectItem value="skip">Skip (don&apos;t copy)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  <strong>&ldquo;{sourceTree?.name}&rdquo;</strong> will be permanently deleted after merging.
                  This cannot be undone.
                </p>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground">Summary:</p>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    {(sourceTree?.member_count ?? 0) - skippedCount - mergedCount + copiedConflicts} members will be copied as new
                  </li>
                  {mergedCount > 0 && (
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-blue-500" />
                      {mergedCount} member{mergedCount !== 1 ? "s" : ""} merged into existing records
                    </li>
                  )}
                  {skippedCount > 0 && (
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      {skippedCount} member{skippedCount !== 1 ? "s" : ""} skipped
                    </li>
                  )}
                  <li className="flex items-center gap-1.5 text-muted-foreground">
                    Relationships will be remapped automatically
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex justify-between pt-2">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={merging}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === 0 && (
            <Button
              size="sm"
              onClick={handlePreview}
              disabled={!sourceTreeId || loading}
            >
              {loading ? "Checking…" : "Next"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 2 && (
            <Button size="sm" onClick={() => setStep(3)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 3 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleMerge}
              disabled={merging}
            >
              <GitMerge className="h-4 w-4 mr-1.5" />
              {merging ? "Merging…" : "Merge Trees"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
