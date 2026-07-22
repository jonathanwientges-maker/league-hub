import { groupMatchupsByMatchupId } from "../domain/weeklyResults";
import type { SleeperMatchup } from "../api/types";

export interface RivalEntry {
  rosterId: number;
  rivals: number[];
}

export interface RivalryGame {
  rosterIdA: number;
  rosterIdB: number;
  mutual: boolean;
}

function rivalDirections(
  entries: RivalEntry[],
  a: number,
  b: number
): { aToB: boolean; bToA: boolean } {
  return {
    aToB: entries.find((e) => e.rosterId === a)?.rivals.includes(b) ?? false,
    bToA: entries.find((e) => e.rosterId === b)?.rivals.includes(a) ?? false,
  };
}

/**
 * Rivalry games for one week's matchups, from the managers' self-picked
 * rivals (Home Page RivalPicker, stored in Supabase). Regular season only —
 * no rivalry weeks once the playoffs start.
 */
export function getRivalryGames(
  entries: RivalEntry[],
  week: number,
  matchups: SleeperMatchup[],
  playoffWeekStart: number
): RivalryGame[] {
  if (week >= playoffWeekStart || entries.length === 0) return [];

  const games: RivalryGame[] = [];
  for (const group of groupMatchupsByMatchupId(matchups)) {
    if (group.length !== 2) continue;
    const [a, b] = group;
    const { aToB, bToA } = rivalDirections(entries, a.roster_id, b.roster_id);
    if (aToB || bToA) {
      games.push({ rosterIdA: a.roster_id, rosterIdB: b.roster_id, mutual: aToB && bToA });
    }
  }
  return games;
}

/** The rivalry game a given roster is playing this week, if any. */
export function findRivalryGameFor(games: RivalryGame[], rosterId: number): RivalryGame | undefined {
  return games.find((g) => g.rosterIdA === rosterId || g.rosterIdB === rosterId);
}
