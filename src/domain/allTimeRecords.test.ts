import { describe, expect, it } from "vitest";
import { computeAllTimeHeadToHead } from "./allTimeRecords";
import type { Team } from "./types";

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

describe("computeAllTimeHeadToHead", () => {
  it("tallies results across seasons even though rosterId changes between them", () => {
    // Season 1: ownerA is roster 1, ownerB is roster 2. ownerA wins.
    const season1 = {
      teams: [
        team({
          rosterId: 1,
          ownerId: "ownerA",
          weeklyScores: [
            { week: 3, actualPoints: 100, optimalPoints: 0, opponentRosterId: 2, result: "W" },
          ],
        }),
        team({
          rosterId: 2,
          ownerId: "ownerB",
          weeklyScores: [
            { week: 3, actualPoints: 90, optimalPoints: 0, opponentRosterId: 1, result: "L" },
          ],
        }),
      ],
    };

    // Season 2: same two managers, but Sleeper assigned them different
    // rosterIds this time around. ownerB wins.
    const season2 = {
      teams: [
        team({
          rosterId: 7,
          ownerId: "ownerA",
          weeklyScores: [
            { week: 5, actualPoints: 80, optimalPoints: 0, opponentRosterId: 4, result: "L" },
          ],
        }),
        team({
          rosterId: 4,
          ownerId: "ownerB",
          weeklyScores: [
            { week: 5, actualPoints: 95, optimalPoints: 0, opponentRosterId: 7, result: "W" },
          ],
        }),
      ],
    };

    const record = computeAllTimeHeadToHead([season1, season2], "ownerA", "ownerB");
    expect(record).toEqual({ winsA: 1, winsB: 1, ties: 0, meetings: 2 });
  });

  it("ignores games against anyone other than ownerB", () => {
    const season = {
      teams: [
        team({
          rosterId: 1,
          ownerId: "ownerA",
          weeklyScores: [
            { week: 1, actualPoints: 100, optimalPoints: 0, opponentRosterId: 3, result: "W" },
          ],
        }),
        team({ rosterId: 2, ownerId: "ownerB", weeklyScores: [] }),
        team({ rosterId: 3, ownerId: "ownerC", weeklyScores: [] }),
      ],
    };

    const record = computeAllTimeHeadToHead([season], "ownerA", "ownerB");
    expect(record).toEqual({ winsA: 0, winsB: 0, ties: 0, meetings: 0 });
  });

  it("counts a tie for either manager and returns zeros when the managers never met", () => {
    const season = {
      teams: [
        team({
          rosterId: 1,
          ownerId: "ownerA",
          weeklyScores: [
            { week: 1, actualPoints: 100, optimalPoints: 0, opponentRosterId: 2, result: "T" },
          ],
        }),
        team({ rosterId: 2, ownerId: "ownerB", weeklyScores: [] }),
      ],
    };

    expect(computeAllTimeHeadToHead([season], "ownerA", "ownerB")).toEqual({
      winsA: 0,
      winsB: 0,
      ties: 1,
      meetings: 1,
    });
    expect(computeAllTimeHeadToHead([season], "ownerA", "ownerZ")).toEqual({
      winsA: 0,
      winsB: 0,
      ties: 0,
      meetings: 0,
    });
  });

  it("skips a season where one of the two managers wasn't in the league", () => {
    const seasonWithoutB = {
      teams: [team({ rosterId: 1, ownerId: "ownerA", weeklyScores: [] })],
    };
    const seasonWithBoth = {
      teams: [
        team({
          rosterId: 1,
          ownerId: "ownerA",
          weeklyScores: [
            { week: 1, actualPoints: 100, optimalPoints: 0, opponentRosterId: 2, result: "W" },
          ],
        }),
        team({ rosterId: 2, ownerId: "ownerB", weeklyScores: [] }),
      ],
    };

    const record = computeAllTimeHeadToHead([seasonWithoutB, seasonWithBoth], "ownerA", "ownerB");
    expect(record).toEqual({ winsA: 1, winsB: 0, ties: 0, meetings: 1 });
  });
});
