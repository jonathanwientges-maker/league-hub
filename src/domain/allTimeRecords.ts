import type { SeasonRef } from "./seasonChain";
import type { Team } from "./types";

export interface SeasonRecordInput {
  season: SeasonRef;
  teams: Team[];
  championRosterId: number | null;
}

export interface ManagerAllTimeRecord {
  ownerId: string;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  championships: number;
}

interface WeekHighlight {
  ownerId: string;
  displayName: string;
  season: string;
  week: number;
  points: number;
}

interface EfficiencyHighlight {
  ownerId: string;
  displayName: string;
  season: string;
  efficiencyPct: number;
}

export interface AllTimeRecords {
  managers: ManagerAllTimeRecord[];
  highestActualWeek: WeekHighlight | null;
  highestOptimalWeek: WeekHighlight | null;
  bestSeasonEfficiency: EfficiencyHighlight | null;
}

/**
 * Aggregates across every season already loaded. Managers are matched by
 * ownerId (Sleeper's user_id) — NOT rosterId, which is scoped to a single
 * league/season and means nothing across the chain.
 */
export function computeAllTimeRecords(seasons: SeasonRecordInput[]): AllTimeRecords {
  const managers = new Map<string, ManagerAllTimeRecord>();
  let highestActualWeek: WeekHighlight | null = null;
  let highestOptimalWeek: WeekHighlight | null = null;
  let bestSeasonEfficiency: EfficiencyHighlight | null = null;

  for (const { season, teams, championRosterId } of seasons) {
    for (const team of teams) {
      const existing = managers.get(team.ownerId) ?? {
        ownerId: team.ownerId,
        displayName: team.teamName,
        wins: 0,
        losses: 0,
        ties: 0,
        championships: 0,
      };
      existing.wins += team.wins;
      existing.losses += team.losses;
      existing.ties += team.ties;
      existing.displayName = team.teamName;
      if (championRosterId !== null && team.rosterId === championRosterId) {
        existing.championships += 1;
      }
      managers.set(team.ownerId, existing);

      for (const week of team.weeklyScores) {
        if (!highestActualWeek || week.actualPoints > highestActualWeek.points) {
          highestActualWeek = {
            ownerId: team.ownerId,
            displayName: team.teamName,
            season: season.season,
            week: week.week,
            points: week.actualPoints,
          };
        }
        if (!highestOptimalWeek || week.optimalPoints > highestOptimalWeek.points) {
          highestOptimalWeek = {
            ownerId: team.ownerId,
            displayName: team.teamName,
            season: season.season,
            week: week.week,
            points: week.optimalPoints,
          };
        }
      }

      const efficiencyPct =
        team.potentialPointsTotal > 0 ? (team.pointsFor / team.potentialPointsTotal) * 100 : 0;
      if (!bestSeasonEfficiency || efficiencyPct > bestSeasonEfficiency.efficiencyPct) {
        bestSeasonEfficiency = {
          ownerId: team.ownerId,
          displayName: team.teamName,
          season: season.season,
          efficiencyPct,
        };
      }
    }
  }

  const managersList = [...managers.values()].sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    const aPct = a.wins / Math.max(1, a.wins + a.losses + a.ties);
    const bPct = b.wins / Math.max(1, b.wins + b.losses + b.ties);
    return bPct - aPct;
  });

  return { managers: managersList, highestActualWeek, highestOptimalWeek, bestSeasonEfficiency };
}

export interface HeadToHeadRecord {
  winsA: number;
  winsB: number;
  ties: number;
  meetings: number;
}

/**
 * Order-independent key for a pair of managers — shared by
 * scripts/generate-all-time-h2h.ts (which writes records keyed this way)
 * and useAllTimeHeadToHead.ts (which reads them back), so the two can never
 * drift into using different key shapes for the same pair.
 */
export function headToHeadPairKey(ownerIdA: string, ownerIdB: string): string {
  return [ownerIdA, ownerIdB].sort().join("|");
}

/**
 * Tallies two managers' regular-season results against each other across
 * every season supplied — the all-time record shown on the Rivalry Game
 * cards (Home screen). Matched by ownerId, not rosterId: a manager's roster
 * gets a new rosterId every season (allTimeRecords' own rule, see
 * ManagerAllTimeRecord above), so weeklyScores.opponentRosterId is only
 * meaningful once resolved back to an ownerId within that same season.
 * Playoff/consolation meetings count too — regular-season-only filtering is
 * rivalries.ts's rule (its rivalry-game slotting only runs pre-playoffs),
 * not a property of "these two teams played" history.
 */
export function computeAllTimeHeadToHead(
  seasons: { teams: Team[] }[],
  ownerIdA: string,
  ownerIdB: string
): HeadToHeadRecord {
  let winsA = 0;
  let winsB = 0;
  let ties = 0;

  for (const { teams } of seasons) {
    const ownerByRosterId = new Map(teams.map((t) => [t.rosterId, t.ownerId]));
    const teamA = teams.find((t) => t.ownerId === ownerIdA);
    if (!teamA) continue;

    for (const week of teamA.weeklyScores) {
      if (week.opponentRosterId === null || week.result === null) continue;
      if (ownerByRosterId.get(week.opponentRosterId) !== ownerIdB) continue;

      if (week.result === "W") winsA += 1;
      else if (week.result === "L") winsB += 1;
      else ties += 1;
    }
  }

  return { winsA, winsB, ties, meetings: winsA + winsB + ties };
}
