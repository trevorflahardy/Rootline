"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Settings, Users, UserPlus, Menu, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TreeHealthBar } from "./tree-health-bar";
import { cn } from "@/lib/utils/cn";

interface TreeSidebarProps {
  treeId: string;
}

const getNavItems = (treeId: string) => [
  { href: `/tree/${treeId}`, label: "Tree View", icon: Users },
  { href: `/tree/${treeId}/timeline`, label: "Timeline", icon: Clock },
  { href: `/tree/${treeId}/history`, label: "History", icon: History },
  { href: `/tree/${treeId}/settings`, label: "Settings", icon: Settings },
  { href: `/tree/${treeId}/members`, label: "Members", icon: Users },
];

export function TreeSidebar({ treeId }: TreeSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = getNavItems(treeId);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Tree Health */}
      <div className="p-4">
        <TreeHealthBar treeId={treeId} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Add Relative CTA */}
      <div className="p-4">
        <Link href={`/tree/${treeId}/add`} onClick={() => setMobileOpen(false)}>
          <Button className="w-full" size="default">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Relative
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-16 left-3 z-50 glass-card"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-[280px] glass-card glass-heavy glass-edge-left !rounded-none transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex justify-end p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-[280px] shrink-0 glass-card glass-heavy glass-edge-left !rounded-none h-[calc(100vh-3.5rem)] sticky top-14">
        {sidebarContent}
      </aside>
    </>
  );
}
