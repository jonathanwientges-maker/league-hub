import { getRosters } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useRosters(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["rosters", leagueId],
    queryFn: () => getRosters(leagueId),
    cacheKey: `historic:rosters:${leagueId}`,
    isHistoric,
    liveStaleTime: FIVE_MINUTES_MS,
    enabled: Boolean(leagueId),
  });
}
