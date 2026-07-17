import { describe, expect, it, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { SeasonHero } from "./SeasonHero";

afterEach(() => {
  vi.useRealTimers();
});

describe("SeasonHero countdown", () => {
  it("recomputes from the clock on each tick instead of drifting after a large jump", () => {
    const now = new Date("2026-08-01T00:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Distinct digits per unit so we can assert on the container's text
    // without ambiguous duplicate matches.
    const draftStartMs = now + 2 * 86400000 + 3 * 3600000 + 4 * 60000 + 9000; // 2d 3h 4m 9s

    const { container } = render(
      <SeasonHero
        phase="pre-draft-countdown"
        season="2026"
        leagueId="L1"
        draftStartMs={draftStartMs}
      />
    );

    expect(container.textContent).toContain("02");
    expect(container.textContent).toContain("03");
    expect(container.textContent).toContain("04");
    expect(container.textContent).toContain("09");

    // Simulate a background tab waking up 5 seconds late in one jump rather
    // than five separate 1-second ticks — a single 1-second interval firing
    // after a 5-second clock jump must show the real remaining time
    // (09s - 5s = 04s), not "one tick less" (08s), which is what a
    // decrementing counter (rather than a fresh getCountdownParts(now, ...)
    // computation) would produce.
    act(() => {
      vi.setSystemTime(now + 5000);
      vi.advanceTimersByTime(1000);
    });

    expect(container.textContent).toContain("04");
    expect(container.textContent).not.toContain("08");
  });
});
