import { Header } from "@/components/layout/header";
import { TreeSidebar } from "@/components/tree/tree-sidebar";

export default async function TreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header />
      <div className="flex flex-1">
        <TreeSidebar treeId={id} />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </>
  );
}
