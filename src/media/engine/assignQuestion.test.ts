import { describe, expect, it } from "vitest";
import { assignQuestion, assignSeasonKickoffQuestion } from "./assignQuestion";
import type { WeekContext, WeekTeamContext } from "./weekContext";

function team(overrides: Partial<WeekTeamContext> = {}): WeekTeamContext {
  return {
    rosterId: 1,
    teamName: "Team A",
    avatarUrl: null,
    division: 1,
    divisionRank: 1,
    wins: 5,
    losses: 3,
    ties: 0,
    record: "5-3",
    pointsFor: 800,
    resultLastWeek: null,
    winStreak: 0,
    lossStreak: 0,
    starterPointsByPosition: { QB: 20, RB: 20, WR: 20, TE: 10 },
    benchOutperformers: [],
    underperformingStarters: [],
    repeatUnderperformers: [],
    byeStarters: [],
    outStarters: [],
    newIrPlayers: [],
    taxiScores: [],
    opponentRosterId: null,
    ...overrides,
  };
}

function ctx(teams: WeekTeamContext[], completedWeek = 19, upcomingWeek = 20): WeekContext {
  return {
    season: "2026",
    completedWeek,
    upcomingWeek,
    teams: new Map(teams.map((t) => [t.rosterId, t])),
  };
}

describe("assignQuestion", () => {
  it("is deterministic for the same (season, week, rosterId)", () => {
    const c = ctx([team()]);
    const first = assignQuestion(c, 1);
    const second = assignQuestion(c, 1);
    expect(second).toEqual(first);
  });

  it("changes the rendered question when the roster changes", () => {
    const c = ctx([team({ rosterId: 1, teamName: "Team A" }), team({ rosterId: 2, teamName: "Team B" })]);
    const a = assignQuestion(c, 1);
    const b = assignQuestion(c, 2);
    expect(a.question).not.toBe(b.question);
  });

  it("falls back to generic_fallback when no other category is eligible", () => {
    const result = assignQuestion(ctx([team()]), 1);
    expect(result.categoryId).toBe("generic_fallback");
  });

  it("keeps a previously-used category when it is the only one eligible", () => {
    const result = assignQuestion(ctx([team()]), 1, "generic_fallback");
    expect(result.categoryId).toBe("generic_fallback");
  });

  it("skips the previous week's category when another is eligible", () => {
    // close_win and win_streak_3 both apply; forcing out close_win must leave win_streak_3.
    const t = team({
      resultLastWeek: { result: "W", margin: 2, opponentRosterId: 2 },
      winStreak: 3,
    });
    const c = ctx([t, team({ rosterId: 2, teamName: "Team B" })]);
    const result = assignQuestion(c, 1, "close_win");
    expect(result.categoryId).toBe("win_streak_3");
  });

  it("never throws for a completely empty roster set beyond the target", () => {
    expect(() => assignQuestion(ctx([team()]), 1)).not.toThrow();
  });

  it("overrides to season_kickoff before any real week has been played, regardless of category weights", () => {
    // Would otherwise hit close_win (weight 4) — season_kickoff must win at upcomingWeek <= 1.
    const t = team({ resultLastWeek: { result: "W", margin: 2, opponentRosterId: 2 } });
    const c = ctx([t, team({ rosterId: 2, teamName: "Team B" })], 1, 1);
    const result = assignQuestion(c, 1);
    expect(result.categoryId).toBe("season_kickoff");
    expect(result.question).toBe(
      "Der große Saisonauftakt steht bevor! Ihr Statement zur realistischen Zielsetzung für Team A in dieser Spielzeit, bitte."
    );
  });

  it("also overrides at upcomingWeek 0 (Sleeper's real off-season state)", () => {
    const c = ctx([team()], 1, 0);
    expect(assignQuestion(c, 1).categoryId).toBe("season_kickoff");
  });

  it("no longer overrides once upcomingWeek 2 arrives", () => {
    const c = ctx([team()], 1, 2);
    expect(assignQuestion(c, 1).categoryId).not.toBe("season_kickoff");
  });
});

describe("assignSeasonKickoffQuestion", () => {
  it("is deterministic and renders the team name", () => {
    const a = assignSeasonKickoffQuestion("2026", 1, 1, { team: "Team A" });
    const b = assignSeasonKickoffQuestion("2026", 1, 1, { team: "Team A" });
    expect(a).toEqual(b);
    expect(a.question).toContain("Team A");
  });
});
