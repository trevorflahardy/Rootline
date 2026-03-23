"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { User } from "lucide-react";
import { formatLifespan } from "@/lib/utils/date";
import type { TreeMember } from "@/types";

interface TreeSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TreeMember[];
  onSelect: (memberId: string) => void;
}

export function TreeSearch({ open, onOpenChange, members, onSelect }: TreeSearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        m.first_name.toLowerCase().includes(q) ||
        (m.last_name?.toLowerCase().includes(q)) ||
        (m.maiden_name?.toLowerCase().includes(q)) ||
        (m.birth_place?.toLowerCase().includes(q))
    );
  }, [members, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className="glass-card glass-elevated">
      <CommandInput
        placeholder="Search family members..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No members found.</CommandEmpty>
        <CommandGroup heading="Members">
          {filtered.map((member) => {
            const lifespan = formatLifespan(
              member.date_of_birth,
              member.date_of_death,
              member.is_deceased
            );
            return (
              <CommandItem
                key={member.id}
                value={`${member.first_name} ${member.last_name ?? ""}`}
                onSelect={() => {
                  onSelect(member.id);
                  setQuery("");
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {member.avatar_url ? (
                      <Image
                        src={member.avatar_url}
                        alt={member.first_name}
                        className="h-8 w-8 rounded-full object-cover"
                        width={32}
                        height={32}
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    {lifespan && (
                      <p className="text-xs text-muted-foreground">{lifespan}</p>
                    )}
                  </div>
                  {member.birth_place && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {member.birth_place}
                    </span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
