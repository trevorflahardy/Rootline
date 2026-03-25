import { notFound } from "next/navigation";
import Link from "next/link";
import { TreeCanvas } from "@/components/tree/tree-canvas";
import {
  getPublicTree,
  getPublicMembers,
  getPublicRelationships,
  type PublicRelationship,
} from "@/lib/actions/share";
import type { Relationship } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const tree = await getPublicTree(treeId);
  return { title: tree ? `${tree.name} — Rootline` : "Family Tree" };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const tree = await getPublicTree(treeId);

  if (!tree) notFound();

  const [members, publicRelationships] = await Promise.all([
    getPublicMembers(treeId),
    getPublicRelationships(treeId),
  ]);

  // Coerce PublicRelationship to Relationship for TreeCanvas — missing fields default to null
  const relationships: Relationship[] = (
    publicRelationships as PublicRelationship[]
  ).map((r) => ({
    ...r,
    relationship_type: r.relationship_type as Relationship["relationship_type"],
    start_date: null,
    end_date: null,
    created_at: "",
  }));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur-sm">
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
          <Link
            href="/sign-up"
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign up to collaborate
          </Link>
        </div>
      </div>

      {/* Tree canvas read-only */}
      <div className="flex-1 relative bg-muted/20">
        {members.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            This tree has no members yet.
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-4rem)]">
            <TreeCanvas
              tree={tree}
              members={members}
              relationships={relationships}
              descendantHighlightDepth={1}
              canEdit={false}
              currentUserId=""
              currentUserName={null}
              currentUserAvatarUrl={null}
              nodeProfileMap={{}}
              permissions={{
                canEdit: false,
                isOwner: false,
                role: "viewer",
                linkedNodeId: null,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t px-4 py-3 text-center bg-background/95 backdrop-blur-sm">
        <p className="text-sm text-muted-foreground">
          Viewing a shared family tree on{" "}
          <Link href="/" className="text-primary hover:underline">
            Rootline
          </Link>
          .{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Create your own free family tree &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
