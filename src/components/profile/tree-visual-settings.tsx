"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfilePreferences } from "@/lib/actions/profile";

interface TreeVisualSettingsProps {
  initialDescendantHighlightDepth: number;
}

const DEPTH_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

export function TreeVisualSettings({ initialDescendantHighlightDepth }: TreeVisualSettingsProps) {
  const [depth, setDepth] = useState(initialDescendantHighlightDepth);
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;

    const nextDepth = Math.min(10, Math.max(0, parsed));
    const previousDepth = depth;
    setDepth(nextDepth);
    setSaving(true);

    try {
      await updateProfilePreferences({ descendant_highlight_depth: nextDepth });
      toast.success("Visualization setting saved");
    } catch (error) {
      setDepth(previousDepth);
      toast.error(error instanceof Error ? error.message : "Failed to save setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tree Visualization</CardTitle>
        <CardDescription>
          Choose how many descendant generations are highlighted when you select a person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="descendant-highlight-depth">Descendant highlight depth</Label>
        <Select
          value={String(depth)}
          onValueChange={handleChange}
          disabled={saving}
        >
          <SelectTrigger id="descendant-highlight-depth" className="w-full max-w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPTH_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option === 0 ? "0 (off)" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
