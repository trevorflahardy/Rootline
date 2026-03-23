"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuditLogEntry } from "@/lib/actions/audit";

function formatAction(action: string): string {
  switch (action) {
    case "INSERT":
      return "Created";
    case "UPDATE":
      return "Updated";
    case "DELETE":
      return "Deleted";
    default:
      return action;
  }
}

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  switch (action) {
    case "INSERT":
      return "default";
    case "DELETE":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatEntityType(entityType: string): string {
  switch (entityType) {
    case "tree_members":
      return "Member";
    case "relationships":
      return "Relationship";
    case "family_trees":
      return "Tree";
    default:
      return entityType;
  }
}

function getEntityName(entry: AuditLogEntry): string {
  const data = entry.new_data ?? entry.old_data;
  if (!data) return "Unknown";

  if (data.first_name) {
    const parts = [data.first_name as string];
    if (data.last_name) parts.push(data.last_name as string);
    return parts.join(" ");
  }

  if (data.relationship_type) {
    return String(data.relationship_type).replace("_", " ");
  }

  if (data.name) {
    return String(data.name);
  }

  return entry.entity_id?.slice(0, 8) ?? "Unknown";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getChangedFields(entry: AuditLogEntry): string[] {
  if (entry.action !== "UPDATE" || !entry.old_data || !entry.new_data)
    return [];

  const changed: string[] = [];
  for (const key of Object.keys(entry.new_data)) {
    if (
      key === "updated_at" ||
      key === "created_at" ||
      key === "id" ||
      key === "tree_id"
    )
      continue;
    if (
      JSON.stringify(entry.old_data[key]) !==
      JSON.stringify(entry.new_data[key])
    ) {
      changed.push(key.replace(/_/g, " "));
    }
  }
  return changed;
}

interface AuditTimelineProps {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function AuditTimeline({
  entries,
  total,
  page,
  pageSize,
  onPageChange,
}: AuditTimelineProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No changes recorded yet.</p>
        <p className="text-sm mt-1">
          Changes to members and relationships will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

        <div className="space-y-3">
          {entries.map((entry) => {
            const changedFields = getChangedFields(entry);
            return (
              <div key={entry.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-[11px] top-4 size-[10px] rounded-full border-2 border-background bg-muted-foreground" />

                <Card className="glass-card glass-light glass-edge-top border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={actionVariant(entry.action)}>
                            {formatAction(entry.action)}
                          </Badge>
                          <Badge variant="outline">
                            {formatEntityType(entry.entity_type)}
                          </Badge>
                          <span className="text-sm font-medium">
                            {getEntityName(entry)}
                          </span>
                        </div>
                        {changedFields.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Changed: {changedFields.join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}&ndash;
            {Math.min(page * pageSize, total)} of {total} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
