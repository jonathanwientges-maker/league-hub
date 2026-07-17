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
