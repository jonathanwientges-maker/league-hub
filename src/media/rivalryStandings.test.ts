import { describe, expect, it } from "vitest";
import { computeRivalryStandings, buildRivalryRanking } from "./rivalryStandings";
import type { Team, WeeklyScore } from "../domain/types";
import type { RivalEntry } from "./rivals";

function score(overrides: Partial<WeeklyScore>): WeeklyScore {
  return {
    week: 1,
    actualPoints: 100,
    optimalPoints: 0,
    opponentRosterId: null,
    result: null,
    ...overrides,
  };
}

function team(overrides: Partial<Team> = {}): Team {
  return {
    rosterId: 1,
    ownerId: "u1",
    displayName: "Manager",
    teamName: "Team",
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

const PLAYOFF_WEEK_START = 15;

describe("computeRivalryStandings", () => {
  it("tallies wins/losses/points only for weeks played against a rival", () => {
    const teamA = team({
      rosterId: 1,
      teamName: "Alpha",
      weeklyScores: [
        score({ week: 1, actualPoints: 120, opponentRosterId: 2, result: "W" }), // rival
        score({ week: 2, actualPoints: 90, opponentRosterId: 3, result: "L" }), // not a rival
      ],
    });
    const teamB = team({
      rosterId: 2,
      teamName: "Beta",
      weeklyScores: [score({ week: 1, actualPoints: 95, opponentRosterId: 1, result: "L" })],
    });
    const teamC = team({
      rosterId: 3,
      teamName: "Gamma",
      weeklyScores: [score({ week: 2, actualPoints: 110, opponentRosterId: 1, result: "W" })],
    });

    const entries: RivalEntry[] = [{ rosterId: 1, rivals: [2] }];
    const { records } = computeRivalryStandings([teamA, teamB, teamC], entries, PLAYOFF_WEEK_START);

    expect(records.get(1)).toMatchObject({ wins: 1, losses: 0, ties: 0, gamesPlayed: 1, pointsFor: 120, pointsAgainst: 95 });
    expect(records.get(2)).toMatchObject({ wins: 0, losses: 1, ties: 0, gamesPlayed: 1 });
    expect(records.get(3)).toMatchObject({ gamesPlayed: 0 }); // never picked as a rival by anyone
  });

  it("counts a one-sided pick the same as a mutual one", () => {
    const teamA = team({
      rosterId: 1,
      weeklyScores: [score({ week: 1, actualPoints: 100, opponentRosterId: 2, result: "W" })],
    });
    const teamB = team({
      rosterId: 2,
      weeklyScores: [score({ week: 1, actualPoints: 80, opponentRosterId: 1, result: "L" })],
    });
    // Only roster 1 picked roster 2 — one-sided.
    const entries: RivalEntry[] = [{ rosterId: 1, rivals: [2] }];
    const { records, gameLog } = computeRivalryStandings([teamA, teamB], entries, PLAYOFF_WEEK_START);

    expect(records.get(1)?.gamesPlayed).toBe(1);
    expect(records.get(2)?.gamesPlayed).toBe(1);
    expect(gameLog).toHaveLength(1);
    expect(gameLog[0].mutual).toBe(false);
  });

  it("flags mutual when both sides picked each other", () => {
    const teamA = team({
      rosterId: 1,
      weeklyScores: [score({ week: 1, actualPoints: 100, opponentRosterId: 2, result: "T" })],
    });
    const teamB = team({
      rosterId: 2,
      weeklyScores: [score({ week: 1, actualPoints: 100, opponentRosterId: 1, result: "T" })],
    });
    const entries: RivalEntry[] = [
      { rosterId: 1, rivals: [2] },
      { rosterId: 2, rivals: [1] },
    ];
    const { records, gameLog } = computeRivalryStandings([teamA, teamB], entries, PLAYOFF_WEEK_START);

    expect(records.get(1)).toMatchObject({ wins: 0, losses: 0, ties: 1, gamesPlayed: 1 });
    expect(gameLog[0].mutual).toBe(true);
  });

  it("ignores playoff weeks", () => {
    const teamA = team({
      rosterId: 1,
      weeklyScores: [score({ week: 15, actualPoints: 100, opponentRosterId: 2, result: "W" })],
    });
    const teamB = team({
      rosterId: 2,
      weeklyScores: [score({ week: 15, actualPoints: 80, opponentRosterId: 1, result: "L" })],
    });
    const entries: RivalEntry[] = [{ rosterId: 1, rivals: [2] }];
    const { records, gameLog } = computeRivalryStandings([teamA, teamB], entries, PLAYOFF_WEEK_START);

    expect(records.get(1)?.gamesPlayed).toBe(0);
    expect(gameLog).toHaveLength(0);
  });

  it("skips bye weeks (no opponent) without throwing", () => {
    const teamA = team({
      rosterId: 1,
      weeklyScores: [score({ week: 1, actualPoints: 100, opponentRosterId: null, result: null })],
    });
    const entries: RivalEntry[] = [{ rosterId: 1, rivals: [2] }];
    expect(() => computeRivalryStandings([teamA], entries, PLAYOFF_WEEK_START)).not.toThrow();
  });

  it("logs each rivalry game exactly once, not twice", () => {
    const teamA = team({
      rosterId: 1,
      weeklyScores: [score({ week: 3, actualPoints: 100, opponentRosterId: 2, result: "W" })],
    });
    const teamB = team({
      rosterId: 2,
      weeklyScores: [score({ week: 3, actualPoints: 80, opponentRosterId: 1, result: "L" })],
    });
    const entries: RivalEntry[] = [{ rosterId: 1, rivals: [2] }];
    const { gameLog } = computeRivalryStandings([teamA, teamB], entries, PLAYOFF_WEEK_START);
    expect(gameLog).toHaveLength(1);
    expect(gameLog[0]).toEqual({ week: 3, rosterIdA: 1, rosterIdB: 2, pointsA: 100, pointsB: 80, mutual: false });
  });
});

describe("buildRivalryRanking", () => {
  it("ranks by win percentage, then rivalry points for", () => {
    const teamA = team({ rosterId: 1, teamName: "Alpha" });
    const teamB = team({ rosterId: 2, teamName: "Beta" });
    const teamC = team({ rosterId: 3, teamName: "Gamma" });

    const records = new Map([
      [1, { rosterId: 1, wins: 2, losses: 0, ties: 0, pointsFor: 250, pointsAgainst: 200, gamesPlayed: 2 }],
      [2, { rosterId: 2, wins: 1, losses: 1, ties: 0, pointsFor: 210, pointsAgainst: 205, gamesPlayed: 2 }],
      [3, { rosterId: 3, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0 }],
    ]);

    const { ranking, lambs } = buildRivalryRanking([teamA, teamB, teamC], records);
    expect(ranking.map((r) => r.rosterId)).toEqual([1, 2]);
    expect(lambs.map((r) => r.rosterId)).toEqual([3]);
  });

  it("puts a team with zero rivalry games in the lambs list, not the ranking", () => {
    const teamA = team({ rosterId: 1 });
    const records = new Map([[1, { rosterId: 1, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0 }]]);
    const { ranking, lambs } = buildRivalryRanking([teamA], records);
    expect(ranking).toHaveLength(0);
    expect(lambs).toHaveLength(1);
  });

  it("breaks a tied win percentage by rivalry points for", () => {
    const teamA = team({ rosterId: 1, teamName: "Alpha" });
    const teamB = team({ rosterId: 2, teamName: "Beta" });
    const records = new Map([
      [1, { rosterId: 1, wins: 1, losses: 1, ties: 0, pointsFor: 300, pointsAgainst: 280, gamesPlayed: 2 }],
      [2, { rosterId: 2, wins: 1, losses: 1, ties: 0, pointsFor: 350, pointsAgainst: 290, gamesPlayed: 2 }],
    ]);
    const { ranking } = buildRivalryRanking([teamA, teamB], records);
    expect(ranking.map((r) => r.rosterId)).toEqual([2, 1]);
  });
});
