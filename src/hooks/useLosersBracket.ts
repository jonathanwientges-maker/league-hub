import { getLosersBracket } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const ONE_MINUTE_MS = 60 * 1000;

export function useLosersBracket(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["losersBracket", leagueId],
    queryFn: () => getLosersBracket(leagueId),
    cacheKey: `historic:losersBracket:${leagueId}`,
    isHistoric,
    liveStaleTime: ONE_MINUTE_MS,
    enabled: Boolean(leagueId),
  });
}
