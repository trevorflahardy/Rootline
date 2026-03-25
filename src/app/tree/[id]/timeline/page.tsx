import { notFound } from "next/navigation";
import { getTreeById } from "@/lib/actions/tree";
import { getTimelineEvents } from "@/lib/actions/timeline";
import { TimelineView } from "@/components/tree/timeline-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree ? `Timeline — ${tree.name}` : "Timeline" };
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tree, events] = await Promise.all([
    getTreeById(id),
    getTimelineEvents(id),
  ]);

  if (!tree) notFound();

  return (
    <div className="flex-1 p-6">
      <TimelineView events={events} treeId={id} treeName={tree.name} />
    </div>
  );
}
