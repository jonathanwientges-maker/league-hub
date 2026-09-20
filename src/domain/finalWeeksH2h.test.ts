import { describe, expect, it } from "vitest";
import type { SleeperMatchup } from "../api/types";
import { buildAllWeekResults } from "./weeklyResults";
import { buildH2hMap } from "./h2h";
import { isWeekFinal } from "./potentialPoints";

// Regression test for the exact bug reported live: Sleeper serves partial,
// still-changing scores for the current week (and a 0-0 placeholder for
// future weeks) well before it settles into roster.settings. Reading those
// as decided games let an in-progress matchup's leader flip a head-to-head
// tiebreaker before the week was actually over (see useTeams.ts, which
// filters matchupsByWeek to isWeekFinal before deriving h2h from it).
describe("building h2h from only final weeks", () => {
  function matchup(rosterId: number, matchupId: number, points: number): SleeperMatchup {
    return { roster_id: rosterId, matchup_id: matchupId, points } as SleeperMatchup;
  }

  it("excludes the current, still-in-progress week from head-to-head results", () => {
    const week1: SleeperMatchup[] = [
      matchup(3, 1, 183.74), // final: roster 3 beat roster 10
      matchup(10, 1, 104.56),
    ];
    // Week 2 is live: roster 9 is currently ahead of roster 3, but the week
    // isn't over yet (currentWeek === 2, so week 2 is not final).
    const week2: SleeperMatchup[] = [
      matchup(3, 1, 15.5),
      matchup(9, 1, 26.2),
    ];

    const currentWeek = 2;
    const matchupsByWeek = new Map([
      [1, week1],
      [2, week2],
    ]);

    const finalOnly = new Map(
      [...matchupsByWeek].filter(([week]) => isWeekFinal(week, currentWeek))
    );

    const h2hMap = buildH2hMap(buildAllWeekResults(finalOnly));

    // Roster 3 and 9 have not played a completed game against each other —
    // the live week-2 game must not appear in either side's h2h record.
    expect(h2hMap[3]?.[9]).toBeUndefined();
    expect(h2hMap[9]?.[3]).toBeUndefined();
  });

  it("includes a week once it's no longer the current week", () => {
    const week1: SleeperMatchup[] = [matchup(3, 1, 183.74), matchup(10, 1, 104.56)];
    const week2: SleeperMatchup[] = [matchup(3, 1, 50), matchup(9, 1, 60)];

    const currentWeek = 3; // both weeks 1 and 2 are now in the past
    const matchupsByWeek = new Map([
      [1, week1],
      [2, week2],
    ]);

    const finalOnly = new Map(
      [...matchupsByWeek].filter(([week]) => isWeekFinal(week, currentWeek))
    );

    const h2hMap = buildH2hMap(buildAllWeekResults(finalOnly));

    expect(h2hMap[9]?.[3]).toEqual({ wins: 1, losses: 0, ties: 0 });
    expect(h2hMap[3]?.[9]).toEqual({ wins: 0, losses: 1, ties: 0 });
  });
});
