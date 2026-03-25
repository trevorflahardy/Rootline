"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import type { MemberWithStats } from "@/lib/actions/member";

interface MembersListProps {
  treeId: string;
  members: MemberWithStats[];
  canEdit: boolean;
}

type FilterStatus = "all" | "living" | "deceased";
type SortKey = "name" | "dob" | "relationships";

const COMPLETENESS_DOT: Record<MemberWithStats["completeness"], string> = {
  complete: "bg-green-500",
  partial: "bg-yellow-500",
  empty: "bg-muted-foreground/40",
};

const COMPLETENESS_LABEL: Record<MemberWithStats["completeness"], string> = {
  complete: "Complete profile",
  partial: "Partial profile",
  empty: "Missing info",
};

export function MembersList({ treeId, members, canEdit }: MembersListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    let result = members;

    if (filter === "living") result = result.filter((m) => !m.is_deceased);
    if (filter === "deceased") result = result.filter((m) => m.is_deceased);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.first_name.toLowerCase().includes(q) ||
          (m.last_name ?? "").toLowerCase().includes(q) ||
          (m.maiden_name ?? "").toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sort === "name") {
        return `${a.first_name} ${a.last_name ?? ""}`.localeCompare(
          `${b.first_name} ${b.last_name ?? ""}`
        );
      }
      if (sort === "dob") {
        return (a.date_of_birth ?? "").localeCompare(b.date_of_birth ?? "");
      }
      if (sort === "relationships") {
        return b.relationship_count - a.relationship_count;
      }
      return 0;
    });
  }, [members, search, filter, sort]);

  const completeCount = members.filter((m) => m.completeness === "complete").length;
  const completePct = members.length > 0 ? Math.round((completeCount / members.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} {members.length === 1 ? "person" : "people"} ·{" "}
            <span className="text-foreground font-medium">{completePct}%</span> complete profiles
          </p>
        </div>
        {canEdit && (
          <Link href={`/tree/${treeId}`}>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </Link>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="living">Living</SelectItem>
            <SelectItem value="deceased">Deceased</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="dob">Sort: Birth date</SelectItem>
            <SelectItem value="relationships">Sort: Connections</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            {search || filter !== "all" ? "No members match your filters." : "No members in this tree yet."}
          </p>
          {canEdit && !search && filter === "all" && (
            <Link href={`/tree/${treeId}`}>
              <Button size="sm" variant="outline">Add the first member</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((member) => (
            <MemberCard key={member.id} member={member} treeId={treeId} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member, treeId }: { member: MemberWithStats; treeId: string }) {
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ");
  const initials = [member.first_name[0], member.last_name?.[0]].filter(Boolean).join("");

  return (
    <Link href={`/tree/${treeId}/member/${member.id}`}>
      <div
        className={cn(
          "glass-card glass-edge-top p-4 flex gap-3 hover:glass-elevated transition-all duration-200 cursor-pointer group",
          member.is_deceased && "opacity-70"
        )}
      >
        {/* Avatar */}
        <Avatar className="h-11 w-11 shrink-0">
          {member.avatar_url && <AvatarImage src={member.avatar_url} alt={fullName} />}
          <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {fullName}
            </span>
            {/* Completeness dot */}
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", COMPLETENESS_DOT[member.completeness])}
              title={COMPLETENESS_LABEL[member.completeness]}
            />
          </div>

          {/* Dates */}
          <p className="text-xs text-muted-foreground mt-0.5">
            {member.date_of_birth ? formatDate(member.date_of_birth) : ""}
            {member.date_of_birth && member.date_of_death ? " – " : ""}
            {member.date_of_death ? formatDate(member.date_of_death) : ""}
            {!member.date_of_birth && !member.date_of_death && (
              <span className="italic">No dates recorded</span>
            )}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5">
            {member.is_deceased && (
              <Badge variant="secondary" className="text-xs py-0 h-4">Deceased</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {member.relationship_count} connection{member.relationship_count !== 1 ? "s" : ""}
            </span>
            {member.photo_count > 0 && (
              <span className="text-xs text-muted-foreground">{member.photo_count} photo{member.photo_count !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
