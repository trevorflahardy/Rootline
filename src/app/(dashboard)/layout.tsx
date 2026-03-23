import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">{children}</main>
    </>
  );
}
