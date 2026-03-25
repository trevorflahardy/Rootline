"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils/cn";
import { createMember } from "@/lib/actions/member";
import { createRelationship } from "@/lib/actions/relationship";
import { createMemberSchema, type CreateMemberInput } from "@/lib/validators/member";
import type { TreeMember, RelationshipType } from "@/types";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  existingMembers: TreeMember[];
  onMemberAdded: () => void;
  defaultRelatedMemberId?: string;
  defaultRelationshipDirection?: "parent" | "child" | "spouse";
}

export function AddMemberDialog({
  open,
  onOpenChange,
  treeId,
  existingMembers,
  onMemberAdded,
  defaultRelatedMemberId,
  defaultRelationshipDirection,
}: AddMemberDialogProps) {
  const [relatedMemberId, setRelatedMemberId] = useState<string>("");
  const [relationshipDirection, setRelationshipDirection] = useState<"parent" | "child" | "spouse">("child");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      tree_id: treeId,
      is_deceased: false,
    },
  });

  const isDeceased = watch("is_deceased");

  useEffect(() => {
    if (!open) return;
    setRelatedMemberId(defaultRelatedMemberId ?? "");
    setRelationshipDirection(defaultRelationshipDirection ?? "child");
    setMemberSearchOpen(false);
  }, [defaultRelatedMemberId, defaultRelationshipDirection, open]);

  async function onSubmit(data: CreateMemberInput) {
    try {
      const member = await createMember(data);

      // Create relationship if a related member was selected
      if (relatedMemberId) {
        const relType = relationshipDirection === "spouse" ? "spouse" as RelationshipType : "parent_child" as RelationshipType;
        const fromId = relationshipDirection === "child" ? relatedMemberId : member.id;
        const toId = relationshipDirection === "child" ? member.id : relatedMemberId;

        await createRelationship({
          tree_id: treeId,
          from_member_id: relationshipDirection === "spouse" ? member.id : fromId,
          to_member_id: relationshipDirection === "spouse" ? relatedMemberId : toId,
          relationship_type: relType,
        });
      }

      toast.success(`${data.first_name} added to the tree`);
      onOpenChange(false);
      reset({ tree_id: treeId, is_deceased: false });
      setRelatedMemberId("");
      onMemberAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add member");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto glass-card glass-elevated glass-edge-top glass-edge-left border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] backdrop-blur-[var(--glass-blur-heavy)] [&_input]:bg-white/10 [&_input]:dark:bg-white/5 [&_input]:border-[var(--glass-border-subtle)] [&_textarea]:bg-white/10 [&_textarea]:dark:bg-white/5 [&_textarea]:border-[var(--glass-border-subtle)] [&_input:focus]:ring-2 [&_input:focus]:ring-primary [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-primary">
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
          <DialogDescription>
            Add a new person to the family tree.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("tree_id")} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maiden_name">Maiden Name</Label>
              <Input id="maiden_name" {...register("maiden_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select onValueChange={(v) => setValue("gender", v as CreateMemberInput["gender"])}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Custom</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_of_death">Date of Death</Label>
              <Input id="date_of_death" type="date" {...register("date_of_death")} disabled={!isDeceased} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_deceased"
              checked={isDeceased}
              onCheckedChange={(v) => setValue("is_deceased", v === true)}
            />
            <Label htmlFor="is_deceased" className="text-sm font-normal">Deceased</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="birth_place">Birth Place</Label>
              <Input id="birth_place" {...register("birth_place")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="death_place">Death Place</Label>
              <Input id="death_place" {...register("death_place")} disabled={!isDeceased} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={2} {...register("bio")} placeholder="A short biography..." />
          </div>

          {/* Relationship to existing member */}
          {existingMembers.length > 0 && (
            <>
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold">Connect to existing member (optional)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Related to</Label>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={memberSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {relatedMemberId ? (
                            <span className="flex items-center gap-2 truncate">
                              <MemberAvatar member={existingMembers.find((m) => m.id === relatedMemberId)!} size="sm" />
                              {existingMembers.find((m) => m.id === relatedMemberId)?.first_name}{" "}
                              {existingMembers.find((m) => m.id === relatedMemberId)?.last_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Search members...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name..." />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              {existingMembers.map((m) => (
                                <CommandItem
                                  key={m.id}
                                  value={`${m.first_name} ${m.last_name ?? ""}`}
                                  onSelect={() => {
                                    setRelatedMemberId(m.id === relatedMemberId ? "" : m.id);
                                    setMemberSearchOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <MemberAvatar member={m} size="sm" />
                                    <span className="truncate">{m.first_name} {m.last_name}</span>
                                  </div>
                                  <Check className={cn("ml-auto h-4 w-4", relatedMemberId === m.id ? "opacity-100" : "opacity-0")} />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Relationship</Label>
                    <Select
                      value={relationshipDirection}
                      onValueChange={(v) => setRelationshipDirection(v as "parent" | "child" | "spouse")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="child">Is their child</SelectItem>
                        <SelectItem value="parent">Is their parent</SelectItem>
                        <SelectItem value="spouse">Is their spouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberAvatar({ member, size = "sm" }: { member: TreeMember; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  const iconPx = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  if (member.avatar_url) {
    const dim = size === "sm" ? 20 : 32;
    return (
      <Image
        src={member.avatar_url}
        alt={member.first_name}
        className={`${px} rounded-full object-cover flex-shrink-0`}
        width={dim}
        height={dim}
      />
    );
  }

  return (
    <div className={`${px} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <User className={`${iconPx} text-primary`} />
    </div>
  );
}
