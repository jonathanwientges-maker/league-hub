import { describe, expect, it } from "vitest";
import { assembleTeams, resolveAvatarUrl } from "./team";
import type { SleeperRoster, SleeperUser } from "../api/types";

function roster(overrides: Partial<SleeperRoster>): SleeperRoster {
  return {
    roster_id: 1,
    owner_id: "u1",
    league_id: "L",
    players: [],
    starters: [],
    settings: {
      wins: 0,
      losses: 0,
      ties: 0,
      fpts: 0,
      fpts_decimal: 0,
      fpts_against: 0,
      fpts_against_decimal: 0,
    },
    ...overrides,
  };
}

function user(overrides: Partial<SleeperUser>): SleeperUser {
  return {
    user_id: "u1",
    display_name: "Test",
    avatar: null,
    metadata: null,
    ...overrides,
  };
}

describe("assembleTeams", () => {
  it("defaults pointsFor/pointsAgainst to 0 instead of NaN when Sleeper omits the decimal fields (a freshly-created, not-yet-started season)", () => {
    // Real shape observed on a brand-new Sleeper league before any stats
    // exist: fpts_decimal/fpts_against/fpts_against_decimal are entirely
    // absent, not just 0.
    const r = roster({
      settings: {
        wins: 0,
        losses: 0,
        ties: 0,
        fpts: 0,
        // @ts-expect-error simulating Sleeper's real (undocumented) omission
        fpts_decimal: undefined,
        // @ts-expect-error simulating Sleeper's real (undocumented) omission
        fpts_against: undefined,
        // @ts-expect-error simulating Sleeper's real (undocumented) omission
        fpts_against_decimal: undefined,
      },
    });

    const [team] = assembleTeams([r], [user({})], new Map());
    expect(team.pointsFor).toBe(0);
    expect(team.pointsAgainst).toBe(0);
    expect(Number.isNaN(team.pointsFor)).toBe(false);
    expect(Number.isNaN(team.pointsAgainst)).toBe(false);
  });

  it("still combines whole + decimal correctly when both are present", () => {
    const r = roster({ settings: { wins: 3, losses: 1, ties: 0, fpts: 412, fpts_decimal: 56, fpts_against: 380, fpts_against_decimal: 12 } });
    const [team] = assembleTeams([r], [user({})], new Map());
    expect(team.pointsFor).toBeCloseTo(412.56);
    expect(team.pointsAgainst).toBeCloseTo(380.12);
  });
});

describe("resolveAvatarUrl", () => {
  it("prefers the league-specific metadata.avatar over the account-level avatar hash", () => {
    const u = user({ avatar: "generic-hash", metadata: { avatar: "https://sleepercdn.com/uploads/custom.jpg" } });
    expect(resolveAvatarUrl(u)).toBe("https://sleepercdn.com/uploads/custom.jpg");
  });

  it("falls back to the account-level avatar hash when no league-specific picture is set", () => {
    const u = user({ avatar: "generic-hash", metadata: null });
    expect(resolveAvatarUrl(u)).toBe("https://sleepercdn.com/avatars/generic-hash");
  });

  it("returns null when neither is set", () => {
    expect(resolveAvatarUrl(user({ avatar: null, metadata: null }))).toBeNull();
  });

  it("returns null for an undefined user", () => {
    expect(resolveAvatarUrl(undefined)).toBeNull();
  });
});
