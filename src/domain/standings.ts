import { LEAGUE_CONFIG } from "../config/league";
import type { H2hMap, Team } from "./types";

export function winPercentage(team: Team): number {
  const games = team.wins + team.losses + team.ties;
  if (games === 0) return 0;
  return (team.wins + team.ties * 0.5) / games;
}

/**
 * A team's win% counting only games against the other teams in `group`.
 * Returns null when the team has no recorded games against anyone else in
 * the group (e.g. an odd tie group where not everyone played everyone) —
 * callers should treat that as "unresolved by h2h" and fall through to the
 * next tiebreaker rather than reading it as a 0% record.
 */
function h2hWinPercentageWithinGroup(
  team: Team,
  group: Team[],
  h2hMap: H2hMap
): number | null {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const record = h2hMap[team.rosterId];

  if (record) {
    for (const opponent of group) {
      if (opponent.rosterId === team.rosterId) continue;
      const vs = record[opponent.rosterId];
      if (!vs) continue;
      wins += vs.wins;
      losses += vs.losses;
      ties += vs.ties;
    }
  }

  const games = wins + losses + ties;
  if (games === 0) return null;
  return (wins + ties * 0.5) / games;
}

/**
 * Recursively narrows a tied group using the tiebreaker order, one
 * tiebreaker at a time: teams that remain tied after "h2h" only get
 * compared to each other by "pointsFor", never re-mixed with teams the
 * first tiebreaker already separated.
 */
function resolveTieGroup(
  group: Team[],
  h2hMap: H2hMap,
  tiebreakers: readonly string[]
): Team[] {
  if (group.length <= 1 || tiebreakers.length === 0) return group;

  const [current, ...rest] = tiebreakers;

  let keyed: Array<{ team: Team; key: number }>;
  if (current === "h2h") {
    const scores = group.map((team) => ({
      team,
      key: h2hWinPercentageWithinGroup(team, group, h2hMap),
    }));
    if (scores.every((s) => s.key === null)) {
      return resolveTieGroup(group, h2hMap, rest);
    }
    keyed = scores.map((s) => ({ team: s.team, key: s.key ?? -1 }));
  } else {
    // "pointsFor" / "actualPointsFor" — same signal, different tiebreaker lists.
    keyed = group.map((team) => ({ team, key: team.pointsFor }));
  }

  const distinctKeysDescending = [...new Set(keyed.map((k) => k.key))].sort(
    (a, b) => b - a
  );

  return distinctKeysDescending.flatMap((keyValue) =>
    resolveTieGroup(
      keyed.filter((k) => k.key === keyValue).map((k) => k.team),
      h2hMap,
      rest
    )
  );
}

/**
 * Ranks teams by win%, breaking ties via LEAGUE_CONFIG.tiebreakers.seeding
 * (default: head-to-head among the tied teams, then total points for).
 * Configurable so a league can reorder or drop tiebreakers without touching
 * this function.
 */
export function rankByRecord(
  teams: Team[],
  h2hMap: H2hMap,
  tiebreakers: readonly string[] = LEAGUE_CONFIG.tiebreakers.seeding
): Team[] {
  const sorted = [...teams].sort(
    (a, b) => winPercentage(b) - winPercentage(a)
  );

  const groups: Team[][] = [];
  for (const team of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && winPercentage(lastGroup[0]) === winPercentage(team)) {
      lastGroup.push(team);
    } else {
      groups.push([team]);
    }
  }

  return groups.flatMap((group) => resolveTieGroup(group, h2hMap, tiebreakers));
}

export interface DivisionStanding {
  division: number;
  rank: number; // 1-4
  team: Team;
  isPlayoffPosition: boolean; // rank 1-2 qualify for the playoffs; 3-4 enter the pick race
}

/** Per-division ranked standings 1-4, per Step 3.4. */
export function rankDivisions(teams: Team[], h2hMap: H2hMap): DivisionStanding[] {
  const byDivision = new Map<number, Team[]>();
  for (const team of teams) {
    const list = byDivision.get(team.division) ?? [];
    list.push(team);
    byDivision.set(team.division, list);
  }

  const standings: DivisionStanding[] = [];
  for (const [division, divisionTeams] of byDivision) {
    const ranked = rankByRecord(divisionTeams, h2hMap);
    ranked.forEach((team, i) => {
      standings.push({
        division,
        rank: i + 1,
        team,
        isPlayoffPosition: i < 2,
      });
    });
  }

  return standings.sort((a, b) => a.division - b.division || a.rank - b.rank);
}
