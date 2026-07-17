import { useEffect, useState } from "react";
import { getCountdownParts, type CountdownParts } from "../../domain/countdown";

export interface CountdownState {
  parts: CountdownParts;
  isLive: boolean;
}

const TICK_MS = 250;

function computeState(releaseMs: number): CountdownState {
  const now = Date.now();
  return {
    parts: getCountdownParts(now, releaseMs),
    isLive: now >= releaseMs,
  };
}

/**
 * Always recomputed from Date.now() vs releaseMs — never a decrementing
 * counter, so a backgrounded tab never drifts. Recomputes immediately on
 * visibilitychange so a tab that was backgrounded for minutes doesn't show
 * stale digits for up to a full tick interval after it's foregrounded.
 */
export function useCountdown(releaseMs: number): CountdownState {
  const [state, setState] = useState<CountdownState>(() => computeState(releaseMs));

  useEffect(() => {
    const tick = () => setState(computeState(releaseMs));
    tick();

    const interval = setInterval(tick, TICK_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [releaseMs]);

  return state;
}
