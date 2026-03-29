"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldLockInfo = {
  userId: string;
  name: string;
  color: string;
  avatarUrl: string | null;
};

export function InlineField({
  label,
  value,
  field,
  memberId,
  currentUserId,
  type = "text",
  canEdit,
  lock,
  onEditStart,
  onEditEnd,
  onSave,
}: {
  label: string;
  value: string | null;
  field: string;
  memberId: string;
  currentUserId: string;
  type?: "text" | "date" | "textarea";
  canEdit: boolean;
  lock?: FieldLockInfo;
  onEditStart?: (memberId: string, field: string) => void;
  onEditEnd?: (memberId: string, field: string) => void;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [, setSaving] = useState(false);
  const lockIsHeldByOther = Boolean(lock && lock.userId !== currentUserId);

  useEffect(() => {
    setEditValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (lockIsHeldByOther && editing) {
      setEditing(false);
    }
  }, [editing, lockIsHeldByOther]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editValue !== (value ?? "")) {
        await onSave(field, editValue);
      }
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
      onEditEnd?.(memberId, field);
    }
  }, [editValue, field, memberId, onEditEnd, onSave, value]);

  const handleCancel = () => {
    setEditValue(value ?? "");
    setEditing(false);
    onEditEnd?.(memberId, field);
  };

  useEffect(() => {
    return () => {
      if (editing) onEditEnd?.(memberId, field);
    };
  }, [editing, field, memberId, onEditEnd]);

  if (editing) {
    return (
      <div
        className="space-y-1 rounded-md px-2 py-1"
        style={{ border: lock ? `1px solid ${lock.color}` : undefined }}
      >
        <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {label}
        </p>
        {lock && (
          <p className="text-[10px]" style={{ color: lock.color }}>
            Editing: {lock.name}
          </p>
        )}
        <div className="flex items-center gap-1">
          {type === "textarea" ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[60px] text-sm"
              autoFocus
              onFocus={() => onEditStart?.(memberId, field)}
              onBlur={() => {
                void handleSave();
              }}
            />
          ) : (
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onFocus={() => onEditStart?.(memberId, field)}
              onBlur={() => {
                void handleSave();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") handleCancel();
              }}
            />
          )}
        </div>
        <p className="text-muted-foreground text-[10px]">Auto-saves on blur</p>
      </div>
    );
  }

  const displayValue = value || "—";
  const isEmpty = !value;

  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p
        className={`text-sm ${isEmpty ? "text-muted-foreground/50 italic" : ""} ${canEdit && !lockIsHeldByOther ? "hover:bg-accent/50 -mx-1 cursor-pointer rounded px-1 py-0.5 transition-colors" : ""}`}
        onClick={
          canEdit && !lockIsHeldByOther
            ? () => {
                setEditValue(value ?? "");
                setEditing(true);
                onEditStart?.(memberId, field);
              }
            : undefined
        }
        title={
          lockIsHeldByOther ? `Locked by ${lock?.name}` : canEdit ? "Click to edit" : undefined
        }
        style={lock ? { borderLeft: `2px solid ${lock.color}`, paddingLeft: 6 } : undefined}
      >
        {displayValue}
      </p>
      {lockIsHeldByOther && lock && (
        <p className="text-[10px]" style={{ color: lock.color }}>
          {lock.name} is editing this field
        </p>
      )}
    </div>
  );
}

export function InlineSelectField({
  label,
  value,
  field,
  memberId,
  currentUserId,
  options,
  canEdit,
  lock,
  onEditStart,
  onEditEnd,
  onSave,
}: {
  label: string;
  value: string | null;
  field: string;
  memberId: string;
  currentUserId: string;
  options: { value: string; label: string }[];
  canEdit: boolean;
  lock?: FieldLockInfo;
  onEditStart?: (memberId: string, field: string) => void;
  onEditEnd?: (memberId: string, field: string) => void;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lockIsHeldByOther = Boolean(lock && lock.userId !== currentUserId);

  const handleChange = async (newValue: string) => {
    setSaving(true);
    try {
      await onSave(field, newValue);
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
      onEditEnd?.(memberId, field);
    }
  };

  useEffect(() => {
    if (lockIsHeldByOther && editing) {
      setEditing(false);
    }
  }, [editing, lockIsHeldByOther]);

  const displayLabel = options.find((o) => o.value === value)?.label ?? "—";
  const isEmpty = !value;

  if (editing) {
    return (
      <div
        className="space-y-1 rounded-md px-2 py-1"
        style={{ border: lock ? `1px solid ${lock.color}` : undefined }}
      >
        <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {label}
        </p>
        {lock && (
          <p className="text-[10px]" style={{ color: lock.color }}>
            Editing: {lock.name}
          </p>
        )}
        <div className="flex items-center gap-1">
          <Select
            defaultValue={value ?? undefined}
            onValueChange={handleChange}
            disabled={saving || lockIsHeldByOther}
          >
            <SelectTrigger className="h-7 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => {
              setEditing(false);
              onEditEnd?.(memberId, field);
            }}
          >
            <XIcon className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p
        className={`text-sm ${isEmpty ? "text-muted-foreground/50 italic" : ""} ${canEdit && !lockIsHeldByOther ? "hover:bg-accent/50 -mx-1 cursor-pointer rounded px-1 py-0.5 transition-colors" : ""}`}
        onClick={
          canEdit && !lockIsHeldByOther
            ? () => {
                setEditing(true);
                onEditStart?.(memberId, field);
              }
            : undefined
        }
        title={
          lockIsHeldByOther ? `Locked by ${lock?.name}` : canEdit ? "Click to edit" : undefined
        }
        style={lock ? { borderLeft: `2px solid ${lock.color}`, paddingLeft: 6 } : undefined}
      >
        {displayLabel}
      </p>
      {lockIsHeldByOther && lock && (
        <p className="text-[10px]" style={{ color: lock.color }}>
          {lock.name} is editing this field
        </p>
      )}
    </div>
  );
}
