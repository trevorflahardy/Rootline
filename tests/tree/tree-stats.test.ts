import { describe, it, expect } from "vitest";

describe("Tree stats calculations", () => {
  // Test lifespan calculation
  it("calculates average lifespan in full years", () => {
    const calcLifespan = (dob: string, dod: string) =>
      Math.floor((new Date(dod).getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    expect(calcLifespan("1920-01-01", "2000-06-15")).toBe(80);
    expect(calcLifespan("1950-03-10", "2020-03-09")).toBe(69);
  });

  it("completeness percent rounds correctly", () => {
    const pct = (complete: number, total: number) =>
      total === 0 ? 0 : Math.round((complete / total) * 100);
    expect(pct(3, 4)).toBe(75);
    expect(pct(0, 5)).toBe(0);
    expect(pct(5, 5)).toBe(100);
    expect(pct(0, 0)).toBe(0);
  });

  it("gender counts handle unknown/null values", () => {
    const categorize = (g: string | null) =>
      g === "male" ? "male" : g === "female" ? "female" : "unknown";
    expect(categorize("male")).toBe("male");
    expect(categorize("female")).toBe("female");
    expect(categorize(null)).toBe("unknown");
    expect(categorize("other")).toBe("unknown");
  });

  it("maxGenerations is 0 for empty tree", () => {
    // BFS with no members returns 0
    const bfs = (members: string[], edges: [string,string][]) => {
      if (!members.length) return 0;
      const children = new Set(edges.map(([,c]) => c));
      const roots = members.filter(m => !children.has(m));
      if (!roots.length) return 1;
      const childMap = new Map<string, string[]>();
      for (const [p, c] of edges) {
        childMap.set(p, [...(childMap.get(p) ?? []), c]);
      }
      let max = 0;
      const queue: [string, number][] = roots.map(r => [r, 1]);
      while (queue.length) {
        const [node, depth] = queue.shift()!;
        max = Math.max(max, depth);
        for (const child of childMap.get(node) ?? []) {
          queue.push([child, depth + 1]);
        }
      }
      return max;
    };
    expect(bfs([], [])).toBe(0);
    expect(bfs(["a"], [])).toBe(1);
    expect(bfs(["a","b","c"], [["a","b"],["b","c"]])).toBe(3);
  });

  it("handles tree with no deceased members (no lifespan data)", () => {
    const avgLifespan = (lifespans: number[]) =>
      lifespans.length === 0 ? null : Math.round(lifespans.reduce((a,b) => a+b, 0) / lifespans.length);
    expect(avgLifespan([])).toBeNull();
    expect(avgLifespan([70, 80, 90])).toBe(80);
  });
});
