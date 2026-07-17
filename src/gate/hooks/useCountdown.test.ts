import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown } from "./useCountdown";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useCountdown", () => {
  it("counts down and reports isLive: false before the release moment", () => {
    const now = 1_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { result } = renderHook(() => useCountdown(now + 90_061_000)); // 1d 1h 1m 1s out

    expect(result.current.isLive).toBe(false);
    expect(result.current.parts).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });

  it("reports isLive: true once the clock passes the release moment", () => {
    const now = 1_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { result } = renderHook(() => useCountdown(now + 2000));

    act(() => {
      vi.setSystemTime(now + 3000);
      vi.advanceTimersByTime(250);
    });

    expect(result.current.isLive).toBe(true);
    expect(result.current.parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("recomputes immediately on visibilitychange instead of waiting for the next tick", () => {
    const now = 1_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { result } = renderHook(() => useCountdown(now + 10_000));
    expect(result.current.parts.seconds).toBe(10);

    // Simulate a tab backgrounded for a while, then foregrounded — no timer
    // tick fires, only the visibilitychange event.
    act(() => {
      vi.setSystemTime(now + 7_000);
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.parts.seconds).toBe(3);
  });
});
