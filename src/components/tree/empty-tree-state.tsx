"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TreePine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddMemberDialog } from "./add-member-dialog";

interface EmptyTreeStateProps {
  treeId: string;
  canEdit: boolean;
}

export function EmptyTreeState({ treeId, canEdit }: EmptyTreeStateProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh] text-center">
      <div className="glass-card glass-edge-top rounded-2xl max-w-sm space-y-4 p-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <TreePine className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-medium text-lg text-foreground">Your tree is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add the first family member to start building your tree.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Member
          </Button>
        )}
        <AddMemberDialog
          open={showAdd}
          onOpenChange={setShowAdd}
          treeId={treeId}
          existingMembers={[]}
          onMemberAdded={() => router.refresh()}
        />
      </div>
    </div>
  );
}
