import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-16 w-16 text-white/20 mb-4" />
      <h2 className="text-xl font-semibold mb-2 text-white">{title}</h2>
      <p className="text-white/50 mb-6 max-w-md">{description}</p>
      {action}
    </div>
  );
}
