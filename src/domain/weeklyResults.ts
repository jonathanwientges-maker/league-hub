import type { SleeperMatchup } from "../api/types";

export interface WeekResult {
  week: number;
  rosterId: number;
  opponentRosterId: number | null;
  actualPoints: number;
  result: "W" | "L" | "T" | null;
}

/** Groups a week's matchups by matchup_id. Each group should have exactly 2 rosters. */
export function groupMatchupsByMatchupId(
  matchups: SleeperMatchup[]
): SleeperMatchup[][] {
  const groups = new Map<number, SleeperMatchup[]>();
  for (const matchup of matchups) {
    if (matchup.matchup_id === null) continue;
    const group = groups.get(matchup.matchup_id) ?? [];
    group.push(matchup);
    groups.set(matchup.matchup_id, group);
  }
  return [...groups.values()];
}

/**
 * Derives each roster's result for one week: opponent, actual points, W/L/T.
 * A group that isn't exactly 2 rosters (bye week, malformed data) yields a
 * result with no opponent and no W/L/T rather than guessing.
 */
export function deriveWeekResults(
  week: number,
  matchups: SleeperMatchup[]
): WeekResult[] {
  const results: WeekResult[] = [];

  for (const group of groupMatchupsByMatchupId(matchups)) {
    if (group.length !== 2) {
      for (const m of group) {
        results.push({
          week,
          rosterId: m.roster_id,
          opponentRosterId: null,
          actualPoints: m.points,
          result: null,
        });
      }
      continue;
    }

    const [a, b] = group;
    let resultA: "W" | "L" | "T";
    let resultB: "W" | "L" | "T";
    if (a.points > b.points) {
      resultA = "W";
      resultB = "L";
    } else if (a.points < b.points) {
      resultA = "L";
      resultB = "W";
    } else {
      resultA = "T";
      resultB = "T";
    }

    results.push({
      week,
      rosterId: a.roster_id,
      opponentRosterId: b.roster_id,
      actualPoints: a.points,
      result: resultA,
    });
    results.push({
      week,
      rosterId: b.roster_id,
      opponentRosterId: a.roster_id,
      actualPoints: b.points,
      result: resultB,
    });
  }

  return results;
}

/** Flat list of every roster's result across every week supplied. */
export function buildAllWeekResults(
  matchupsByWeek: Map<number, SleeperMatchup[]>
): WeekResult[] {
  const all: WeekResult[] = [];
  for (const [week, matchups] of matchupsByWeek) {
    all.push(...deriveWeekResults(week, matchups));
  }
  return all;
}

/** Same data as buildAllWeekResults, grouped by rosterId for building Team.weeklyScores. */
export function buildWeekResultsByRoster(
  matchupsByWeek: Map<number, SleeperMatchup[]>
): Map<number, WeekResult[]> {
  const byRoster = new Map<number, WeekResult[]>();
  for (const result of buildAllWeekResults(matchupsByWeek)) {
    const list = byRoster.get(result.rosterId) ?? [];
    list.push(result);
    byRoster.set(result.rosterId, list);
  }
  return byRoster;
}
