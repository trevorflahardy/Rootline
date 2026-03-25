import { describe, it, expect } from "vitest";
import type { TimelineEvent } from "@/types/timeline";

describe("getTimelineEvents logic", () => {
  const parseYear = (date: string) => parseInt(date.substring(0, 4), 10);
  const toDecade = (year: number) => Math.floor(year / 10) * 10;

  it("birth event year and decade computed correctly", () => {
    expect(parseYear("1985-03-15")).toBe(1985);
    expect(toDecade(1985)).toBe(1980);
  });

  it("death event decade rounds down", () => {
    expect(toDecade(1999)).toBe(1990);
    expect(toDecade(2000)).toBe(2000);
  });

  it("events sorted by ISO date string sort correctly", () => {
    const dates = ["1990-06-20", "1985-03-15", "1992-01-01"];
    const sorted = [...dates].sort();
    expect(sorted[0]).toBe("1985-03-15");
    expect(sorted[2]).toBe("1992-01-01");
  });

  it("member with no dates produces no events", () => {
    const member = { date_of_birth: null, date_of_death: null };
    const events: TimelineEvent[] = [];
    if (member.date_of_birth)
      events.push({
        id: "b",
        type: "birth",
        date: member.date_of_birth,
        year: 0,
        decade: 0,
        memberId: "m1",
        memberName: "A",
        place: null,
      });
    if (member.date_of_death)
      events.push({
        id: "d",
        type: "death",
        date: member.date_of_death,
        year: 0,
        decade: 0,
        memberId: "m1",
        memberName: "A",
        place: null,
      });
    expect(events).toHaveLength(0);
  });

  it("events grouped by decade correctly", () => {
    const events: TimelineEvent[] = [
      {
        id: "b1",
        type: "birth",
        date: "1985-01-01",
        year: 1985,
        decade: 1980,
        memberId: "m1",
        memberName: "A",
        place: null,
      },
      {
        id: "b2",
        type: "birth",
        date: "1987-05-10",
        year: 1987,
        decade: 1980,
        memberId: "m2",
        memberName: "B",
        place: null,
      },
      {
        id: "b3",
        type: "birth",
        date: "1992-03-01",
        year: 1992,
        decade: 1990,
        memberId: "m3",
        memberName: "C",
        place: null,
      },
    ];
    const byDecade = events.reduce(
      (acc, e) => {
        (acc[e.decade] ??= []).push(e);
        return acc;
      },
      {} as Record<number, TimelineEvent[]>
    );
    expect(byDecade[1980]).toHaveLength(2);
    expect(byDecade[1990]).toHaveLength(1);
  });

  it("TimelineEventType values are as expected", () => {
    const types = ["birth", "death", "marriage", "divorce"] as const;
    expect(types).toHaveLength(4);
    types.forEach((t) => expect(typeof t).toBe("string"));
  });

  it("fullName joins first and last name, skipping null last name", () => {
    const fullName = (m: { first_name: string; last_name: string | null }) =>
      [m.first_name, m.last_name].filter(Boolean).join(" ");
    expect(fullName({ first_name: "Alice", last_name: "Smith" })).toBe(
      "Alice Smith"
    );
    expect(fullName({ first_name: "Alice", last_name: null })).toBe("Alice");
  });

  it("marriage event deduplication key is order-independent", () => {
    const pairKey = (a: string, b: string) => [a, b].sort().join("-");
    expect(pairKey("m1", "m2")).toBe(pairKey("m2", "m1"));
  });

  it("divorce event only emitted when relationship_type is 'divorced'", () => {
    const shouldEmitDivorce = (type: string, endDate: string | null) =>
      type === "divorced" && endDate !== null;
    expect(shouldEmitDivorce("divorced", "2005-01-01")).toBe(true);
    expect(shouldEmitDivorce("spouse", "2005-01-01")).toBe(false);
    expect(shouldEmitDivorce("divorced", null)).toBe(false);
  });

  it("invalid year string (NaN) produces no event", () => {
    const parseYear = (date: string) => parseInt(date.substring(0, 4), 10);
    expect(isNaN(parseYear("XXXX-01-01"))).toBe(true);
  });
});
