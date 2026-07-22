import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./categories";
import type { WeekContext, WeekTeamContext } from "./weekContext";

function team(overrides: Partial<WeekTeamContext> = {}): WeekTeamContext {
  const wins = overrides.wins ?? 5;
  const losses = overrides.losses ?? 3;
  return {
    rosterId: 1,
    teamName: "Team A",
    avatarUrl: null,
    division: 1,
    divisionRank: 1,
    wins,
    losses,
    ties: 0,
    record: `${wins}-${losses}`,
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

function ctx(teams: WeekTeamContext[], completedWeek = 5, upcomingWeek = 6): WeekContext {
  return {
    season: "2026",
    completedWeek,
    upcomingWeek,
    teams: new Map(teams.map((t) => [t.rosterId, t])),
  };
}

function category(id: string) {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`category not registered: ${id}`);
  return found;
}

describe("category registry", () => {
  it("registers all 42 non-rivalry categories exactly once", () => {
    expect(CATEGORIES).toHaveLength(42);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(42);
  });
});

describe("bye_player_started", () => {
  it("fires when a starter's team is on bye", () => {
    const t = team({ byeStarters: [{ playerId: "p1", name: "Bye Guy" }] });
    const result = category("bye_player_started").appliesTo(ctx([t]), 1);
    expect(result).toEqual({ team: "Team A", player: "Bye Guy" });
  });
  it("does not fire with no bye starters", () => {
    expect(category("bye_player_started").appliesTo(ctx([team()]), 1)).toBe(false);
  });
});

describe("out_player_started", () => {
  it("fires when a starter is flagged out", () => {
    const t = team({ outStarters: [{ playerId: "p1", name: "Hurt Guy" }] });
    expect(category("out_player_started").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Hurt Guy",
    });
  });
});

describe("starter_underperformed_repeat", () => {
  it("fires for a 3-week repeat underperformer", () => {
    const t = team({ repeatUnderperformers: [{ playerId: "p1", name: "Cold Guy" }] });
    expect(category("starter_underperformed_repeat").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Cold Guy",
    });
  });
});

describe("taxi_over_10", () => {
  it("fires when the best taxi score is >= 10", () => {
    const t = team({ taxiScores: [{ playerId: "p1", name: "Stash", points: 12.34 }] });
    expect(category("taxi_over_10").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Stash",
      points: 12.3,
    });
  });
  it("does not fire below 10", () => {
    const t = team({ taxiScores: [{ playerId: "p1", name: "Stash", points: 9.9 }] });
    expect(category("taxi_over_10").appliesTo(ctx([t]), 1)).toBe(false);
  });
});

describe("player_to_ir", () => {
  it("fires for a newly-reserved player who scored earlier this season", () => {
    const t = team({ newIrPlayers: [{ playerId: "p1", name: "Reserve Guy" }] });
    expect(category("player_to_ir").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Reserve Guy",
    });
  });
});

describe("taxi_all_under_3", () => {
  it("fires when every taxi player scored under 3", () => {
    const t = team({
      taxiScores: [
        { playerId: "p1", name: "A", points: 1 },
        { playerId: "p2", name: "B", points: 2.9 },
      ],
    });
    expect(category("taxi_all_under_3").appliesTo(ctx([t]), 1)).toEqual({ team: "Team A" });
  });
  it("does not fire if any taxi player scored 3+", () => {
    const t = team({
      taxiScores: [
        { playerId: "p1", name: "A", points: 1 },
        { playerId: "p2", name: "B", points: 3 },
      ],
    });
    expect(category("taxi_all_under_3").appliesTo(ctx([t]), 1)).toBe(false);
  });
  it("does not fire with an empty taxi squad", () => {
    expect(category("taxi_all_under_3").appliesTo(ctx([team()]), 1)).toBe(false);
  });
});

describe("close_win / blowout_win / close_loss / blowout_loss", () => {
  it("close_win fires for a win within the close margin", () => {
    const t = team({ resultLastWeek: { result: "W", margin: 3, opponentRosterId: 2 } });
    const opp = team({ rosterId: 2, teamName: "Team B" });
    expect(category("close_win").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Team B",
      margin: 3,
    });
  });
  it("blowout_win fires for a win past the blowout margin", () => {
    const t = team({ resultLastWeek: { result: "W", margin: 45, opponentRosterId: 2 } });
    const opp = team({ rosterId: 2, teamName: "Team B" });
    expect(category("blowout_win").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Team B",
      margin: 45,
    });
  });
  it("close_loss fires for a loss within the close margin", () => {
    const t = team({ resultLastWeek: { result: "L", margin: 2, opponentRosterId: 2 } });
    const opp = team({ rosterId: 2, teamName: "Team B" });
    expect(category("close_loss").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Team B",
      margin: 2,
    });
  });
  it("blowout_loss fires for a loss past the blowout margin", () => {
    const t = team({ resultLastWeek: { result: "L", margin: 41, opponentRosterId: 2 } });
    const opp = team({ rosterId: 2, teamName: "Team B" });
    expect(category("blowout_loss").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Team B",
      margin: 41,
    });
  });
  it("a mid-margin win triggers neither close_win nor blowout_win", () => {
    const t = team({ resultLastWeek: { result: "W", margin: 15, opponentRosterId: 2 } });
    const opp = team({ rosterId: 2, teamName: "Team B" });
    expect(category("close_win").appliesTo(ctx([t, opp]), 1)).toBe(false);
    expect(category("blowout_win").appliesTo(ctx([t, opp]), 1)).toBe(false);
  });
});

describe("win_streak_3 / loss_streak_3", () => {
  it("win_streak_3 fires at the threshold", () => {
    const t = team({ winStreak: 3 });
    expect(category("win_streak_3").appliesTo(ctx([t]), 1)).toEqual({ team: "Team A", streak: 3 });
  });
  it("win_streak_3 does not fire below the threshold", () => {
    const t = team({ winStreak: 2 });
    expect(category("win_streak_3").appliesTo(ctx([t]), 1)).toBe(false);
  });
  it("loss_streak_3 fires at the threshold", () => {
    const t = team({ lossStreak: 4 });
    expect(category("loss_streak_3").appliesTo(ctx([t]), 1)).toEqual({ team: "Team A", streak: 4 });
  });
});

describe("bench_outperformed", () => {
  it("fires with the highest-scoring qualifying bench player", () => {
    const t = team({
      benchOutperformers: [
        { playerId: "p1", name: "Bench Star", position: "RB", points: 22.5 },
        { playerId: "p2", name: "Runner Up", position: "WR", points: 18 },
      ],
    });
    expect(category("bench_outperformed").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Bench Star",
      points: 22.5,
      position: "RB",
    });
  });
});

describe("win_weak_position_group / loss_weak_position_group", () => {
  it("win_weak_position_group picks the group with the largest relative shortfall", () => {
    // QB threshold 15: 5/15 = 66% short. RB threshold 8: 6/8 = 75% short (worse).
    const t = team({
      resultLastWeek: { result: "W", margin: 20, opponentRosterId: 2 },
      starterPointsByPosition: { QB: 5, RB: 2, WR: 20, TE: 10 },
    });
    expect(category("win_weak_position_group").appliesTo(ctx([t, team({ rosterId: 2 })]), 1)).toEqual({
      team: "Team A",
      position: "RB",
      points: 2,
    });
  });
  it("loss_weak_position_group requires a loss", () => {
    const t = team({
      resultLastWeek: { result: "W", margin: 20, opponentRosterId: 2 },
      starterPointsByPosition: { QB: 0, RB: 0, WR: 0, TE: 0 },
    });
    expect(category("loss_weak_position_group").appliesTo(ctx([t, team({ rosterId: 2 })]), 1)).toBe(
      false
    );
  });
  it("does not fire when every group is above threshold", () => {
    const t = team({ resultLastWeek: { result: "W", margin: 20, opponentRosterId: 2 } });
    expect(category("win_weak_position_group").appliesTo(ctx([t, team({ rosterId: 2 })]), 1)).toBe(
      false
    );
  });
});

describe("undefeated / winless after Wn", () => {
  it("undefeated_after_w4 fires for 0 losses at completed week 4-5", () => {
    const t = team({ losses: 0 });
    expect(category("undefeated_after_w4").appliesTo(ctx([t], 4), 1)).toEqual({
      team: "Team A",
      record: "5-0",
    });
  });
  it("undefeated_after_w4 does not fire at week 6+", () => {
    const t = team({ losses: 0 });
    expect(category("undefeated_after_w4").appliesTo(ctx([t], 6), 1)).toBe(false);
  });
  it("undefeated_after_w6 fires at completed week 6+", () => {
    const t = team({ losses: 0 });
    expect(category("undefeated_after_w6").appliesTo(ctx([t], 8), 1)).toEqual({
      team: "Team A",
      record: "5-0",
    });
  });
  it("winless_after_w4 fires for 0 wins at completed week 4-5", () => {
    const t = team({ wins: 0 });
    expect(category("winless_after_w4").appliesTo(ctx([t], 5), 1)).toEqual({
      team: "Team A",
      record: "0-3",
    });
  });
  it("winless_after_w6 fires at completed week 6+", () => {
    const t = team({ wins: 0 });
    expect(category("winless_after_w6").appliesTo(ctx([t], 7), 1)).toEqual({
      team: "Team A",
      record: "0-3",
    });
  });
});

describe("starter_underperformed_once", () => {
  it("fires for the lowest scorer, excluding repeat offenders", () => {
    const t = team({
      underperformingStarters: [
        { playerId: "p1", name: "Repeat", points: 1 },
        { playerId: "p2", name: "Once", points: 4 },
      ],
      repeatUnderperformers: [{ playerId: "p1", name: "Repeat" }],
    });
    expect(category("starter_underperformed_once").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Once",
      points: 4,
    });
  });
  it("does not fire when the only underperformer is already a repeat offender", () => {
    const t = team({
      underperformingStarters: [{ playerId: "p1", name: "Repeat", points: 1 }],
      repeatUnderperformers: [{ playerId: "p1", name: "Repeat" }],
    });
    expect(category("starter_underperformed_once").appliesTo(ctx([t]), 1)).toBe(false);
  });
});

describe("taxi_over_5", () => {
  it("fires for a taxi score in [5, 10)", () => {
    const t = team({ taxiScores: [{ playerId: "p1", name: "Mid", points: 7 }] });
    expect(category("taxi_over_5").appliesTo(ctx([t]), 1)).toEqual({
      team: "Team A",
      player: "Mid",
      points: 7,
    });
  });
  it("does not fire at 10+ (belongs to taxi_over_10 instead)", () => {
    const t = team({ taxiScores: [{ playerId: "p1", name: "Mid", points: 10 }] });
    expect(category("taxi_over_5").appliesTo(ctx([t]), 1)).toBe(false);
  });
});

describe("undefeated_w2plus / winless_w2plus", () => {
  it("undefeated_w2plus fires at completed week 2-3", () => {
    const t = team({ losses: 0 });
    expect(category("undefeated_w2plus").appliesTo(ctx([t], 2), 1)).toEqual({
      team: "Team A",
      record: "5-0",
      week: 2,
    });
  });
  it("winless_w2plus fires at completed week 2-3", () => {
    const t = team({ wins: 0 });
    expect(category("winless_w2plus").appliesTo(ctx([t], 3), 1)).toEqual({
      team: "Team A",
      record: "0-3",
      week: 3,
    });
  });
});

describe("opp_* mutual exclusivity", () => {
  it("fires opp_undefeated for an undefeated upcoming opponent", () => {
    const t = team({ opponentRosterId: 2 });
    const opp = team({ rosterId: 2, teamName: "Rival", losses: 0 });
    expect(category("opp_undefeated").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Rival",
    });
  });
  it("keeps only the first true opp_* flag in listed order, dropping the rest", () => {
    // Opponent is both undefeated (0 losses) and coming off a win — opp_undefeated wins.
    const t = team({ opponentRosterId: 2 });
    const opp = team({
      rosterId: 2,
      teamName: "Rival",
      losses: 0,
      resultLastWeek: { result: "W", margin: 10, opponentRosterId: 1 },
    });
    const c = ctx([t, opp]);
    expect(category("opp_undefeated").appliesTo(c, 1)).toEqual({ team: "Team A", opponent: "Rival" });
    expect(category("opp_won_last").appliesTo(c, 1)).toBe(false);
  });
  it("opp_win_streak includes the streak length", () => {
    const t = team({ opponentRosterId: 2, wins: 5, losses: 5 });
    const opp = team({ rosterId: 2, teamName: "Rival", wins: 3, losses: 3, winStreak: 3 });
    expect(category("opp_win_streak").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Rival",
      streak: 3,
    });
  });
  it("opp_more_pf / opp_more_wins fire on their own comparisons", () => {
    const t = team({ opponentRosterId: 2, pointsFor: 500, wins: 2, losses: 2 });
    const opp = team({ rosterId: 2, teamName: "Rival", pointsFor: 900, wins: 2, losses: 2 });
    expect(category("opp_more_pf").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Rival",
    });
  });
  it("does not fire with no upcoming opponent", () => {
    expect(category("opp_undefeated").appliesTo(ctx([team()]), 1)).toBe(false);
  });
});

describe("expectations_*", () => {
  it("expectations_early_over500 fires weeks 1-4 above .500", () => {
    const t = team({ wins: 3, losses: 1, record: "3-1" });
    expect(category("expectations_early_over500").appliesTo(ctx([t], 3, 4), 1)).toEqual({
      team: "Team A",
      record: "3-1",
    });
  });
  it("expectations_early_at500 fires weeks 1-4 exactly at .500", () => {
    const t = team({ wins: 2, losses: 2, record: "2-2" });
    expect(category("expectations_early_at500").appliesTo(ctx([t], 3, 4), 1)).toEqual({
      team: "Team A",
      record: "2-2",
    });
  });
  it("expectations_early_under500 does not fire outside weeks 1-4", () => {
    const t = team({ wins: 0, losses: 3, record: "0-3" });
    expect(category("expectations_early_under500").appliesTo(ctx([t], 5, 5), 1)).toBe(false);
  });
  it("expectations_mid_* fires weeks 5-9", () => {
    const t = team({ wins: 6, losses: 2, record: "6-2" });
    expect(category("expectations_mid_over500").appliesTo(ctx([t], 6, 7), 1)).toEqual({
      team: "Team A",
      record: "6-2",
    });
  });
});

describe("late_division_*", () => {
  it("late_division_1st fires weeks 10-14 at rank 1", () => {
    const t = team({ divisionRank: 1 });
    expect(category("late_division_1st").appliesTo(ctx([t], 11, 12), 1)).toEqual({
      team: "Team A",
      record: "5-3",
    });
  });
  it("late_division_2nd3rd fires for ranks 2 and 3", () => {
    const rank2 = team({ divisionRank: 2 });
    const rank3 = team({ divisionRank: 3 });
    expect(category("late_division_2nd3rd").appliesTo(ctx([rank2], 11, 12), 1)).toEqual({
      team: "Team A",
      record: "5-3",
    });
    expect(category("late_division_2nd3rd").appliesTo(ctx([rank3], 11, 12), 1)).toEqual({
      team: "Team A",
      record: "5-3",
    });
  });
  it("late_division_4th fires for rank 4", () => {
    const t = team({ divisionRank: 4 });
    expect(category("late_division_4th").appliesTo(ctx([t], 11, 12), 1)).toEqual({
      team: "Team A",
      record: "5-3",
    });
  });
  it("does not fire outside weeks 10-14", () => {
    const t = team({ divisionRank: 1 });
    expect(category("late_division_1st").appliesTo(ctx([t], 8, 9), 1)).toBe(false);
  });
});

describe("division_game", () => {
  it("fires when the upcoming opponent is in the same division", () => {
    const t = team({ opponentRosterId: 2, division: 1 });
    const opp = team({ rosterId: 2, teamName: "Rival", division: 1 });
    expect(category("division_game").appliesTo(ctx([t, opp]), 1)).toEqual({
      team: "Team A",
      opponent: "Rival",
    });
  });
  it("does not fire across divisions", () => {
    const t = team({ opponentRosterId: 2, division: 1 });
    const opp = team({ rosterId: 2, teamName: "Rival", division: 2 });
    expect(category("division_game").appliesTo(ctx([t, opp]), 1)).toBe(false);
  });
});

describe("generic_fallback", () => {
  it("always applies for a known roster", () => {
    const t = team();
    expect(category("generic_fallback").appliesTo(ctx([t], 5, 6), 1)).toEqual({
      team: "Team A",
      record: "5-3",
      week: 5,
    });
  });
});
