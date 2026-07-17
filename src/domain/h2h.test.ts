import { describe, expect, it } from "vitest";
import { buildH2hMap } from "./h2h";
import type { WeekResult } from "./weeklyResults";

describe("buildH2hMap", () => {
  it("accumulates wins/losses/ties for each roster against each opponent across multiple weeks", () => {
    const results: WeekResult[] = [
      { week: 1, rosterId: 1, opponentRosterId: 2, actualPoints: 100, result: "W" },
      { week: 1, rosterId: 2, opponentRosterId: 1, actualPoints: 90, result: "L" },
      { week: 8, rosterId: 1, opponentRosterId: 2, actualPoints: 80, result: "L" },
      { week: 8, rosterId: 2, opponentRosterId: 1, actualPoints: 95, result: "W" },
    ];

    const map = buildH2hMap(results);

    expect(map[1][2]).toEqual({ wins: 1, losses: 1, ties: 0 });
    expect(map[2][1]).toEqual({ wins: 1, losses: 1, ties: 0 });
  });

  it("ignores bye/unresolved results (null opponent or null result)", () => {
    const results: WeekResult[] = [
      { week: 1, rosterId: 1, opponentRosterId: null, actualPoints: 100, result: null },
    ];
    const map = buildH2hMap(results);
    expect(map).toEqual({});
  });
});
