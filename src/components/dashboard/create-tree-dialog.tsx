"use client";

import { useRouter } from "next/navigation";
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
import { createTree } from "@/lib/actions/tree";
import { createTreeSchema, type CreateTreeInput } from "@/lib/validators/tree";

interface CreateTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTreeDialog({ open, onOpenChange }: CreateTreeDialogProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTreeInput>({
    resolver: zodResolver(createTreeSchema),
  });

  async function onSubmit(data: CreateTreeInput) {
    try {
      const tree = await createTree(data);
      toast.success("Family tree created!");
      onOpenChange(false);
      reset();
      router.push(`/tree/${tree.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create tree");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card glass-elevated glass-edge-top glass-edge-left border-white/10">
        <DialogHeader>
          <DialogTitle>Create Family Tree</DialogTitle>
          <DialogDescription>
            Start a new family tree. You can invite family members later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tree Name</Label>
            <Input
              id="name"
              placeholder="e.g. The Johnson Family"
              className="bg-white/5 border-white/10 focus:ring-primary"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="A brief description of this family tree..."
              className="bg-white/5 border-white/10 focus:ring-primary"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Tree"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
