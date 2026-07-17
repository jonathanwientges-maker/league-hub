interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

/**
 * Same read/write-to-localStorage pattern as usePlayers.ts, generalized so
 * new season-scoped caches (season chain, historic season payloads) don't
 * each reimplement it.
 */
export function readCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEnvelope<T>) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    const envelope: CacheEnvelope<T> = { timestamp: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // localStorage unavailable or full — the in-memory query cache still works.
  }
}
