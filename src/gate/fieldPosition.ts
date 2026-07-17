/**
 * Elapsed fraction between startMs and releaseMs, clamped to [0, 1] —
 * derived from real timestamps, never a hardcoded percent, so it's correct
 * on every render regardless of when the page is loaded.
 */
export function computeFieldPosition(nowMs: number, startMs: number, releaseMs: number): number {
  const span = releaseMs - startMs;
  if (span <= 0) return 1;
  const elapsed = nowMs - startMs;
  return Math.min(1, Math.max(0, elapsed / span));
}
