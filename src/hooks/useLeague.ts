import { getLeague } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useLeague(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeague(leagueId),
    cacheKey: `historic:league:${leagueId}`,
    isHistoric,
    liveStaleTime: FIVE_MINUTES_MS,
    enabled: Boolean(leagueId),
  });
}
