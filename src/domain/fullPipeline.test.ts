import { describe, expect, it } from "vitest";
import { assembleTeams } from "./team";
import { buildPlayoffBracket } from "./playoffBracket";
import { buildPickRace, buildDraftOrder } from "./pickPlacement";
import type { SleeperRoster, SleeperUser, SleeperMatchup } from "../api/types";

/**
 * End-to-end regression test: fixture Sleeper API payloads (rosters, users)
 * through the entire custom-rules pipeline (Phases 2-5) to a final 1.01-1.12
 * DraftPick[]. Each stage already has focused unit tests elsewhere
 * (team.test.ts, playoffBracket.test.ts, pickPlacement.test.ts); this test's
 * job is catching wiring breaks BETWEEN stages that isolated unit tests,
 * each stubbing their own inputs, wouldn't see — e.g. determineSeeds'
 * output failing to flow into buildPlayoffBracket, or buildPlayoffBracket's
 * games failing to flow into buildDraftOrder alongside buildPickRace's.
 *
 * Potential Points are hand-set after assembly rather than derived from a
 * multi-week lineup fixture — the optimal-lineup solver itself is already
 * covered exhaustively in potentialPoints.test.ts, so re-deriving it here
 * would just be a slower, less legible duplicate of that coverage.
 */

function roster(
  rosterId: number,
  division: number,
  wins: number,
  losses: number
): SleeperRoster {
  return {
    roster_id: rosterId,
    owner_id: `owner${rosterId}`,
    league_id: "test-league",
    players: [],
    starters: [],
    settings: {
      wins,
      losses,
      ties: 0,
      fpts: 1000 + rosterId,
      fpts_decimal: 0,
      fpts_against: 1000,
      fpts_against_decimal: 0,
      division,
    },
  };
}

function user(rosterId: number): SleeperUser {
  return {
    user_id: `owner${rosterId}`,
    display_name: `Manager ${rosterId}`,
    avatar: null,
    metadata: { team_name: `T${rosterId}` },
  };
}

function matchup(rosterId: number, matchupId: number, points: number): SleeperMatchup {
  return { roster_id: rosterId, matchup_id: matchupId, points, starters: [], players: [], players_points: {} };
}

describe("full custom-rules pipeline (fixture rosters -> DraftPick[])", () => {
  // Division 1: T1 (13-1, best) / T2 (10-4) / T3 (5-9) / T4 (2-12)
  // Division 2: T5 (11-3)      / T6 (8-6)  / T7 (4-10) / T8 (1-13)
  // Division 3: T9 (9-5)       / T10 (7-7) / T11 (6-8) / T12 (3-11)
  // All win totals globally distinct -> no tiebreakers involved, isolating
  // this test to pipeline wiring rather than re-testing tiebreak logic.
  const rosters: SleeperRoster[] = [
    roster(1, 1, 13, 1),
    roster(2, 1, 10, 4),
    roster(3, 1, 5, 9),
    roster(4, 1, 2, 12),
    roster(5, 2, 11, 3),
    roster(6, 2, 8, 6),
    roster(7, 2, 4, 10),
    roster(8, 2, 1, 13),
    roster(9, 3, 9, 5),
    roster(10, 3, 7, 7),
    roster(11, 3, 6, 8),
    roster(12, 3, 3, 11),
  ];
  const users: SleeperUser[] = rosters.map((r) => user(r.roster_id));

  const baseTeams = assembleTeams(rosters, users, new Map());
  // Potential Points, ascending: T8(700) T4(800) T12(850) T7(900) T3(1000) T11(1100).
  const potentialPointsByRoster: Record<number, number> = {
    1: 0, 2: 0, 5: 0, 6: 0, 9: 0, 10: 0, // playoff teams -- PP irrelevant to them
    3: 1000, 4: 800, 7: 900, 8: 700, 11: 1100, 12: 850,
  };
  const teams = baseTeams.map((t) => ({
    ...t,
    potentialPointsTotal: potentialPointsByRoster[t.rosterId],
  }));

  const playoffWeekStart = 2;
  // Divisions winners T1(.929) > T5(.786) > T9(.643) -> seed1/2/3.
  // Second-place T2(.714) > T6(.571) > T10(.429) -> seed4/5/6.
  // Wildcard: W1 = seed3(T9) vs seed6(T10); W2 = seed4(T2) vs seed5(T6).
  const week2: SleeperMatchup[] = [
    matchup(9, 1, 110), matchup(10, 1, 90), // W1: T9 beats T10
    matchup(2, 2, 115), matchup(6, 2, 95), // W2: T2 beats T6
    matchup(8, 3, 70), matchup(4, 3, 85), // Pick Group A semi: T4 beats T8
    matchup(7, 4, 60), matchup(3, 4, 75), // Pick Group B semi: T3 beats T7
  ];
  // Reseed among {T1(.929), T5(.786), winnerW1=T9(.643), winnerW2=T2(.714)}:
  // ranked T1 > T5 > T2 > T9 -> S1 = best(T1) vs worst(T9); S2 = T5 vs T2.
  const week3: SleeperMatchup[] = [
    matchup(1, 5, 130), matchup(9, 5, 100), // S1: T1 beats T9
    matchup(5, 6, 120), matchup(2, 6, 110), // S2: T5 beats T2
    matchup(12, 7, 95), matchup(4, 7, 105), // Pick Group A final: T4 beats T12 (the bye) -> 1.01
    matchup(11, 8, 100), matchup(3, 8, 115), // Pick Group B final: T3 beats T11 (the bye) -> 1.04
  ];
  const week4: SleeperMatchup[] = [
    matchup(1, 9, 140), matchup(5, 9, 125), // FINAL: T1 champion
    matchup(9, 10, 105), matchup(2, 10, 115), // THIRD: T2 takes 3rd
    matchup(10, 11, 90), matchup(6, 11, 95), // CONSOLATION: T6 wins (better pick, 1.07)
  ];

  const bracket = buildPlayoffBracket({
    teams,
    h2hMap: {},
    playoffWeekStart,
    currentWeek: Infinity,
    matchupsByWeek: new Map([
      [2, week2],
      [3, week3],
      [4, week4],
    ]),
  });

  const pickRace = buildPickRace({
    teams,
    h2hMap: {},
    playoffWeekStart,
    currentWeek: Infinity,
    semiWeekMatchups: week2,
    finalWeekMatchups: week3,
    losersBracket: [],
  });

  it("seeds the playoff field correctly from assembled team records", () => {
    const bySeed = Object.fromEntries(bracket.seeds.map((s) => [s.seed, s.rosterId]));
    expect(bySeed).toEqual({ 1: 1, 2: 5, 3: 9, 4: 2, 5: 6, 6: 10 });
  });

  it("resolves the reseeded semifinals correctly (T9 upsets into the bracket but reseeds to face the #1 overall record)", () => {
    const s1 = bracket.games.find((g) => g.id === "S1")!;
    const s2 = bracket.games.find((g) => g.id === "S2")!;
    expect(s1.reseeded).toBe(true);
    expect([s1.home, s1.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()).toEqual([1, 9]);
    expect([s2.home, s2.away].map((p) => ("rosterId" in p ? p.rosterId : null)).sort()).toEqual([2, 5]);
  });

  it("splits the pick-race pool correctly by Potential Points", () => {
    expect(pickRace.groupA.rosterIds.sort((a, b) => a - b)).toEqual([4, 8, 12]);
    expect(pickRace.groupB.rosterIds.sort((a, b) => a - b)).toEqual([3, 7, 11]);
    expect(pickRace.groupA.byeRosterId).toBe(12); // best record among {8, 4, 12}
    expect(pickRace.groupB.byeRosterId).toBe(11); // best record among {7, 3, 11}
  });

  it("produces the complete, correct 1.01-1.12 draft order from the full pipeline", () => {
    const draftOrder = buildDraftOrder(pickRace, bracket.games);
    const byPick = Object.fromEntries(draftOrder.map((p) => [p.pick, p.rosterId]));

    expect(byPick).toEqual({
      "1.01": 4, // Group A final winner
      "1.02": 12, // Group A final loser (the bye)
      "1.03": 8, // Group A semifinal loser
      "1.04": 3, // Group B final winner
      "1.05": 11, // Group B final loser (the bye)
      "1.06": 7, // Group B semifinal loser
      "1.07": 6, // consolation WINNER (intentional inversion)
      "1.08": 10, // consolation loser
      "1.09": 9, // 3rd-place game loser (4th place)
      "1.10": 2, // 3rd-place game winner (3rd place)
      "1.11": 5, // championship loser (runner-up)
      "1.12": 1, // league champion
    });
  });
});
