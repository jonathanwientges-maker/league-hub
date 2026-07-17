import { describe, expect, it } from "vitest";
import { rankByRecord, rankDivisions } from "./standings";
import type { Team, H2hMap } from "./types";

function team(overrides: Partial<Team>): Team {
  return {
    rosterId: 1,
    ownerId: "u1",
    displayName: "Test",
    teamName: "Test Team",
    avatarUrl: null,
    division: 1,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    weeklyScores: [],
    potentialPointsTotal: 0,
    ...overrides,
  };
}

describe("rankByRecord", () => {
  it("returns every team, not a dropped subset, when the whole group is tied at 0-0-0 with identical pointsFor (a freshly-created, not-yet-started season)", () => {
    const teams = [1, 2, 3, 4].map((id) => team({ rosterId: id, pointsFor: 0 }));
    const h2hMap: H2hMap = {};

    const ranked = rankByRecord(teams, h2hMap);
    expect(ranked).toHaveLength(4);
    expect(new Set(ranked.map((t) => t.rosterId))).toEqual(new Set([1, 2, 3, 4]));
  });
});

describe("rankDivisions", () => {
  it("produces full per-division standings (not empty) for an all-tied, scoreless season", () => {
    const teams = [
      team({ rosterId: 1, division: 1 }),
      team({ rosterId: 2, division: 1 }),
      team({ rosterId: 3, division: 1 }),
      team({ rosterId: 4, division: 1 }),
      team({ rosterId: 5, division: 2 }),
      team({ rosterId: 6, division: 2 }),
    ];
    const h2hMap: H2hMap = {};

    const standings = rankDivisions(teams, h2hMap);
    expect(standings).toHaveLength(6);
    // Every division should have exactly one rank-1 and one rank-2 (the
    // playoff-position cutoff), which is what buildPickRaceGroup/
    // determineSeeds downstream rely on never coming up short.
    const rank1Count = standings.filter((s) => s.rank === 1).length;
    const rank2Count = standings.filter((s) => s.rank === 2).length;
    expect(rank1Count).toBe(2);
    expect(rank2Count).toBe(2);
  });
});
