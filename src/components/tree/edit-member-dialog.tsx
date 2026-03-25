"use client";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { updateMember } from "@/lib/actions/member";
import { updateMemberSchema, type UpdateMemberInput } from "@/lib/validators/member";
import type { TreeMember } from "@/types";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TreeMember;
  treeId: string;
  onUpdated: () => void;
}

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
  treeId,
  onUpdated,
}: EditMemberDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdateMemberInput>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      first_name: member.first_name,
      last_name: member.last_name ?? "",
      maiden_name: member.maiden_name ?? "",
      gender: member.gender ?? undefined,
      date_of_birth: member.date_of_birth ?? "",
      date_of_death: member.date_of_death ?? "",
      birth_place: member.birth_place ?? "",
      death_place: member.death_place ?? "",
      bio: member.bio ?? "",
      is_deceased: member.is_deceased,
    },
  });

  const isDeceased = watch("is_deceased");

  async function onSubmit(data: UpdateMemberInput) {
    try {
      await updateMember(member.id, treeId, data);
      toast.success("Member updated");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto glass-card glass-elevated glass-edge-top glass-edge-left border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] backdrop-blur-[var(--glass-blur-heavy)] [&_input]:bg-white/10 [&_input]:dark:bg-white/5 [&_input]:border-[var(--glass-border-subtle)] [&_textarea]:bg-white/10 [&_textarea]:dark:bg-white/5 [&_textarea]:border-[var(--glass-border-subtle)] [&_input:focus]:ring-2 [&_input:focus]:ring-primary [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-primary">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update {member.first_name}&apos;s information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_first_name">First Name *</Label>
              <Input id="edit_first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_last_name">Last Name</Label>
              <Input id="edit_last_name" {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_maiden_name">Maiden Name</Label>
              <Input id="edit_maiden_name" {...register("maiden_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select
                defaultValue={member.gender ?? undefined}
                onValueChange={(v) => setValue("gender", v as UpdateMemberInput["gender"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
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
              <Label htmlFor="edit_dob">Date of Birth</Label>
              <Input id="edit_dob" type="date" {...register("date_of_birth")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_dod">Date of Death</Label>
              <Input
                id="edit_dod"
                type="date"
                {...register("date_of_death")}
                disabled={!isDeceased}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="edit_is_deceased"
              checked={isDeceased}
              onCheckedChange={(v) => setValue("is_deceased", v === true)}
            />
            <Label htmlFor="edit_is_deceased" className="text-sm font-normal">
              Deceased
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_birth_place">Birth Place</Label>
              <Input id="edit_birth_place" {...register("birth_place")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_death_place">Death Place</Label>
              <Input
                id="edit_death_place"
                {...register("death_place")}
                disabled={!isDeceased}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit_bio">Bio</Label>
            <Textarea
              id="edit_bio"
              rows={2}
              {...register("bio")}
              placeholder="A short biography..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
