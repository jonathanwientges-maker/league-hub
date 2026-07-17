import { describe, expect, it } from "vitest";
import { computeOptimalLineup, resolveCurrentWeek } from "./potentialPoints";
import type { SleeperLeague, NflState } from "../api/types";

describe("computeOptimalLineup", () => {
  it("places a multi-position player (RB/WR) into FLEX when that's the highest-value use of the roster, beating a greedy fill", () => {
    // Greedy ("fill required slots first, then FLEX") would put RB1 in RB,
    // WR1 in WR, and RBWR1 (worth more than either) stuck outside the
    // lineup if it filled slots in a fixed order that already used up RB/WR
    // with lower scorers. The exact solver must find the true best total.
    const players = ["RB1", "WR1", "RBWR1"];
    const playersPoints = { RB1: 10, WR1: 8, RBWR1: 20 };
    const startingSlots = ["RB", "WR", "FLEX"];
    const playerPositions = new Map([
      ["RB1", ["RB"]],
      ["WR1", ["WR"]],
      ["RBWR1", ["RB", "WR"]],
    ]);

    const result = computeOptimalLineup(players, playersPoints, startingSlots, playerPositions);

    expect(result.optimalPoints).toBe(38); // RB1(10) + WR1(8) + RBWR1(20), all three used
    expect(result.optimalLineup.find((s) => s.slot === "FLEX")?.playerId).toBe("RBWR1");
  });

  it("treats a missing players_points entry as 0, not a crash or NaN", () => {
    const players = ["QB1", "QB2"];
    const playersPoints = { QB1: 15 }; // QB2 has no entry
    const startingSlots = ["QB"];
    const playerPositions = new Map([
      ["QB1", ["QB"]],
      ["QB2", ["QB"]],
    ]);

    const result = computeOptimalLineup(players, playersPoints, startingSlots, playerPositions);

    expect(result.optimalPoints).toBe(15);
    expect(result.optimalLineup[0].playerId).toBe("QB1");
  });

  it("in a SUPER_FLEX league shape, admits a second QB into SUPER_FLEX over a lower-scoring RB", () => {
    const players = ["QB1", "QB2", "RB1"];
    const playersPoints = { QB1: 25, QB2: 22, RB1: 12 };
    const startingSlots = ["QB", "SUPER_FLEX"];
    const playerPositions = new Map([
      ["QB1", ["QB"]],
      ["QB2", ["QB"]],
      ["RB1", ["RB"]],
    ]);

    const result = computeOptimalLineup(players, playersPoints, startingSlots, playerPositions);

    expect(result.optimalPoints).toBe(47); // QB1 + QB2, not QB1 + RB1 (37)
  });

  it("leaves a slot empty (not a crash) when the roster has no eligible player for it", () => {
    const players = ["WR1"];
    const playersPoints = { WR1: 10 };
    const startingSlots = ["QB", "WR"];
    const playerPositions = new Map([["WR1", ["WR"]]]);

    const result = computeOptimalLineup(players, playersPoints, startingSlots, playerPositions);

    expect(result.optimalPoints).toBe(10);
    expect(result.optimalLineup.find((s) => s.slot === "QB")?.playerId).toBeNull();
  });

  it("solves a real-shaped roster (35 players, 9 starting slots) fast enough to not hang the UI", () => {
    const startingSlots = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX"];
    const positions = ["QB", "RB", "WR", "TE"];
    const players: string[] = [];
    const playersPoints: Record<string, number> = {};
    const playerPositions = new Map<string, string[]>();
    for (let i = 0; i < 35; i++) {
      const id = `P${i}`;
      players.push(id);
      playersPoints[id] = (i * 7) % 30; // deterministic, no randomness in a test
      playerPositions.set(id, [positions[i % positions.length]]);
    }

    const start = performance.now();
    const result = computeOptimalLineup(players, playersPoints, startingSlots, playerPositions);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.optimalPoints).toBeGreaterThan(0);
    // Every filled slot must actually be eligible for what's assigned to it.
    for (const assignment of result.optimalLineup) {
      if (!assignment.playerId) continue;
      const idx = players.indexOf(assignment.playerId);
      const pos = playerPositions.get(assignment.playerId)![0];
      expect(idx).toBeGreaterThanOrEqual(0);
      if (assignment.slot === "FLEX") {
        expect(["RB", "WR", "TE"]).toContain(pos);
      } else {
        expect(pos).toBe(assignment.slot);
      }
    }
  });
});

describe("resolveCurrentWeek", () => {
  function league(overrides: Partial<SleeperLeague>): SleeperLeague {
    return {
      league_id: "1",
      name: "Test League",
      season: "2025",
      sport: "nfl",
      status: "in_season",
      total_rosters: 12,
      settings: { playoff_week_start: 15 },
      scoring_settings: {},
      roster_positions: [],
      avatar: null,
      previous_league_id: null,
      draft_id: null,
      ...overrides,
    };
  }

  function nflState(overrides: Partial<NflState>): NflState {
    return {
      week: 0,
      season_type: "off",
      season: "2026",
      previous_season: "2025",
      leg: 0,
      league_season: "2026",
      league_create_season: "2026",
      display_week: 0,
      ...overrides,
    };
  }

  it("returns the real NFL week while the league's own season matches the live one", () => {
    const week = resolveCurrentWeek(
      league({ status: "in_season", season: "2026" }),
      nflState({ week: 8, season: "2026" })
    );
    expect(week).toBe(8);
  });

  it("returns Infinity (treat every week as final) once the league itself is marked complete", () => {
    const week = resolveCurrentWeek(
      league({ status: "complete", season: "2025" }),
      nflState({ week: 0, season: "2026" })
    );
    expect(week).toBe(Infinity);
  });

  it("returns Infinity for a past season's league even if its status were stale, because the season year no longer matches live NFL state", () => {
    const week = resolveCurrentWeek(
      league({ status: "in_season", season: "2025" }),
      nflState({ week: 0, season: "2026" })
    );
    expect(week).toBe(Infinity);
  });
});
