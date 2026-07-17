import { describe, expect, it } from "vitest";
import { resolveBracket, derivePlacements, buildHistoricDraftOrder, ordinal } from "./asPlayed";
import type { SleeperBracketMatchup, SleeperDraftPick, SleeperMatchup } from "../api/types";

const PLAYOFF_WEEK_START = 15;

function matchup(rosterId: number, points: number, matchupId: number): SleeperMatchup {
  return {
    roster_id: rosterId,
    matchup_id: matchupId,
    points,
    starters: [],
    players: [],
    players_points: {},
  };
}

// Mirrors the real 7-game shape confirmed against Sleeper's 2024/2025 data:
// 2 round-1 games, 2 round-2 semis + 1 round-2 placement (p:5), round-3
// championship (p:1) + 3rd place (p:3).
function buildFixtureGames(): SleeperBracketMatchup[] {
  return [
    { r: 1, m: 1, t1: 3, t2: 6, w: 3, l: 6 },
    { r: 1, m: 2, t1: 4, t2: 5, w: 4, l: 5 },
    { r: 2, m: 3, t1: 1, t2: null, w: 1, l: 3, t2_from: { w: 1 } }, // bye seed1 vs winner of m1
    { r: 2, m: 4, t1: 2, t2: null, w: 4, l: 2, t2_from: { w: 2 } }, // bye seed2 vs winner of m2
    { r: 2, m: 5, p: 5, t1: null, t2: null, w: 6, l: 5, t1_from: { l: 1 }, t2_from: { l: 2 } },
    { r: 3, m: 6, p: 1, t1: null, t2: null, w: 1, l: 4, t1_from: { w: 3 }, t2_from: { w: 4 } },
    { r: 3, m: 7, p: 3, t1: null, t2: null, w: 3, l: 2, t1_from: { l: 3 }, t2_from: { l: 4 } },
  ];
}

describe("resolveBracket", () => {
  it("resolves t1_from/t2_from chains to the correct roster ids", () => {
    const games = buildFixtureGames();
    const matchupsByWeek = new Map<number, SleeperMatchup[]>([
      [15, [matchup(3, 100, 1), matchup(6, 90, 1), matchup(4, 95, 2), matchup(5, 80, 2)]],
      [16, [matchup(1, 110, 1), matchup(3, 105, 1), matchup(2, 70, 2), matchup(4, 120, 2), matchup(6, 60, 3), matchup(5, 55, 3)]],
      [17, [matchup(1, 90, 1), matchup(4, 100, 1), matchup(3, 85, 2), matchup(2, 75, 2)]],
    ]);

    const bracket = resolveBracket(games, matchupsByWeek, PLAYOFF_WEEK_START);

    const s1 = bracket.games.find((g) => g.id === "S1")!;
    // S1 = seed1 (roster 1) vs winner of m1 (roster 3) — resolved via t2_from
    expect("rosterId" in s1.home && s1.home.rosterId).toBe(1);
    expect("rosterId" in s1.away && s1.away.rosterId).toBe(3);

    const consolation = bracket.games.find((g) => g.id === "CONSOLATION")!;
    // CONSOLATION = loser of m1 (6) vs loser of m2 (5) — resolved via t1_from/t2_from
    expect("rosterId" in consolation.home && consolation.home.rosterId).toBe(6);
    expect("rosterId" in consolation.away && consolation.away.rosterId).toBe(5);
  });

  it("maps p:1 -> FINAL and p:3 -> THIRD with the correct winners", () => {
    const games = buildFixtureGames();
    const matchupsByWeek = new Map<number, SleeperMatchup[]>();
    const bracket = resolveBracket(games, matchupsByWeek, PLAYOFF_WEEK_START);

    const final = bracket.games.find((g) => g.id === "FINAL")!;
    expect(final.winnerRosterId).toBe(1);

    const third = bracket.games.find((g) => g.id === "THIRD")!;
    expect(third.winnerRosterId).toBe(3);
  });

  it("attaches null scores but still shows the recorded winner when no matchup pairing is found", () => {
    const games = buildFixtureGames();
    // No matchups provided at all for week 17 (FINAL/THIRD) — simulates a
    // bye/ghost placement game with no real matchup data.
    const matchupsByWeek = new Map<number, SleeperMatchup[]>();

    const bracket = resolveBracket(games, matchupsByWeek, PLAYOFF_WEEK_START);
    const final = bracket.games.find((g) => g.id === "FINAL")!;

    expect(final.homeScore).toBeNull();
    expect(final.awayScore).toBeNull();
    expect(final.winnerRosterId).toBe(1); // still the bracket's recorded winner
    // resolveGameResult (pre-existing v1 logic, unmodified) treats "no
    // matchup data at all" as no contradiction found, not a mismatch warning.
    expect(final.pairingFoundInSleeper).toBe(true);
  });

  it("derives bye seeds structurally (roster in round-2 semis but not round-1)", () => {
    const games = buildFixtureGames();
    const bracket = resolveBracket(games, new Map(), PLAYOFF_WEEK_START);
    const byeRosterIds = bracket.seeds.map((s) => s.rosterId).sort();
    expect(byeRosterIds).toEqual([1, 2]);
  });
});

describe("derivePlacements", () => {
  it("orders FINAL winner/loser, THIRD winner/loser, CONSOLATION winner/loser, then non-playoff teams", () => {
    const games = buildFixtureGames();
    const bracket = resolveBracket(games, new Map(), PLAYOFF_WEEK_START);

    const placements = derivePlacements(bracket, [7, 8]);
    expect(placements.map((p) => p.rosterId)).toEqual([1, 4, 3, 2, 6, 5, 7, 8]);
    expect(placements.map((p) => p.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("buildHistoricDraftOrder", () => {
  it("keeps only round 1, sorted by pick_no, labeled 1.0N", () => {
    const picks: SleeperDraftPick[] = [
      { pick_no: 2, round: 1, roster_id: 11, player_id: "p2", picked_by: "u2", draft_slot: 2, metadata: {} },
      { pick_no: 13, round: 2, roster_id: 11, player_id: "p13", picked_by: "u2", draft_slot: 1, metadata: {} },
      { pick_no: 1, round: 1, roster_id: 8, player_id: "p1", picked_by: "u1", draft_slot: 1, metadata: {} },
    ];

    const order = buildHistoricDraftOrder(picks);
    expect(order).toEqual([
      { pick: "1.01", rosterId: 8, source: "As drafted" },
      { pick: "1.02", rosterId: 11, source: "As drafted" },
    ]);
  });
});

describe("ordinal", () => {
  it("handles the 11/12/13 special case and standard suffixes", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
  });
});
