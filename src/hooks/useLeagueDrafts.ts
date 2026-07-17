import { getLeagueDrafts } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const ONE_MINUTE_MS = 60 * 1000;

export function useLeagueDrafts(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["leagueDrafts", leagueId],
    queryFn: () => getLeagueDrafts(leagueId),
    cacheKey: `historic:leagueDrafts:${leagueId}`,
    isHistoric,
    liveStaleTime: ONE_MINUTE_MS,
    enabled: Boolean(leagueId),
  });
}
