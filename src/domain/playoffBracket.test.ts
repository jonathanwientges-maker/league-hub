import { describe, expect, it } from "vitest";
import { buildPlayoffBracket, determineSeeds } from "./playoffBracket";
import type { Team, H2hMap } from "./types";
import type { SleeperMatchup } from "../api/types";

function team(rosterId: number, division: number, wins: number, losses: number, pointsFor = 1000 + rosterId): Team {
  return {
    rosterId,
    ownerId: `u${rosterId}`,
    displayName: `Team ${rosterId}`,
    teamName: `Team ${rosterId}`,
    avatarUrl: null,
    division,
    wins,
    losses,
    ties: 0,
    pointsFor,
    pointsAgainst: 1000,
    weeklyScores: [],
    potentialPointsTotal: 0,
  };
}

// Div A: winner=1 (.769), second=2 (.538)
// Div B: winner=3 (.692), second=4 (.615)
// Div C: winner=5 (.615), second=6 (.462)
const teams: Team[] = [
  team(1, 1, 10, 3),
  team(2, 1, 7, 6),
  team(3, 2, 9, 4),
  team(4, 2, 8, 5),
  team(5, 3, 8, 5),
  team(6, 3, 6, 7),
];
const emptyH2h: H2hMap = {};

describe("determineSeeds", () => {
  it("seeds the 3 division winners 1-3 by win%, and the 3 second-place teams 4-6 by win%", () => {
    const seeds = determineSeeds(teams, emptyH2h);
    const bySeed = Object.fromEntries(seeds.map((s) => [s.seed, s.rosterId]));
    expect(bySeed).toEqual({ 1: 1, 2: 3, 3: 5, 4: 4, 5: 2, 6: 6 });
  });

  it("breaks a tie among division winners by head-to-head before falling back to points for", () => {
    // Two division winners tied at the same win%; team 1 beat team 3 head-to-head.
    const tiedTeams: Team[] = [
      team(1, 1, 8, 5, 1000),
      team(2, 1, 5, 8, 900),
      team(3, 2, 8, 5, 2000), // higher points for, but loses the h2h tiebreak
      team(4, 2, 5, 8, 900),
      team(5, 3, 3, 10, 800),
      team(6, 3, 2, 11, 700),
    ];
    const h2hMap: H2hMap = {
      1: { 3: { wins: 1, losses: 0, ties: 0 } },
      3: { 1: { wins: 0, losses: 1, ties: 0 } },
    };
    const seeds = determineSeeds(tiedTeams, h2hMap);
    expect(seeds.find((s) => s.seed === 1)?.rosterId).toBe(1);
    expect(seeds.find((s) => s.seed === 2)?.rosterId).toBe(3);
  });
});

describe("buildPlayoffBracket", () => {
  it("pairs the wildcard round as seed3-vs-seed6 and seed4-vs-seed5", () => {
    const bracket = buildPlayoffBracket({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 15,
      matchupsByWeek: new Map([[15, []]]),
    });

    const w1 = bracket.games.find((g) => g.id === "W1")!;
    const w2 = bracket.games.find((g) => g.id === "W2")!;
    expect([w1.home, w1.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()).toEqual([5, 6]);
    expect([w2.home, w2.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()).toEqual([2, 4]);
  });

  it("reseeds the semifinals by actual record among all 4 remaining teams — not by which bracket slot they came from — when a wildcard upset means the W1 winner outranks the W2 winner", () => {
    // Wildcard: W1 = seed3(5) vs seed6(6) -> team5 wins.
    // W2 = seed4(4) vs seed5(2) -> UPSET: team2 (.538, worse record) beats team4 (.615).
    const week1Matchups: SleeperMatchup[] = [
      { roster_id: 5, matchup_id: 1, points: 120, starters: [], players: [], players_points: {} },
      { roster_id: 6, matchup_id: 1, points: 100, starters: [], players: [], players_points: {} },
      { roster_id: 2, matchup_id: 2, points: 110, starters: [], players: [], players_points: {} },
      { roster_id: 4, matchup_id: 2, points: 90, starters: [], players: [], players_points: {} },
    ];

    const bracket = buildPlayoffBracket({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 17,
      matchupsByWeek: new Map([
        [15, week1Matchups],
        [16, []],
        [17, []],
      ]),
    });

    const w1 = bracket.games.find((g) => g.id === "W1")!;
    const w2 = bracket.games.find((g) => g.id === "W2")!;
    expect(w1.winnerRosterId).toBe(5);
    expect(w2.winnerRosterId).toBe(2); // the upset

    // Remaining 4: seed1=team1(.769), seed2=team3(.692), winnerW1=team5(.615), winnerW2=team2(.538).
    // team5's record IS better than team2's -- reseeding must not assume
    // seed1/seed2 automatically anchor S1, and must not pair by "which
    // bracket slot" but by actual record: best(1) vs worst(2) in S1.
    const s1 = bracket.games.find((g) => g.id === "S1")!;
    const s2 = bracket.games.find((g) => g.id === "S2")!;
    expect(s1.reseeded).toBe(true);
    expect(
      [s1.home, s1.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()
    ).toEqual([1, 2]);
    expect(
      [s2.home, s2.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()
    ).toEqual([3, 5]);
  });

  it("marks S1/S2 as not-yet-reseeded (provisional bye-vs-TBD) while the wildcard round is still undecided", () => {
    const bracket = buildPlayoffBracket({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 15,
      matchupsByWeek: new Map([[15, []]]), // no results yet
    });

    const s1 = bracket.games.find((g) => g.id === "S1")!;
    const s2 = bracket.games.find((g) => g.id === "S2")!;
    expect(s1.reseeded).toBe(false);
    expect(s2.reseeded).toBe(false);
    // Seed 1 and seed 2 (the byes) should still be visible as the home side.
    expect("rosterId" in s1.home && s1.home.rosterId).toBe(1);
    expect("rosterId" in s2.home && s2.home.rosterId).toBe(3);
  });
});
