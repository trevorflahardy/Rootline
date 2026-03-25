"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuditLogEntry } from "@/lib/actions/audit";

function formatAction(action: string): string {
  switch (action) {
    case "INSERT":
    case "create":
      return "Created";
    case "UPDATE":
    case "update":
      return "Updated";
    case "DELETE":
    case "delete":
      return "Deleted";
    default:
      return action;
  }
}

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  switch (action) {
    case "INSERT":
    case "create":
      return "default";
    case "DELETE":
    case "delete":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatEntityType(entityType: string): string {
  switch (entityType) {
    case "tree_members":
    case "tree_member":
      return "Member";
    case "relationships":
    case "relationship":
      return "Connection";
    case "family_trees":
    case "family_tree":
      return "Tree Settings";
    case "tree_memberships":
    case "tree_membership":
      return "Permissions";
    case "invitations":
    case "invitation":
      return "Invite";
    case "documents":
    case "document":
      return "Document";
    case "media":
    case "photo":
      return "Photo";
    default:
      return entityType;
  }
}

function getEntityName(entry: AuditLogEntry): string {
  if (entry.subject_member) return entry.subject_member.name;
  if (entry.subject_profile) return entry.subject_profile.display_name;
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

const IGNORED_AUDIT_FIELDS = new Set([
  "id",
  "tree_id",
  "created_at",
  "updated_at",
  "joined_at",
  "created_by",
  "uploaded_by",
]);

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  maiden_name: "Maiden name",
  gender: "Gender",
  date_of_birth: "Birth date",
  date_of_death: "Death date",
  birth_year: "Birth year",
  birth_month: "Birth month",
  birth_day: "Birth day",
  death_year: "Death year",
  death_month: "Death month",
  death_day: "Death day",
  birth_place: "Birth place",
  death_place: "Death place",
  bio: "Bio",
  is_deceased: "Deceased",
  relationship_type: "Connection type",
  from_member_id: "From member",
  to_member_id: "To member",
  name: "Name",
  description: "Description",
  is_public: "Public visibility",
  role: "Role",
  linked_node_id: "Linked member",
  user_id: "User",
  target_node_id: "Target member",
  email: "Invite email",
  max_uses: "Max uses",
  use_count: "Use count",
  expires_at: "Invite expiry",
  is_private: "Private",
  file_name: "File name",
  document_type: "Document type",
  caption: "Caption",
};

type AuditFieldChange = {
  field: string;
  from: string;
  to: string;
};

function formatFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.replace(/_/g, " ");
  return JSON.stringify(value);
}

function getComparableKeys(entry: AuditLogEntry): string[] {
  const oldData = entry.old_data ?? {};
  const newData = entry.new_data ?? {};
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return Array.from(keys).filter((key) => !IGNORED_AUDIT_FIELDS.has(key));
}

function getDetailedFieldChanges(entry: AuditLogEntry): AuditFieldChange[] {
  const keys = getComparableKeys(entry);
  const oldData = entry.old_data ?? {};
  const newData = entry.new_data ?? {};

  if (entry.action === "update" || entry.action === "UPDATE") {
    return keys
      .filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))
      .map((key) => ({
        field: formatFieldLabel(key),
        from: formatAuditValue(oldData[key]),
        to: formatAuditValue(newData[key]),
      }));
  }

  if (entry.action === "create" || entry.action === "INSERT") {
    return keys
      .filter((key) => newData[key] !== null && newData[key] !== undefined && newData[key] !== "")
      .map((key) => ({
        field: formatFieldLabel(key),
        from: "empty",
        to: formatAuditValue(newData[key]),
      }));
  }

  if (entry.action === "delete" || entry.action === "DELETE") {
    return keys
      .filter((key) => oldData[key] !== null && oldData[key] !== undefined && oldData[key] !== "")
      .map((key) => ({
        field: formatFieldLabel(key),
        from: formatAuditValue(oldData[key]),
        to: "removed",
      }));
  }

  return [];
}

function PersonPill({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full glass-card glass-light px-2.5 py-1 text-[11px] font-medium">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={16}
          height={16}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center text-[9px] text-primary">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate max-w-[160px]">{name}</span>
    </span>
  );
}

function getFieldValue(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const value = data[key];
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
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
          Changes to members, connections, settings, permissions, and invites will appear here.
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
            const fieldChanges = getDetailedFieldChanges(entry);
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
                          {entry.subject_member ? (
                            <PersonPill
                              name={entry.subject_member.name}
                              avatarUrl={entry.subject_member.avatar_url}
                            />
                          ) : entry.subject_profile ? (
                            <PersonPill
                              name={entry.subject_profile.display_name}
                              avatarUrl={entry.subject_profile.avatar_url}
                            />
                          ) : (
                            <span className="text-sm font-medium">
                              {getEntityName(entry)}
                            </span>
                          )}
                        </div>

                        {entry.related_members.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.related_members.map((member) => (
                              <PersonPill
                                key={`${entry.id}-${member.role}-${member.id}`}
                                name={`${member.role === "from" ? "From" : "To"}: ${member.name}`}
                                avatarUrl={member.avatar_url}
                              />
                            ))}
                            {getFieldValue(entry.new_data ?? entry.old_data, "relationship_type") && (
                              <Badge variant="outline" className="text-[11px] capitalize">
                                {(getFieldValue(entry.new_data ?? entry.old_data, "relationship_type") ?? "").replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                        )}

                        {entry.actor && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">By</span>
                            <PersonPill name={entry.actor.display_name} avatarUrl={entry.actor.avatar_url} />
                          </div>
                        )}

                        {fieldChanges.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {fieldChanges.slice(0, 8).map((change) => (
                              <p key={`${entry.id}-${change.field}`} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/90">{change.field}:</span>{" "}
                                <span>{change.from}</span>
                                <span className="mx-1">&rarr;</span>
                                <span>{change.to}</span>
                              </p>
                            ))}
                            {fieldChanges.length > 8 && (
                              <p className="text-[11px] text-muted-foreground/80">
                                +{fieldChanges.length - 8} more changes
                              </p>
                            )}
                          </div>
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
