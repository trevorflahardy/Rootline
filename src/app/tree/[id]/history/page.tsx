import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTreeById } from "@/lib/actions/tree";
import { getAuditLog, getSnapshots } from "@/lib/actions/audit";
import { HistoryClient } from "@/components/history/history-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tree = await getTreeById(id);
  return { title: tree ? `History - ${tree.name}` : "History" };
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  const tree = await getTreeById(id);

  if (!tree) notFound();

  const [auditResult, snapshots] = await Promise.all([
    getAuditLog(id, { page: 1, pageSize: 50 }),
    getSnapshots(id),
  ]);

  const isOwner = tree.owner_id === userId;

  return (
    <HistoryClient
      treeId={id}
      treeName={tree.name}
      isOwner={isOwner}
      canEdit={isOwner}
      initialEntries={auditResult.entries}
      initialTotal={auditResult.total}
      initialSnapshots={snapshots}
    />
  );
}
