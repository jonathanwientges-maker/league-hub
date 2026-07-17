import { LEAGUE_CONFIG } from "../config/league";
import { getLeaguePhase, type LeaguePhase } from "../domain/leaguePhase";
import { useLeague } from "./useLeague";
import { useLeagueDrafts } from "./useLeagueDrafts";
import { useNflState } from "./useNflState";

export function useLeaguePhase(leagueId: string) {
  const leagueQuery = useLeague(leagueId);
  const draftsQuery = useLeagueDrafts(leagueId);
  const nflStateQuery = useNflState();

  const phase: LeaguePhase | undefined =
    leagueQuery.data && draftsQuery.data && nflStateQuery.data
      ? getLeaguePhase(
          leagueQuery.data,
          draftsQuery.data,
          nflStateQuery.data,
          LEAGUE_CONFIG.draftCountdownOverride
        )
      : undefined;

  const draft = draftsQuery.data?.[0];
  const overrideMs = LEAGUE_CONFIG.draftCountdownOverride
    ? Date.parse(LEAGUE_CONFIG.draftCountdownOverride)
    : null;
  const draftStartMs = overrideMs ?? draft?.start_time ?? null;

  return {
    phase,
    league: leagueQuery.data,
    draft,
    draftStartMs,
    isLoading:
      leagueQuery.isLoading || draftsQuery.isLoading || nflStateQuery.isLoading,
    error: leagueQuery.error ?? draftsQuery.error ?? nflStateQuery.error ?? null,
  };
}
