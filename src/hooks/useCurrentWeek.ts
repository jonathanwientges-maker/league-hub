import { useLeague } from "./useLeague";
import { useNflState } from "./useNflState";
import { resolveCurrentWeek } from "../domain/potentialPoints";

/**
 * The "current week" every other hook should use for final/live/upcoming
 * logic — not the raw NFL week, see resolveCurrentWeek's doc comment.
 */
export function useCurrentWeek(leagueId: string) {
  const leagueQuery = useLeague(leagueId);
  const nflStateQuery = useNflState();

  const currentWeek =
    leagueQuery.data && nflStateQuery.data
      ? resolveCurrentWeek(leagueQuery.data, nflStateQuery.data)
      : undefined;

  return {
    currentWeek,
    isLoading: leagueQuery.isLoading || nflStateQuery.isLoading,
    error: leagueQuery.error ?? nflStateQuery.error ?? null,
    league: leagueQuery.data,
    nflState: nflStateQuery.data,
  };
}
