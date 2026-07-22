import type { Team } from "../domain/types";
import type { RivalEntry } from "./rivals";

export interface RivalryRecord {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

export interface RivalryGameLogEntry {
  week: number;
  rosterIdA: number;
  rosterIdB: number;
  pointsA: number;
  pointsB: number;
  mutual: boolean;
}

function rivalryPairing(entries: RivalEntry[], a: number, b: number): { isRivalry: boolean; mutual: boolean } {
  const aToB = entries.find((e) => e.rosterId === a)?.rivals.includes(b) ?? false;
  const bToA = entries.find((e) => e.rosterId === b)?.rivals.includes(a) ?? false;
  return { isRivalry: aToB || bToA, mutual: aToB && bToA };
}

function emptyRecord(rosterId: number): RivalryRecord {
  return { rosterId, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0 };
}

/**
 * Season-long rivalry win/loss tracking, aggregated straight from each
 * team's already-computed weeklyScores (no separate matchup fetch needed —
 * useTeams already covers the whole regular season). Regular season only,
 * same rule as getRivalryGames(); one-sided rivalry picks count exactly the
 * same as mutual ones, matching detection everywhere else in the app.
 */
export function computeRivalryStandings(
  teams: Team[],
  entries: RivalEntry[],
  playoffWeekStart: number
): { records: Map<number, RivalryRecord>; gameLog: RivalryGameLogEntry[] } {
  const pointsByRosterWeek = new Map<string, number>();
  for (const team of teams) {
    for (const w of team.weeklyScores) {
      pointsByRosterWeek.set(`${team.rosterId}-${w.week}`, w.actualPoints);
    }
  }

  const records = new Map<number, RivalryRecord>();
  for (const team of teams) {
    records.set(team.rosterId, emptyRecord(team.rosterId));
  }

  const gameLog: RivalryGameLogEntry[] = [];

  for (const team of teams) {
    for (const w of team.weeklyScores) {
      if (w.opponentRosterId === null || w.result === null) continue;
      if (w.week >= playoffWeekStart) continue;

      const { isRivalry, mutual } = rivalryPairing(entries, team.rosterId, w.opponentRosterId);
      if (!isRivalry) continue;

      const record = records.get(team.rosterId);
      if (!record) continue;

      const opponentPoints = pointsByRosterWeek.get(`${w.opponentRosterId}-${w.week}`) ?? 0;
      record.gamesPlayed += 1;
      record.pointsFor += w.actualPoints;
      record.pointsAgainst += opponentPoints;
      if (w.result === "W") record.wins += 1;
      else if (w.result === "L") record.losses += 1;
      else record.ties += 1;

      // Each pairing is walked from both teams' perspectives — only log it once.
      if (team.rosterId < w.opponentRosterId) {
        gameLog.push({
          week: w.week,
          rosterIdA: team.rosterId,
          rosterIdB: w.opponentRosterId,
          pointsA: w.actualPoints,
          pointsB: opponentPoints,
          mutual,
        });
      }
    }
  }

  gameLog.sort((a, b) => b.week - a.week);

  return { records, gameLog };
}

export interface RivalryStandingRow {
  rosterId: number;
  teamName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

/**
 * Splits every team into the ranked table (at least one rivalry game played)
 * and "Zarte Lämmer" (none yet) — ranked by rivalry win%, then rivalry PF.
 */
export function buildRivalryRanking(
  teams: Team[],
  records: Map<number, RivalryRecord>
): { ranking: RivalryStandingRow[]; lambs: RivalryStandingRow[] } {
  const rows: RivalryStandingRow[] = teams.map((team) => {
    const record = records.get(team.rosterId) ?? emptyRecord(team.rosterId);
    return {
      rosterId: team.rosterId,
      teamName: team.teamName,
      avatarUrl: team.avatarUrl,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pointsFor: record.pointsFor,
      pointsAgainst: record.pointsAgainst,
      gamesPlayed: record.gamesPlayed,
    };
  });

  const ranking = rows
    .filter((r) => r.gamesPlayed > 0)
    .sort((a, b) => {
      const winPctA = (a.wins + a.ties * 0.5) / a.gamesPlayed;
      const winPctB = (b.wins + b.ties * 0.5) / b.gamesPlayed;
      if (winPctB !== winPctA) return winPctB - winPctA;
      return b.pointsFor - a.pointsFor;
    });

  const lambs = rows.filter((r) => r.gamesPlayed === 0);

  return { ranking, lambs };
}
