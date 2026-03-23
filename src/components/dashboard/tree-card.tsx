import Link from "next/link";
import { TreePine, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TreeSummary } from "@/types";
import { formatRelativeTime } from "@/lib/utils/date";

interface TreeCardProps {
  tree: TreeSummary;
}

export function TreeCard({ tree }: TreeCardProps) {
  const roleBadgeVariant = tree.role === "owner" ? "default" : tree.role === "editor" ? "secondary" : "outline";

  return (
    <Link href={`/tree/${tree.id}`}>
      <Card className="h-full glass-card glass-edge-top cursor-pointer hover:scale-[1.02] hover:glass-elevated transition-all duration-300 !border-border/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-foreground">{tree.name}</CardTitle>
            </div>
            <Badge variant={roleBadgeVariant} className="capitalize text-xs">
              {tree.role}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {tree.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {tree.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{tree.member_count} member{tree.member_count !== 1 ? "s" : ""}</span>
            </div>
            <span>Updated {formatRelativeTime(tree.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
