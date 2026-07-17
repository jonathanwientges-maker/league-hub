import { useQuery } from "@tanstack/react-query";
import { readCache, writeCache } from "../lib/persistentCache";

/**
 * Same shape as a plain useQuery call, but for historic (immutable) data:
 * persists to localStorage on success and hydrates from it via initialData,
 * so a completed season's payloads are fetched from Sleeper once per
 * browser rather than once per page load. Live (non-historic) queries pass
 * isHistoric: false and behave exactly like a plain useQuery.
 */
export function usePersistedQuery<T>({
  queryKey,
  queryFn,
  cacheKey,
  isHistoric,
  liveStaleTime,
  enabled = true,
}: {
  queryKey: unknown[];
  queryFn: () => Promise<T>;
  cacheKey: string;
  isHistoric: boolean;
  liveStaleTime: number;
  enabled?: boolean;
}) {
  const cached = isHistoric ? readCache<T>(cacheKey) : null;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      if (isHistoric) writeCache(cacheKey, data);
      return data;
    },
    staleTime: isHistoric ? Infinity : liveStaleTime,
    enabled,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.timestamp,
  });
}
