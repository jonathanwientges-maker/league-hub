import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../api/sleeper", () => ({
  getLeague: vi.fn().mockResolvedValue({ name: "Test League" }),
  getUsers: vi.fn().mockResolvedValue([]),
}));

async function renderGate() {
  const { GatePage } = await import("./GatePage");
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <GatePage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetModules();
});

// Real timers throughout — these are short (sub-second) real-time waits
// rather than fake-timer manipulation, since GatePage's tree also includes
// framer-motion's own rAF-driven animation loop and react-query, both of
// which don't play well with globally faked timers. The precise "never
// drifts, recomputes on visibilitychange" behavior is already covered in
// isolation by useCountdown.test.ts — these tests check the higher-level
// wiring (which screen renders, the 800ms hold before the crossfade).
describe("GatePage state machine", () => {
  it("shows the counting screen when now < RELEASE_DATE_UTC", async () => {
    vi.doMock("../config/release", () => ({
      RELEASE_DATE_UTC: "2026-08-22T23:00:00Z",
      CAMPAIGN_START_UTC: "2026-07-17T00:00:00Z",
      LEAGUE_ID: "L1",
      LEAGUE_NAME: "",
    }));

    const { container } = await renderGate();
    expect(container.textContent).toContain("KICKOFF IS COMING");
    expect(container.textContent).not.toContain("WE ARE LIVE");
  });

  it("skips straight to Live state for a visitor arriving after T-0", async () => {
    vi.doMock("../config/release", () => ({
      RELEASE_DATE_UTC: new Date(Date.now() - 1000).toISOString(), // 1s in the past
      CAMPAIGN_START_UTC: "2026-07-17T00:00:00Z",
      LEAGUE_ID: "L1",
      LEAGUE_NAME: "",
    }));

    const { container } = await renderGate();
    await waitFor(() => expect(container.textContent).toContain("WE ARE LIVE"));
    expect(container.textContent).not.toContain("KICKOFF IS COMING");
  });

  it("holds 00:00:00:00 for ~800ms then crossfades to Live when crossing T-0 mid-session", async () => {
    vi.doMock("../config/release", () => ({
      RELEASE_DATE_UTC: new Date(Date.now() + 300).toISOString(),
      CAMPAIGN_START_UTC: new Date(Date.now() - 100_000).toISOString(),
      LEAGUE_ID: "L1",
      LEAGUE_NAME: "",
    }));

    const { container } = await renderGate();
    expect(container.textContent).toContain("KICKOFF IS COMING");

    // Still holding the counting screen shortly after crossing T-0 (300ms in)
    // but before the 800ms hold elapses.
    await new Promise((r) => setTimeout(r, 500));
    expect(container.textContent).not.toContain("WE ARE LIVE");

    // Past the hold — should have crossfaded to Live by now.
    await waitFor(() => expect(container.textContent).toContain("WE ARE LIVE"), {
      timeout: 2000,
    });
  }, 10_000);
});
