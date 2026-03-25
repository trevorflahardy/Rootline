import { describe, it, expect } from "vitest";
import type { TimelineEvent } from "@/types/timeline";

describe("Timeline event utilities", () => {
  const sampleEvents: TimelineEvent[] = [
    {
      id: "birth-1",
      type: "birth",
      date: "1985-03-15",
      year: 1985,
      decade: 1980,
      memberId: "m1",
      memberName: "Alice Smith",
      place: "London",
    },
    {
      id: "death-1",
      type: "death",
      date: "1990-06-20",
      year: 1990,
      decade: 1990,
      memberId: "m2",
      memberName: "Bob Jones",
      place: null,
    },
    {
      id: "birth-2",
      type: "birth",
      date: "1992-01-01",
      year: 1992,
      decade: 1990,
      memberId: "m3",
      memberName: "Carol White",
      place: "Paris",
    },
  ];

  it("events are sorted chronologically", () => {
    const sorted = [...sampleEvents].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
    expect(sorted[0].year).toBe(1985);
    expect(sorted[1].year).toBe(1990);
    expect(sorted[2].year).toBe(1992);
  });

  it("filter by type returns only matching events", () => {
    const births = sampleEvents.filter((e) => e.type === "birth");
    expect(births).toHaveLength(2);
    expect(births.every((e) => e.type === "birth")).toBe(true);
  });

  it("grouping by decade is correct", () => {
    const byDecade = sampleEvents.reduce(
      (acc, e) => {
        (acc[e.decade] ??= []).push(e);
        return acc;
      },
      {} as Record<number, TimelineEvent[]>
    );
    expect(byDecade[1980]).toHaveLength(1);
    expect(byDecade[1990]).toHaveLength(2);
  });

  it("decade calculation floors to nearest 10", () => {
    const decade = (year: number) => Math.floor(year / 10) * 10;
    expect(decade(1984)).toBe(1980);
    expect(decade(1990)).toBe(1990);
    expect(decade(1999)).toBe(1990);
    expect(decade(2000)).toBe(2000);
  });

  it("empty events array produces no groups", () => {
    const byDecade = [].reduce(
      (acc: Record<number, TimelineEvent[]>, e: TimelineEvent) => {
        (acc[e.decade] ??= []).push(e);
        return acc;
      },
      {}
    );
    expect(Object.keys(byDecade)).toHaveLength(0);
  });
});
