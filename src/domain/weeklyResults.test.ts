import { describe, expect, it } from "vitest";
import { groupMatchupsByMatchupId, deriveWeekResults } from "./weeklyResults";
import type { SleeperMatchup } from "../api/types";

function matchup(rosterId: number, matchupId: number | null, points: number): SleeperMatchup {
  return { roster_id: rosterId, matchup_id: matchupId, points, starters: [], players: [], players_points: {} };
}

describe("groupMatchupsByMatchupId", () => {
  it("groups rosters sharing a matchup_id and drops entries with a null matchup_id", () => {
    const matchups = [matchup(1, 1, 100), matchup(2, 1, 90), matchup(3, null, 50)];
    const groups = groupMatchupsByMatchupId(matchups);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((m) => m.roster_id).sort()).toEqual([1, 2]);
  });
});

describe("deriveWeekResults", () => {
  it("assigns W/L to the higher/lower score and records the opponent for a normal head-to-head pair", () => {
    const matchups = [matchup(1, 1, 100), matchup(2, 1, 90)];
    const results = deriveWeekResults(5, matchups);

    const r1 = results.find((r) => r.rosterId === 1)!;
    const r2 = results.find((r) => r.rosterId === 2)!;
    expect(r1.result).toBe("W");
    expect(r1.opponentRosterId).toBe(2);
    expect(r2.result).toBe("L");
    expect(r2.opponentRosterId).toBe(1);
  });

  it("assigns a tie when both scores are equal", () => {
    const matchups = [matchup(1, 1, 100), matchup(2, 1, 100)];
    const results = deriveWeekResults(5, matchups);
    expect(results.every((r) => r.result === "T")).toBe(true);
  });

  it("gives a bye (a matchup_id shared by only one roster) a result with no opponent and no W/L/T, rather than guessing", () => {
    const matchups = [matchup(1, 9, 100)];
    const results = deriveWeekResults(5, matchups);
    expect(results).toEqual([
      { week: 5, rosterId: 1, opponentRosterId: null, actualPoints: 100, result: null },
    ]);
  });

  it("drops entries with a null matchup_id entirely (no result at all, not even an unresolved one)", () => {
    const matchups = [matchup(1, null, 100)];
    const results = deriveWeekResults(5, matchups);
    expect(results).toEqual([]);
  });
});
