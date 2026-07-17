import { describe, expect, it, vi, beforeEach } from "vitest";
import * as sleeperApi from "../api/sleeper";
import { discoverSeasonChain, discoverCurrentSeason, getNextSeason } from "./seasonChain";
import type { SleeperLeague } from "../api/types";

function league(overrides: Partial<SleeperLeague>): SleeperLeague {
  return {
    league_id: "x",
    name: "Test League",
    season: "2024",
    sport: "nfl",
    status: "complete",
    total_rosters: 12,
    settings: { playoff_week_start: 15 },
    scoring_settings: {},
    roster_positions: [],
    avatar: null,
    previous_league_id: null,
    draft_id: null,
    ...overrides,
  };
}

describe("discoverSeasonChain", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("walks backward via previous_league_id and stops at null", async () => {
    const leagues: Record<string, SleeperLeague> = {
      l2025: league({ league_id: "l2025", season: "2025", previous_league_id: "l2024" }),
      l2024: league({ league_id: "l2024", season: "2024", previous_league_id: null }),
    };
    vi.spyOn(sleeperApi, "getLeague").mockImplementation(async (id) => leagues[id]);

    const chain = await discoverSeasonChain("l2025");
    expect(chain.map((s) => s.season)).toEqual(["2024", "2025"]);
  });

  it("stops at previous_league_id === '0'", async () => {
    const leagues: Record<string, SleeperLeague> = {
      l2025: league({ league_id: "l2025", season: "2025", previous_league_id: "0" }),
    };
    vi.spyOn(sleeperApi, "getLeague").mockImplementation(async (id) => leagues[id]);

    const chain = await discoverSeasonChain("l2025");
    expect(chain.map((s) => s.season)).toEqual(["2025"]);
  });

  it("breaks a cycle via the visited-set instead of looping forever", async () => {
    const leagues: Record<string, SleeperLeague> = {
      a: league({ league_id: "a", season: "2025", previous_league_id: "b" }),
      b: league({ league_id: "b", season: "2024", previous_league_id: "a" }), // cycle back to a
    };
    vi.spyOn(sleeperApi, "getLeague").mockImplementation(async (id) => leagues[id]);

    const chain = await discoverSeasonChain("a");
    // Must terminate and not include duplicate entries from looping.
    expect(chain.length).toBeLessThanOrEqual(2);
  });
});

describe("discoverCurrentSeason", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("matches the newest season only by previous_league_id pointer, not by name (decoy league must not match)", async () => {
    vi.spyOn(sleeperApi, "getNflState").mockResolvedValue({
      week: 0,
      season_type: "off",
      season: "2026",
      previous_season: "2025",
      leg: 0,
      league_season: "2026",
      league_create_season: "2026",
      display_week: 0,
    });

    const realChild = league({
      league_id: "real2026",
      season: "2026",
      name: "Some League",
      previous_league_id: "l2025",
    });
    const decoy = league({
      league_id: "decoy2026",
      season: "2026",
      name: "League Hub", // same display name as the real league, must not match on this
      previous_league_id: "someone-elses-league",
    });
    vi.spyOn(sleeperApi, "getUserLeagues").mockResolvedValue([decoy, realChild]);

    const chain = [
      { leagueId: "l2024", season: "2024", name: "League Hub", status: "complete" },
      { leagueId: "l2025", season: "2025", name: "League Hub", status: "complete" },
    ];

    const result = await discoverCurrentSeason("owner1", chain);
    expect(result.isAwaitingNewSeason).toBe(false);
    expect(result.current.leagueId).toBe("real2026");
    expect(result.chain.map((s) => s.leagueId)).toEqual(["l2024", "l2025", "real2026"]);
  });

  it("returns isAwaitingNewSeason: true and the newest known season when no match is found", async () => {
    vi.spyOn(sleeperApi, "getNflState").mockResolvedValue({
      week: 0,
      season_type: "off",
      season: "2026",
      previous_season: "2025",
      leg: 0,
      league_season: "2026",
      league_create_season: "2026",
      display_week: 0,
    });
    vi.spyOn(sleeperApi, "getUserLeagues").mockResolvedValue([]);

    const chain = [
      { leagueId: "l2024", season: "2024", name: "League Hub", status: "complete" },
      { leagueId: "l2025", season: "2025", name: "League Hub", status: "complete" },
    ];

    const result = await discoverCurrentSeason("owner1", chain);
    expect(result.isAwaitingNewSeason).toBe(true);
    expect(result.current.leagueId).toBe("l2025");
  });
});

describe("getNextSeason", () => {
  it("returns the season immediately after the given one in the chain", () => {
    const chain = [
      { leagueId: "a", season: "2024", name: "x", status: "complete" },
      { leagueId: "b", season: "2025", name: "x", status: "complete" },
    ];
    expect(getNextSeason(chain, chain[0])?.leagueId).toBe("b");
    expect(getNextSeason(chain, chain[1])).toBeUndefined();
  });
});
