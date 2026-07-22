import { describe, expect, it } from "vitest";
import { computeWeekContext } from "./weekContext";
import { assembleTeams } from "../../domain/team";
import { buildWeekResultsByRoster } from "../../domain/weeklyResults";
import type { SleeperMatchup, SleeperPlayer, SleeperRoster, SleeperUser } from "../../api/types";

const rosters: SleeperRoster[] = [
  {
    roster_id: 1,
    owner_id: "u1",
    league_id: "L",
    players: ["p1", "p2", "p4", "p5", "p6", "p7", "p9"],
    starters: ["p1", "p2", "p4", "p6", "p7"],
    reserve: ["p8"],
    taxi: ["p9"],
    settings: {
      wins: 2,
      losses: 1,
      ties: 0,
      fpts: 315,
      fpts_decimal: 0,
      fpts_against: 297,
      fpts_against_decimal: 0,
      division: 1,
    },
  },
  {
    roster_id: 2,
    owner_id: "u2",
    league_id: "L",
    players: [],
    starters: [],
    settings: {
      wins: 1,
      losses: 2,
      ties: 0,
      fpts: 297,
      fpts_decimal: 0,
      fpts_against: 315,
      fpts_against_decimal: 0,
      division: 1,
    },
  },
];

const users: SleeperUser[] = [
  { user_id: "u1", display_name: "Alice", avatar: null, metadata: { team_name: "Alpha" } },
  { user_id: "u2", display_name: "Bob", avatar: null, metadata: { team_name: "Beta" } },
];

const players: Record<string, SleeperPlayer> = {
  p1: { player_id: "p1", full_name: "Quinn QB", position: "QB", team: "KC", fantasy_positions: ["QB"] },
  p2: { player_id: "p2", full_name: "Ricky RB", position: "RB", team: "SF", fantasy_positions: ["RB"] },
  p4: { player_id: "p4", full_name: "Tommy TE", position: "TE", team: "NE", fantasy_positions: ["TE"] },
  p5: { player_id: "p5", full_name: "Wendy Bench", position: "WR", team: "DAL", fantasy_positions: ["WR"] },
  p6: { player_id: "p6", full_name: "Wes Starter", position: "WR", team: "DAL", fantasy_positions: ["WR"] },
  p7: {
    player_id: "p7",
    full_name: "Wyatt Out",
    position: "WR",
    team: "DAL",
    fantasy_positions: ["WR"],
    injury_status: "Out",
  },
  p8: { player_id: "p8", full_name: "Reggie Reserve", position: "RB", team: "ATL", fantasy_positions: ["RB"] },
  p9: { player_id: "p9", full_name: "Taylor Taxi", position: "WR", team: "MIA", fantasy_positions: ["WR"] },
};

function matchup(overrides: Partial<SleeperMatchup> & Pick<SleeperMatchup, "roster_id" | "points">): SleeperMatchup {
  return {
    matchup_id: 1,
    starters: [],
    players: [],
    players_points: {},
    ...overrides,
  };
}

const matchupsByWeek = new Map<number, SleeperMatchup[]>([
  [1, [matchup({ roster_id: 1, points: 120, starters: ["p1", "p2"], players: ["p1", "p2", "p8"], players_points: { p2: 3, p8: 8 } }), matchup({ roster_id: 2, points: 90 })]],
  [2, [matchup({ roster_id: 1, points: 95, starters: ["p1", "p2"], players: ["p1", "p2"], players_points: { p2: 1 } }), matchup({ roster_id: 2, points: 110 })]],
  [
    3,
    [
      matchup({
        roster_id: 1,
        points: 100,
        starters: ["p1", "p2", "p4", "p6", "p7"],
        players: ["p1", "p2", "p4", "p5", "p6", "p7", "p9"],
        players_points: { p1: 10, p2: 2, p4: 0, p5: 20, p6: 3, p7: 0, p9: 6.7 },
      }),
      matchup({ roster_id: 2, points: 97 }),
    ],
  ],
  [4, [matchup({ roster_id: 1, points: 0 }), matchup({ roster_id: 2, points: 0 })]],
]);

const teams = assembleTeams(rosters, users, buildWeekResultsByRoster(matchupsByWeek));

function buildCtx() {
  return computeWeekContext({
    season: "2026",
    completedWeek: 3,
    upcomingWeek: 4,
    teams,
    rosters,
    matchupsByWeek,
    players,
    byeWeeks: { NE: 3 },
    outStatusSnapshot: null,
  });
}

describe("computeWeekContext", () => {
  it("carries over record, pointsFor and division rank from the team model", () => {
    const ctx = buildCtx();
    const alpha = ctx.teams.get(1)!;
    expect(alpha.record).toBe("2-1");
    expect(alpha.pointsFor).toBe(315);
    expect(alpha.division).toBe(1);
    expect(alpha.divisionRank).toBe(1); // 2-1 beats 1-2
    const beta = ctx.teams.get(2)!;
    expect(beta.divisionRank).toBe(2);
  });

  it("computes last week's result and margin from the matchup scores", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.resultLastWeek).toEqual({ result: "W", margin: 3, opponentRosterId: 2 });
  });

  it("computes the current win streak by walking back from completedWeek", () => {
    // W (wk3), L (wk2), W (wk1) — streak breaks immediately at wk2.
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.winStreak).toBe(1);
    expect(alpha.lossStreak).toBe(0);
  });

  it("sums starter points by position for the completed week", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.starterPointsByPosition).toEqual({ QB: 10, RB: 2, WR: 3, TE: 0 });
  });

  it("flags the bench player who outscored a starter at the same position", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.benchOutperformers).toEqual([
      { playerId: "p5", name: "Wendy Bench", position: "WR", points: 20 },
    ]);
  });

  it("flags underperforming (non-TE) starters below the threshold, lowest first", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.underperformingStarters).toEqual([
      { playerId: "p7", name: "Wyatt Out", points: 0 },
      { playerId: "p2", name: "Ricky RB", points: 2 },
      { playerId: "p6", name: "Wes Starter", points: 3 },
    ]);
  });

  it("flags a starter who underperformed in all three of the last completed weeks", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.repeatUnderperformers).toEqual([{ playerId: "p2", name: "Ricky RB" }]);
  });

  it("flags the starter whose NFL team is on bye that week", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.byeStarters).toEqual([{ playerId: "p4", name: "Tommy TE" }]);
  });

  it("flags a 0-point starter with an Out status as out, but not the bye player", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.outStarters).toEqual([{ playerId: "p7", name: "Wyatt Out" }]);
  });

  it("prefers the Phase 10 snapshot over the heuristic when present", () => {
    const ctx = computeWeekContext({
      season: "2026",
      completedWeek: 3,
      upcomingWeek: 4,
      teams,
      rosters,
      matchupsByWeek,
      players,
      byeWeeks: { NE: 3 },
      outStatusSnapshot: { p6: "Out" }, // p6 has 3 pts and no injury_status — only the snapshot can flag it
    });
    expect(ctx.teams.get(1)!.outStarters).toEqual([{ playerId: "p6", name: "Wes Starter" }]);
  });

  it("flags a reserve player who scored in an earlier completed week", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.newIrPlayers).toEqual([{ playerId: "p8", name: "Reggie Reserve" }]);
  });

  it("reads taxi squad points for the completed week", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.taxiScores).toEqual([{ playerId: "p9", name: "Taylor Taxi", points: 6.7 }]);
  });

  it("pairs the upcoming opponent from the upcoming week's matchup group", () => {
    const alpha = buildCtx().teams.get(1)!;
    expect(alpha.opponentRosterId).toBe(2);
  });

  it("never throws when a roster has no matchup for the completed week", () => {
    const sparse = new Map<number, SleeperMatchup[]>([[3, []]]);
    expect(() =>
      computeWeekContext({
        season: "2026",
        completedWeek: 3,
        upcomingWeek: 4,
        teams,
        rosters,
        matchupsByWeek: sparse,
        players,
        byeWeeks: {},
        outStatusSnapshot: null,
      })
    ).not.toThrow();
  });
});
