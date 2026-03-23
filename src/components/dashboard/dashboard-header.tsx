"use client";

import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTreeDialog } from "./create-tree-dialog";
import { JoinTreeDialog } from "./join-tree-dialog";

interface DashboardHeaderProps {
  emptyState?: boolean;
}

export function DashboardHeader({ emptyState }: DashboardHeaderProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (emptyState) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Tree
        </Button>
        <Button variant="outline" onClick={() => setShowJoin(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Join with Invite Code
        </Button>
        <CreateTreeDialog open={showCreate} onOpenChange={setShowCreate} />
        <JoinTreeDialog open={showJoin} onOpenChange={setShowJoin} />
      </div>
    );
  }

  return (
    <div className="glass-card glass-light glass-edge-top rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Family Trees</h1>
          <p className="text-muted-foreground">
            Manage and explore your family lineages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowJoin(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Join Tree
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Tree
          </Button>
        </div>
      </div>
      <CreateTreeDialog open={showCreate} onOpenChange={setShowCreate} />
      <JoinTreeDialog open={showJoin} onOpenChange={setShowJoin} />
    </div>
  );
}
