import { Suspense } from "react";
import { Plus, TreePine } from "lucide-react";
import { getTreesForUser } from "@/lib/actions/tree";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TreeCard } from "@/components/dashboard/tree-card";
import { CreateTreeDialog } from "@/components/dashboard/create-tree-dialog";

export const metadata = {
  title: "Dashboard",
};

async function TreeGrid() {
  const trees = await getTreesForUser();

  if (trees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <TreePine className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No family trees yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create your first family tree to start mapping your lineage.
        </p>
        <CreateTreeDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Tree
          </Button>
        </CreateTreeDialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trees.map((tree) => (
        <TreeCard key={tree.id} tree={tree} />
      ))}
    </div>
  );
}

function TreeGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Family Trees</h1>
          <p className="text-muted-foreground">
            Manage and explore your family lineages
          </p>
        </div>
        <CreateTreeDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Tree
          </Button>
        </CreateTreeDialog>
      </div>

      <Suspense fallback={<TreeGridSkeleton />}>
        <TreeGrid />
      </Suspense>
    </div>
  );
}
