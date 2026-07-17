import { useQuery } from "@tanstack/react-query";
import { getPlayers } from "../api/sleeper";
import type { SleeperPlayer } from "../api/types";

const PLAYERS_CACHE_KEY = "sleeper_players_cache_v1";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface PlayersCache {
  timestamp: number;
  data: Record<string, SleeperPlayer>;
}

function readPlayersCache(): PlayersCache | null {
  try {
    const raw = localStorage.getItem(PLAYERS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PlayersCache) : null;
  } catch {
    return null;
  }
}

function writePlayersCache(data: Record<string, SleeperPlayer>) {
  try {
    const cache: PlayersCache = { timestamp: Date.now(), data };
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable or full — the in-memory query cache still works.
  }
}

/**
 * The full player map is ~5MB, so it's fetched once and persisted to
 * localStorage. React Query hydrates from that cache immediately on load
 * and only refetches once it's older than 24 hours.
 */
export function usePlayers() {
  const cached = readPlayersCache();

  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const data = await getPlayers();
      writePlayersCache(data);
      return data;
    },
    staleTime: TWENTY_FOUR_HOURS_MS,
    gcTime: Infinity,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.timestamp,
  });
}
