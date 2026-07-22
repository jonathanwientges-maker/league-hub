import { describe, expect, it } from "vitest";
import { getRivalryGames, findRivalryGameFor, type RivalEntry } from "./rivals";
import type { SleeperMatchup } from "../api/types";

const ENTRIES: RivalEntry[] = [
  { rosterId: 1, rivals: [2] }, // one-sided: 1 -> 2
  { rosterId: 3, rivals: [4] }, // mutual with 4
  { rosterId: 4, rivals: [3] },
];

function matchup(rosterId: number, matchupId: number): SleeperMatchup {
  return { roster_id: rosterId, matchup_id: matchupId, points: 0, starters: [], players: [], players_points: {} };
}

describe("getRivalryGames", () => {
  it("detects a one-sided rivalry pair as non-mutual", () => {
    const matchups = [matchup(1, 1), matchup(2, 1), matchup(5, 2), matchup(6, 2)];
    const games = getRivalryGames(ENTRIES, 3, matchups, 15);
    expect(games).toEqual([{ rosterIdA: 1, rosterIdB: 2, mutual: false }]);
  });

  it("detects a mutual rivalry pair", () => {
    const matchups = [matchup(3, 1), matchup(4, 1)];
    const games = getRivalryGames(ENTRIES, 3, matchups, 15);
    expect(games).toEqual([{ rosterIdA: 3, rosterIdB: 4, mutual: true }]);
  });

  it("returns nothing once the playoffs start", () => {
    const matchups = [matchup(3, 1), matchup(4, 1)];
    expect(getRivalryGames(ENTRIES, 15, matchups, 15)).toEqual([]);
  });

  it("returns nothing when no one has picked rivals yet", () => {
    const matchups = [matchup(3, 1), matchup(4, 1)];
    expect(getRivalryGames([], 3, matchups, 15)).toEqual([]);
  });

  it("ignores pairs that aren't rivals", () => {
    const matchups = [matchup(5, 1), matchup(6, 1)];
    expect(getRivalryGames(ENTRIES, 3, matchups, 15)).toEqual([]);
  });
});

describe("findRivalryGameFor", () => {
  it("finds the game a roster is playing in, from either side", () => {
    const games = [{ rosterIdA: 1, rosterIdB: 2, mutual: false }];
    expect(findRivalryGameFor(games, 1)).toBe(games[0]);
    expect(findRivalryGameFor(games, 2)).toBe(games[0]);
    expect(findRivalryGameFor(games, 3)).toBeUndefined();
  });
});
