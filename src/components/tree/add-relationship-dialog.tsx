"use client";

import { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils/cn";
import { createRelationship } from "@/lib/actions/relationship";
import type { TreeMember, RelationshipType } from "@/types";

const addRelationshipSchema = z.object({
  from_member_id: z.string().min(1, "Select the first member"),
  to_member_id: z.string().min(1, "Select the second member"),
  relationship_type: z.string().min(1, "Select a relationship type"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

type AddRelationshipInput = z.infer<typeof addRelationshipSchema>;

interface AddRelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  members: TreeMember[];
  onRelationshipAdded: () => void;
}

export function AddRelationshipDialog({
  open,
  onOpenChange,
  treeId,
  members,
  onRelationshipAdded,
}: AddRelationshipDialogProps) {
  const [fromSearchOpen, setFromSearchOpen] = useState(false);
  const [toSearchOpen, setToSearchOpen] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddRelationshipInput>({
    resolver: zodResolver(addRelationshipSchema),
    defaultValues: {
      from_member_id: "",
      to_member_id: "",
      relationship_type: "",
      start_date: "",
      end_date: "",
    },
  });

  const fromMemberId = watch("from_member_id");
  const toMemberId = watch("to_member_id");
  const fromMember = members.find((m) => m.id === fromMemberId);
  const toMember = members.find((m) => m.id === toMemberId);

  async function onSubmit(data: AddRelationshipInput) {
    if (data.from_member_id === data.to_member_id) {
      toast.error("Cannot create a relationship between a member and themselves");
      return;
    }

    try {
      await createRelationship({
        tree_id: treeId,
        from_member_id: data.from_member_id,
        to_member_id: data.to_member_id,
        relationship_type: data.relationship_type as RelationshipType,
        start_date: data.start_date || undefined,
        end_date: data.end_date || undefined,
      });

      toast.success("Relationship created");
      onOpenChange(false);
      reset();
      onRelationshipAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create relationship");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Members</DialogTitle>
          <DialogDescription>
            Create a relationship between two existing members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From member</Label>
              <MemberCombobox
                members={members}
                selectedId={fromMemberId}
                open={fromSearchOpen}
                onOpenChange={setFromSearchOpen}
                onSelect={(id) => setValue("from_member_id", id, { shouldValidate: true })}
                selectedMember={fromMember}
              />
              {errors.from_member_id && <p className="text-xs text-destructive">{errors.from_member_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To member</Label>
              <MemberCombobox
                members={members}
                selectedId={toMemberId}
                open={toSearchOpen}
                onOpenChange={setToSearchOpen}
                onSelect={(id) => setValue("to_member_id", id, { shouldValidate: true })}
                selectedMember={toMember}
              />
              {errors.to_member_id && <p className="text-xs text-destructive">{errors.to_member_id.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Relationship type</Label>
            <Select onValueChange={(v) => setValue("relationship_type", v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Hierarchical</SelectLabel>
                  <SelectItem value="parent_child">Parent / Child</SelectItem>
                  <SelectItem value="adopted">Adopted</SelectItem>
                  <SelectItem value="step_parent">Step-Parent / Step-Child</SelectItem>
                  <SelectItem value="step_child">Step-Child / Step-Parent</SelectItem>
                  <SelectItem value="guardian">Guardian / Ward</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Horizontal</SelectLabel>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="in_law">In-Law</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.relationship_type && <p className="text-xs text-destructive">{errors.relationship_type.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rel_start_date">Start date (optional)</Label>
              <Input id="rel_start_date" type="date" onChange={(e) => setValue("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel_end_date">End date (optional)</Label>
              <Input id="rel_end_date" type="date" onChange={(e) => setValue("end_date", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Relationship"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberCombobox({
  members,
  selectedId,
  open,
  onOpenChange,
  onSelect,
  selectedMember,
}: {
  members: TreeMember[];
  selectedId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  selectedMember?: TreeMember;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedMember ? (
            <span className="flex items-center gap-2 truncate">
              <MemberAvatar member={selectedMember} />
              {selectedMember.first_name} {selectedMember.last_name}
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
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.first_name} ${m.last_name ?? ""}`}
                  onSelect={() => {
                    onSelect(m.id === selectedId ? "" : m.id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <MemberAvatar member={m} />
                    <span className="truncate">{m.first_name} {m.last_name}</span>
                  </div>
                  <Check className={cn("ml-auto h-4 w-4", selectedId === m.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MemberAvatar({ member }: { member: TreeMember }) {
  if (member.avatar_url) {
    return (
      <Image
        src={member.avatar_url}
        alt={member.first_name}
        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
        width={20}
        height={20}
      />
    );
  }

  return (
    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <User className="h-3 w-3 text-primary" />
    </div>
  );
}
