import { getUsers } from "../api/sleeper";
import { useIsHistoric } from "./useIsHistoric";
import { usePersistedQuery } from "./usePersistedQuery";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useUsers(leagueId: string) {
  const isHistoric = useIsHistoric(leagueId);
  return usePersistedQuery({
    queryKey: ["users", leagueId],
    queryFn: () => getUsers(leagueId),
    cacheKey: `historic:users:${leagueId}`,
    isHistoric,
    liveStaleTime: FIVE_MINUTES_MS,
    enabled: Boolean(leagueId),
  });
}
