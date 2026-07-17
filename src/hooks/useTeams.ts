import { useLeague } from "./useLeague";
import { useRosters } from "./useRosters";
import { useUsers } from "./useUsers";
import { useCurrentWeek } from "./useCurrentWeek";
import { usePlayers } from "./usePlayers";
import { useRegularSeasonMatchups } from "./useMatchups";
import { assembleTeams } from "../domain/team";
import { buildAllWeekResults, buildWeekResultsByRoster } from "../domain/weeklyResults";
import { buildH2hMap } from "../domain/h2h";
import {
  getStartingSlots,
  buildPlayerPositionsMap,
  computeAllTeamsPotentialPoints,
  mergeTeamsWithPotentialPoints,
} from "../domain/potentialPoints";
import { LEAGUE_CONFIG } from "../config/league";
import type { Team, H2hMap } from "../domain/types";
import type { SleeperMatchup } from "../api/types";

export interface TeamsData {
  teams: Team[];
  h2hMap: H2hMap;
  playoffWeekStart: number;
  currentWeek: number;
}

/**
 * Combines league/rosters/users/matchups into the unified Team model + h2h
 * map. This is the hook layer's job, not domain/'s — domain functions stay
 * pure, this is what feeds them real fetched data.
 */
export function useTeams(leagueId: string) {
  const leagueQuery = useLeague(leagueId);
  const rostersQuery = useRosters(leagueId);
  const usersQuery = useUsers(leagueId);
  const { currentWeek, isLoading: currentWeekLoading, error: currentWeekError } = useCurrentWeek(leagueId);
  const playersQuery = usePlayers();

  const playoffWeekStart =
    leagueQuery.data?.settings.playoff_week_start ??
    LEAGUE_CONFIG.regularSeasonWeeks + 1;

  const matchupQueries = useRegularSeasonMatchups(
    leagueId,
    playoffWeekStart,
    currentWeek
  );

  const isLoading =
    leagueQuery.isLoading ||
    rostersQuery.isLoading ||
    usersQuery.isLoading ||
    playersQuery.isLoading ||
    currentWeekLoading ||
    matchupQueries.some((q) => q.isLoading);

  const error =
    leagueQuery.error ??
    rostersQuery.error ??
    usersQuery.error ??
    playersQuery.error ??
    currentWeekError ??
    matchupQueries.find((q) => q.error)?.error ??
    null;

  let data: TeamsData | undefined;
  if (
    leagueQuery.data &&
    rostersQuery.data &&
    usersQuery.data &&
    playersQuery.data &&
    currentWeek !== undefined &&
    matchupQueries.every((q) => q.data)
  ) {
    const matchupsByWeek = new Map<number, SleeperMatchup[]>();
    matchupQueries.forEach((q, i) => {
      matchupsByWeek.set(i + 1, q.data ?? []);
    });

    const allWeekResults = buildAllWeekResults(matchupsByWeek);
    const weekResultsByRoster = buildWeekResultsByRoster(matchupsByWeek);
    const h2hMap = buildH2hMap(allWeekResults);
    const baseTeams = assembleTeams(
      rostersQuery.data,
      usersQuery.data,
      weekResultsByRoster
    );

    const startingSlots = getStartingSlots(leagueQuery.data.roster_positions);
    const playerPositions = buildPlayerPositionsMap(playersQuery.data);
    const potentialPointsByRoster = computeAllTeamsPotentialPoints(
      rostersQuery.data.map((r) => r.roster_id),
      matchupsByWeek,
      startingSlots,
      playerPositions,
      playoffWeekStart,
      currentWeek
    );
    const teams = mergeTeamsWithPotentialPoints(
      baseTeams,
      potentialPointsByRoster
    );

    data = { teams, h2hMap, playoffWeekStart, currentWeek };
  }

  return {
    data,
    isLoading,
    error,
    league: leagueQuery.data,
  };
}
