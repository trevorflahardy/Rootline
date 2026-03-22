"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTreeDialog } from "./create-tree-dialog";

interface DashboardHeaderProps {
  emptyState?: boolean;
}

export function DashboardHeader({ emptyState }: DashboardHeaderProps) {
  const [showCreate, setShowCreate] = useState(false);

  if (emptyState) {
    return (
      <>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Tree
        </Button>
        <CreateTreeDialog open={showCreate} onOpenChange={setShowCreate} />
      </>
    );
  }

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold">My Family Trees</h1>
        <p className="text-muted-foreground">
          Manage and explore your family lineages
        </p>
      </div>
      <Button onClick={() => setShowCreate(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Tree
      </Button>
      <CreateTreeDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
