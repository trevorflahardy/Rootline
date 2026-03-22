import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTreeById } from "@/lib/actions/tree";
import { getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";
import Link from "next/link";
import { TreeCanvas } from "@/components/tree/tree-canvas";
import { EmptyTreeState } from "@/components/tree/empty-tree-state";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree?.name ?? "Family Tree" };
}

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const tree = await getTreeById(id);

  if (!tree) notFound();

  const [members, relationships] = await Promise.all([
    getMembersByTreeId(id),
    getRelationshipsByTreeId(id),
  ]);

  // TODO: Check actual membership role for canEdit
  const canEdit = tree.owner_id === userId;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">{tree.name}</h1>
          {tree.description && (
            <p className="text-sm text-muted-foreground">{tree.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </span>
          {canEdit && (
            <Link
              href={`/tree/${id}/settings`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 relative bg-muted/20">
        {members.length === 0 ? (
          <EmptyTreeState treeId={id} canEdit={canEdit} />
        ) : (
          <div className="w-full h-[calc(100vh-8rem)]">
            <TreeCanvas
              tree={tree}
              members={members}
              relationships={relationships}
              canEdit={canEdit}
              currentUserId={userId ?? ""}
            />
          </div>
        )}
      </div>
    </div>
  );
}
