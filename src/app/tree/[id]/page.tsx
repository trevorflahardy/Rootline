import { notFound } from "next/navigation";
import { getTreeById } from "@/lib/actions/tree";
import { getMembersByTreeId } from "@/lib/actions/member";
import { getRelationshipsByTreeId } from "@/lib/actions/relationship";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree?.name ?? "Family Tree" };
}

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getTreeById(id);

  if (!tree) notFound();

  const [members, relationships] = await Promise.all([
    getMembersByTreeId(id),
    getRelationshipsByTreeId(id),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">{tree.name}</h1>
          {tree.description && (
            <p className="text-sm text-muted-foreground">{tree.description}</p>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex-1 relative bg-muted/20">
        {members.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[60vh] text-center">
            <div>
              <p className="text-muted-foreground mb-2">This tree is empty.</p>
              <p className="text-sm text-muted-foreground">
                Tree visualization will appear here once members are added.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-8rem)]">
            {/* TreeCanvas component will be added in Phase 2 */}
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Tree visualization loading... ({members.length} members, {relationships.length} relationships)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
