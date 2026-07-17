import { describe, expect, it } from "vitest";
import { getLeaguePhase } from "./leaguePhase";
import type { NflState, SleeperDraft, SleeperLeague } from "../api/types";

const baseLeague: SleeperLeague = {
  league_id: "x",
  name: "x",
  season: "2026",
  sport: "nfl",
  status: "pre_draft",
  total_rosters: 12,
  settings: { playoff_week_start: 15 },
  scoring_settings: {},
  roster_positions: [],
  avatar: null,
  previous_league_id: "y",
  draft_id: "d1",
};

const nflState: NflState = {
  week: 0,
  season_type: "off",
  season: "2026",
  previous_season: "2025",
  leg: 0,
  league_season: "2026",
  league_create_season: "2026",
  display_week: 0,
};

function draft(overrides: Partial<SleeperDraft>): SleeperDraft {
  return {
    draft_id: "d1",
    league_id: "x",
    type: "snake",
    status: "pre_draft",
    start_time: null,
    draft_order: null,
    settings: { rounds: 15 },
    ...overrides,
  };
}

describe("getLeaguePhase", () => {
  it("pre-draft-unscheduled: no draft, no override", () => {
    expect(getLeaguePhase(baseLeague, [], nflState, null)).toBe("pre-draft-unscheduled");
  });

  it("pre-draft-countdown: future start_time", () => {
    const future = Date.now() + 3 * 86400000;
    expect(
      getLeaguePhase(baseLeague, [draft({ start_time: future })], nflState, null)
    ).toBe("pre-draft-countdown");
  });

  it("countdownOverride wins over Sleeper's start_time", () => {
    const future = Date.now() + 3 * 86400000;
    const overrideFuture = new Date(Date.now() + 10 * 86400000).toISOString();
    // Sleeper says drafting soon, but override pushes it further out —
    // override must be the one that determines the phase/target time.
    expect(
      getLeaguePhase(baseLeague, [draft({ start_time: future })], nflState, overrideFuture)
    ).toBe("pre-draft-countdown");
  });

  it("guard branch: start time in the past but draft still pre_draft -> drafting", () => {
    const past = Date.now() - 1000;
    expect(
      getLeaguePhase(baseLeague, [draft({ start_time: past })], nflState, null)
    ).toBe("drafting");
  });

  it("drafting: explicit draft status", () => {
    expect(
      getLeaguePhase(
        { ...baseLeague, status: "drafting" },
        [draft({ status: "drafting" })],
        nflState,
        null
      )
    ).toBe("drafting");
  });

  it("pre-season: draft complete, nflState.week < 1", () => {
    expect(
      getLeaguePhase(
        { ...baseLeague, status: "in_season" },
        [draft({ status: "complete" })],
        nflState,
        null
      )
    ).toBe("pre-season");
  });

  it("regular-season", () => {
    expect(
      getLeaguePhase(
        { ...baseLeague, status: "in_season" },
        [draft({ status: "complete" })],
        { ...nflState, week: 5 },
        null
      )
    ).toBe("regular-season");
  });

  it("playoffs", () => {
    expect(
      getLeaguePhase(
        { ...baseLeague, status: "in_season" },
        [draft({ status: "complete" })],
        { ...nflState, week: 15 },
        null
      )
    ).toBe("playoffs");
  });

  it("complete", () => {
    expect(
      getLeaguePhase({ ...baseLeague, status: "complete" }, [], { ...nflState, week: 18 }, null)
    ).toBe("complete");
  });
});
