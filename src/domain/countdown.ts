export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Always recomputed from the current clock, never decremented from a stored
 * counter — a backgrounded tab that wakes up late still shows the correct
 * remaining time instead of drifting.
 */
export function getCountdownParts(nowMs: number, targetMs: number): CountdownParts {
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
