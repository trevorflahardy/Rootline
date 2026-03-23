import { TreePine } from "lucide-react";

export function Footer() {
  return (
    <footer className="glass-card glass-light !rounded-none !border-b-0 !border-x-0">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-6 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TreePine className="h-4 w-4" />
          <span>&copy; {new Date().getFullYear()} Rootline. All rights reserved.</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
