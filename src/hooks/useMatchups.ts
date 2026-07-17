import { useQueries, useQuery } from "@tanstack/react-query";
import { getMatchups } from "../api/sleeper";
import type { SleeperMatchup } from "../api/types";
import { readCache, writeCache } from "../lib/persistentCache";
import { useIsHistoric } from "./useIsHistoric";

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Past weeks never change once final, so they're cached forever.
 * The current week is still live, so it's revalidated frequently.
 * `currentWeek` is undefined while NFL state hasn't loaded yet — fall back
 * to a short staleTime rather than risk caching an in-progress week forever.
 */
function matchupStaleTime(week: number, currentWeek: number | undefined) {
  if (currentWeek === undefined) return ONE_MINUTE_MS;
  return week < currentWeek ? Infinity : ONE_MINUTE_MS;
}

function matchupsCacheKey(leagueId: string, week: number) {
  return `historic:matchups:${leagueId}:${week}`;
}

export function useMatchups(
  leagueId: string,
  week: number,
  currentWeek: number | undefined
) {
  const isHistoric = useIsHistoric(leagueId);
  const cached = isHistoric
    ? readCache<SleeperMatchup[]>(matchupsCacheKey(leagueId, week))
    : null;

  return useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: async () => {
      const data = await getMatchups(leagueId, week);
      if (isHistoric) writeCache(matchupsCacheKey(leagueId, week), data);
      return data;
    },
    staleTime: isHistoric ? Infinity : matchupStaleTime(week, currentWeek),
    enabled: Boolean(leagueId) && week > 0,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.timestamp,
  });
}

/**
 * Fetches every regular-season week (1 through playoffWeekStart - 1) in
 * parallel. Shares the same query cache/keys as useMatchups, so a week
 * fetched here is reused if a page also renders it individually.
 */
export function useRegularSeasonMatchups(
  leagueId: string,
  playoffWeekStart: number,
  currentWeek: number | undefined
) {
  const isHistoric = useIsHistoric(leagueId);
  const weeks = Array.from(
    { length: Math.max(playoffWeekStart - 1, 0) },
    (_, i) => i + 1
  );

  return useQueries({
    queries: weeks.map((week) => {
      const cached = isHistoric
        ? readCache<SleeperMatchup[]>(matchupsCacheKey(leagueId, week))
        : null;
      return {
        queryKey: ["matchups", leagueId, week],
        queryFn: async () => {
          const data = await getMatchups(leagueId, week);
          if (isHistoric) writeCache(matchupsCacheKey(leagueId, week), data);
          return data;
        },
        staleTime: isHistoric ? Infinity : matchupStaleTime(week, currentWeek),
        enabled: Boolean(leagueId) && week > 0,
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.timestamp,
      };
    }),
  });
}
