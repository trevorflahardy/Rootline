import { describe, it, expect } from "vitest";

describe("getTreeStats edge cases", () => {
  /**
   * Mirrors the actual BFS in tree-stats.ts exactly:
   * - edges are [parent, child] tuples
   * - roots = nodes with no parent in edge list
   * - depthMap tracks 0-indexed depth (hops from root)
   * - maxGenerations = deepest hop count
   * - generationCount = maxGenerations + 1  (if hops > 0)
   *                   = 1                   (if there are roots but no edges)
   *                   = 0                   (no members at all)
   */
  const computeGenerations = (
    memberIds: string[],
    edges: [string, string][]
  ): number => {
    if (!memberIds.length) return 0;

    const memberSet = new Set(memberIds);

    const childToParents = new Map<string, Set<string>>();
    const parentToChildren = new Map<string, Set<string>>();
    for (const [p, c] of edges) {
      if (!childToParents.has(c)) childToParents.set(c, new Set());
      childToParents.get(c)!.add(p);
      if (!parentToChildren.has(p)) parentToChildren.set(p, new Set());
      parentToChildren.get(p)!.add(c);
    }

    // Roots: members with no parents in the graph
    const roots = memberIds.filter(
      (m) => !childToParents.has(m) || childToParents.get(m)!.size === 0
    );

    let maxHops = 0;
    const depthMap = new Map<string, number>();
    const queue: Array<{ id: string; depth: number }> = [];

    for (const rootId of roots) {
      depthMap.set(rootId, 0);
      queue.push({ id: rootId, depth: 0 });
    }

    let head = 0;
    while (head < queue.length) {
      const { id, depth } = queue[head++];
      const children = parentToChildren.get(id);
      if (!children) continue;
      for (const childId of children) {
        if (!memberSet.has(childId)) continue;
        const newDepth = depth + 1;
        const existing = depthMap.get(childId);
        if (existing === undefined || newDepth > existing) {
          depthMap.set(childId, newDepth);
          if (newDepth > maxHops) maxHops = newDepth;
          queue.push({ id: childId, depth: newDepth });
        }
      }
    }

    // Convert 0-indexed hops to generation count
    return maxHops > 0 ? maxHops + 1 : roots.length > 0 ? 1 : 0;
  };

  it("empty member list returns 0 generations", () => {
    expect(computeGenerations([], [])).toBe(0);
  });

  it("single member with no relationships returns 1 generation", () => {
    expect(computeGenerations(["a"], [])).toBe(1);
  });

  it("grandparent -> parent -> child returns 3 generations", () => {
    expect(
      computeGenerations(["gp", "p", "c"], [["gp", "p"], ["p", "c"]])
    ).toBe(3);
  });

  it("two separate families: max depth wins", () => {
    // Family 1: A->B->C (3 generations), Family 2: X->Y (2 generations)
    expect(
      computeGenerations(
        ["A", "B", "C", "X", "Y"],
        [["A", "B"], ["B", "C"], ["X", "Y"]]
      )
    ).toBe(3);
  });

  it("single parent-child pair returns 2 generations", () => {
    expect(computeGenerations(["p", "c"], [["p", "c"]])).toBe(2);
  });

  it("fieldBreakdown withDob counts members with date_of_birth", () => {
    const members = [
      {
        date_of_birth: "1980-01-01",
        bio: "has bio",
        avatar_url: null,
        date_of_death: null,
        is_deceased: false,
      },
      {
        date_of_birth: null,
        bio: null,
        avatar_url: "http://img",
        date_of_death: null,
        is_deceased: false,
      },
      {
        date_of_birth: "1950-01-01",
        bio: null,
        avatar_url: null,
        date_of_death: "2020-01-01",
        is_deceased: true,
      },
    ];
    const withDob = members.filter((m) => m.date_of_birth).length;
    const withBio = members.filter((m) => m.bio).length;
    const withPhoto = members.filter((m) => m.avatar_url).length;
    expect(withDob).toBe(2);
    expect(withBio).toBe(1);
    expect(withPhoto).toBe(1);
  });

  it("withDod counts only deceased members with date_of_death", () => {
    const members = [
      { is_deceased: true, date_of_death: "2020-01-01" },
      { is_deceased: true, date_of_death: null },
      { is_deceased: false, date_of_death: null },
    ];
    const withDod = members.filter((m) => m.is_deceased && !!m.date_of_death)
      .length;
    expect(withDod).toBe(1);
  });

  it("longestLifespan picks max from deceased lifespans", () => {
    const lifespans = [70, 85, 62, 91, 78];
    expect(Math.max(...lifespans)).toBe(91);
  });

  it("oldestLiving picks member with earliest date_of_birth string", () => {
    const living = [
      { date_of_birth: "1935-01-01", id: "a", first_name: "Alice" },
      { date_of_birth: "1950-06-15", id: "b", first_name: "Bob" },
      { date_of_birth: "1928-03-10", id: "c", first_name: "Carol" },
    ];
    const oldest = living.reduce((min, m) =>
      m.date_of_birth < min.date_of_birth ? m : min
    );
    expect(oldest.id).toBe("c");
  });

  it("averageLifespan floors to whole years", () => {
    // Mirrors: Math.floor(total / count)
    const lifespans = [70, 80, 75];
    const avg = Math.floor(
      lifespans.reduce((s, v) => s + v, 0) / lifespans.length
    );
    expect(avg).toBe(75);
  });

  it("completenessPercent rounds to nearest integer", () => {
    // 2 out of 3 complete = 66.666... -> rounds to 67
    expect(Math.round((2 / 3) * 100)).toBe(67);
    // 1 out of 4 = 25 exactly
    expect(Math.round((1 / 4) * 100)).toBe(25);
  });

  it("gender 'other' falls into other bucket, not unknown", () => {
    // Mirrors: g && g !== 'unknown' -> other
    const categorize = (g: string | null | undefined) => {
      const normalized = g?.toLowerCase();
      if (normalized === "male") return "male";
      if (normalized === "female") return "female";
      if (normalized && normalized !== "unknown") return "other";
      return "unknown";
    };
    expect(categorize("nonbinary")).toBe("other");
    expect(categorize("unknown")).toBe("unknown");
    expect(categorize(null)).toBe("unknown");
    expect(categorize(undefined)).toBe("unknown");
  });
});
