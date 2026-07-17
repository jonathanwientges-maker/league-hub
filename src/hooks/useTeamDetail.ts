import { useTeams } from "./useTeams";
import { useLeague } from "./useLeague";
import { usePlayers } from "./usePlayers";
import { useRegularSeasonMatchups } from "./useMatchups";
import {
  getStartingSlots,
  buildPlayerPositionsMap,
  computeOptimalLineup,
  buildActualLineup,
} from "../domain/potentialPoints";
import type { SlotAssignment } from "../domain/potentialPoints";
import { LEAGUE_CONFIG } from "../config/league";

export interface TeamWeekDetail {
  week: number;
  opponentRosterId: number | null;
  actualPoints: number;
  optimalPoints: number;
  benchPointsLost: number;
  result: "W" | "L" | "T" | null;
  actualLineup: SlotAssignment[];
  optimalLineup: SlotAssignment[];
}

/**
 * Per-week actual vs optimal lineups for one team's detail page. Kept
 * separate from useTeams (which only carries season totals) so pages that
 * don't need lineup-level detail don't pay for it.
 */
export function useTeamDetail(leagueId: string, rosterId: number) {
  const teamsResult = useTeams(leagueId);
  const leagueQuery = useLeague(leagueId);
  const playersQuery = usePlayers();
  const currentWeek = teamsResult.data?.currentWeek;

  const playoffWeekStart =
    leagueQuery.data?.settings.playoff_week_start ??
    LEAGUE_CONFIG.regularSeasonWeeks + 1;

  const matchupQueries = useRegularSeasonMatchups(leagueId, playoffWeekStart, currentWeek);

  const isLoading =
    teamsResult.isLoading ||
    leagueQuery.isLoading ||
    playersQuery.isLoading ||
    matchupQueries.some((q) => q.isLoading);

  const error =
    teamsResult.error ??
    leagueQuery.error ??
    playersQuery.error ??
    matchupQueries.find((q) => q.error)?.error ??
    null;

  const team = teamsResult.data?.teams.find((t) => t.rosterId === rosterId);

  let weeks: TeamWeekDetail[] | undefined;
  if (
    team &&
    leagueQuery.data &&
    playersQuery.data &&
    matchupQueries.every((q) => q.data)
  ) {
    const startingSlots = getStartingSlots(leagueQuery.data.roster_positions);
    const playerPositions = buildPlayerPositionsMap(playersQuery.data);

    weeks = [];
    matchupQueries.forEach((q, i) => {
      const week = i + 1;
      const matchup = (q.data ?? []).find((m) => m.roster_id === rosterId);
      if (!matchup) return;

      const { optimalPoints, optimalLineup } = computeOptimalLineup(
        matchup.players,
        matchup.players_points,
        startingSlots,
        playerPositions
      );
      const actualLineup = buildActualLineup(
        matchup.starters,
        startingSlots,
        matchup.players_points
      );
      const weeklyScore = team.weeklyScores.find((w) => w.week === week);

      weeks!.push({
        week,
        opponentRosterId: weeklyScore?.opponentRosterId ?? null,
        actualPoints: matchup.points,
        optimalPoints,
        benchPointsLost: optimalPoints - matchup.points,
        result: weeklyScore?.result ?? null,
        actualLineup,
        optimalLineup,
      });
    });
  }

  return {
    team,
    weeks,
    teams: teamsResult.data?.teams,
    players: playersQuery.data,
    isLoading,
    error,
  };
}
