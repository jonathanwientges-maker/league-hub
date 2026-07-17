import { useQuery } from "@tanstack/react-query";
import { LEAGUE_CONFIG } from "../config/league";
import {
  discoverCurrentSeason,
  discoverSeasonChain,
  type DiscoverCurrentSeasonResult,
} from "../domain/seasonChain";
import { readCache, writeCache } from "../lib/persistentCache";

const SEASON_CHAIN_CACHE_KEY = "seasonChain:v1";

/**
 * Resolves the full season chain (backward + forward from the anchor
 * league), persisted to localStorage purely so a cold page load can paint
 * instantly from the last-known chain instead of a loading spinner.
 *
 * staleTime is intentionally 0, NOT a long TTL: this is the one query in the
 * app that specifically exists to detect "did the commissioner just create
 * next season's league" — a stale-while-revalidate cache with a multi-hour
 * staleTime would mean react-query skips refetching (not just skips the
 * spinner) for that whole window, so a season that just got created
 * wouldn't show up until the TTL expired. Instead: seed initialData from
 * the cache for instant paint, but always revalidate — on mount, on window
 * refocus, on reconnect (react-query's defaults) — since these Sleeper
 * calls are cheap (a handful of small league lookups, not the ~5MB players
 * payload usePlayers.ts caches long-lived).
 */
export function useSeasonChain() {
  const cached = readCache<DiscoverCurrentSeasonResult>(SEASON_CHAIN_CACHE_KEY);

  return useQuery({
    queryKey: ["seasonChain"],
    queryFn: async () => {
      const chain = await discoverSeasonChain(LEAGUE_CONFIG.anchor.leagueId);
      const result = await discoverCurrentSeason(
        LEAGUE_CONFIG.anchor.ownerUserId,
        chain
      );
      writeCache(SEASON_CHAIN_CACHE_KEY, result);
      return result;
    },
    staleTime: 0,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.timestamp,
  });
}
