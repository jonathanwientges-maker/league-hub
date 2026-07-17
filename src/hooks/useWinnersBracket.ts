import { getWinnersBracket } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const ONE_MINUTE_MS = 60 * 1000;

export function useWinnersBracket(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["winnersBracket", leagueId],
    queryFn: () => getWinnersBracket(leagueId),
    cacheKey: `historic:winnersBracket:${leagueId}`,
    isHistoric,
    liveStaleTime: ONE_MINUTE_MS,
    enabled: Boolean(leagueId),
  });
}
