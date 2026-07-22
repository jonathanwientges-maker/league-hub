import { MEDIA_CONFIG } from "../config";
import type { WeekContext, WeekTeamContext } from "./weekContext";

export interface MediaCategory {
  id: string;
  weight: 1 | 2 | 4 | 8;
  appliesTo(ctx: WeekContext, rosterId: number): false | Record<string, string | number>;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const POSITION_GROUPS = ["QB", "RB", "WR", "TE"] as const;

function weakestPositionGroup(
  t: WeekTeamContext
): { position: (typeof POSITION_GROUPS)[number]; points: number } | null {
  const thresholds = MEDIA_CONFIG.thresholds.positionGroup;
  let best: { position: (typeof POSITION_GROUPS)[number]; points: number; shortfall: number } | null =
    null;
  for (const position of POSITION_GROUPS) {
    const points = t.starterPointsByPosition[position];
    const threshold = thresholds[position];
    if (points < threshold) {
      const shortfall = (threshold - points) / threshold;
      if (!best || shortfall > best.shortfall) {
        best = { position, points, shortfall };
      }
    }
  }
  return best ? { position: best.position, points: best.points } : null;
}

const OPP_ORDER = [
  "opp_undefeated",
  "opp_winless",
  "opp_won_last",
  "opp_lost_last",
  "opp_win_streak",
  "opp_loss_streak",
  "opp_more_pf",
  "opp_more_wins",
] as const;
type OppId = (typeof OPP_ORDER)[number];

function computeOppFlags(t: WeekTeamContext, opp: WeekTeamContext): Record<OppId, boolean> {
  return {
    opp_undefeated: opp.losses === 0,
    opp_winless: opp.wins === 0,
    opp_won_last: opp.resultLastWeek?.result === "W",
    opp_lost_last: opp.resultLastWeek?.result === "L",
    opp_win_streak: opp.winStreak >= MEDIA_CONFIG.thresholds.streakMin,
    opp_loss_streak: opp.lossStreak >= MEDIA_CONFIG.thresholds.streakMin,
    opp_more_pf: opp.pointsFor > t.pointsFor,
    opp_more_wins: opp.wins > t.wins,
  };
}

function earlierOppFlagTrue(flags: Record<OppId, boolean>, id: OppId): boolean {
  for (const key of OPP_ORDER) {
    if (key === id) return false;
    if (flags[key]) return true;
  }
  return false;
}

function oppCategory(
  id: OppId,
  extraPayload?: (opp: WeekTeamContext) => Record<string, string | number>
): MediaCategory {
  return {
    id,
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.opponentRosterId === null) return false;
      const opp = ctx.teams.get(t.opponentRosterId);
      if (!opp) return false;
      const flags = computeOppFlags(t, opp);
      if (!flags[id] || earlierOppFlagTrue(flags, id)) return false;
      return { team: t.teamName, opponent: opp.teamName, ...(extraPayload ? extraPayload(opp) : {}) };
    },
  };
}

function divisionRankLabel(rank: number): "1st" | "2nd3rd" | "4th" {
  if (rank === 1) return "1st";
  if (rank >= 2 && rank <= 3) return "2nd3rd";
  return "4th";
}

export const CATEGORIES: MediaCategory[] = [
  // --- weight 8 ---
  {
    id: "bye_player_started",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.byeStarters.length === 0) return false;
      return { team: t.teamName, player: t.byeStarters[0].name };
    },
  },
  {
    id: "out_player_started",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.outStarters.length === 0) return false;
      return { team: t.teamName, player: t.outStarters[0].name };
    },
  },
  {
    id: "starter_underperformed_repeat",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.repeatUnderperformers.length === 0) return false;
      return { team: t.teamName, player: t.repeatUnderperformers[0].name };
    },
  },
  {
    id: "taxi_over_10",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.taxiScores.length === 0) return false;
      const best = t.taxiScores.reduce((a, b) => (b.points > a.points ? b : a));
      if (best.points < MEDIA_CONFIG.thresholds.taxiGreat) return false;
      return { team: t.teamName, player: best.name, points: round1(best.points) };
    },
  },
  {
    id: "player_to_ir",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.newIrPlayers.length === 0) return false;
      return { team: t.teamName, player: t.newIrPlayers[0].name };
    },
  },
  {
    id: "taxi_all_under_3",
    weight: 8,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.taxiScores.length === 0) return false;
      if (!t.taxiScores.every((p) => p.points < MEDIA_CONFIG.thresholds.taxiAllBad)) return false;
      return { team: t.teamName };
    },
  },

  // --- weight 4 ---
  {
    id: "close_win",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      const r = t?.resultLastWeek;
      if (!t || !r || r.result !== "W" || r.margin > MEDIA_CONFIG.thresholds.closeMargin) return false;
      const opp = ctx.teams.get(r.opponentRosterId);
      return { team: t.teamName, opponent: opp?.teamName ?? "?", margin: round1(r.margin) };
    },
  },
  {
    id: "blowout_win",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      const r = t?.resultLastWeek;
      if (!t || !r || r.result !== "W" || r.margin < MEDIA_CONFIG.thresholds.blowoutMargin) return false;
      const opp = ctx.teams.get(r.opponentRosterId);
      return { team: t.teamName, opponent: opp?.teamName ?? "?", margin: round1(r.margin) };
    },
  },
  {
    id: "close_loss",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      const r = t?.resultLastWeek;
      if (!t || !r || r.result !== "L" || r.margin > MEDIA_CONFIG.thresholds.closeMargin) return false;
      const opp = ctx.teams.get(r.opponentRosterId);
      return { team: t.teamName, opponent: opp?.teamName ?? "?", margin: round1(r.margin) };
    },
  },
  {
    id: "blowout_loss",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      const r = t?.resultLastWeek;
      if (!t || !r || r.result !== "L" || r.margin < MEDIA_CONFIG.thresholds.blowoutMargin) return false;
      const opp = ctx.teams.get(r.opponentRosterId);
      return { team: t.teamName, opponent: opp?.teamName ?? "?", margin: round1(r.margin) };
    },
  },
  {
    id: "win_streak_3",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.winStreak < MEDIA_CONFIG.thresholds.streakMin) return false;
      return { team: t.teamName, streak: t.winStreak };
    },
  },
  {
    id: "loss_streak_3",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.lossStreak < MEDIA_CONFIG.thresholds.streakMin) return false;
      return { team: t.teamName, streak: t.lossStreak };
    },
  },
  {
    id: "bench_outperformed",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.benchOutperformers.length === 0) return false;
      const best = t.benchOutperformers[0];
      return { team: t.teamName, player: best.name, points: round1(best.points), position: best.position };
    },
  },
  {
    id: "win_weak_position_group",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.resultLastWeek?.result !== "W") return false;
      const weak = weakestPositionGroup(t);
      if (!weak) return false;
      return { team: t.teamName, position: weak.position, points: round1(weak.points) };
    },
  },
  {
    id: "loss_weak_position_group",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.resultLastWeek?.result !== "L") return false;
      const weak = weakestPositionGroup(t);
      if (!weak) return false;
      return { team: t.teamName, position: weak.position, points: round1(weak.points) };
    },
  },
  {
    id: "undefeated_after_w4",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.losses !== 0 || ctx.completedWeek < 4 || ctx.completedWeek > 5) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "undefeated_after_w6",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.losses !== 0 || ctx.completedWeek < 6) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "winless_after_w4",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.wins !== 0 || ctx.completedWeek < 4 || ctx.completedWeek > 5) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "winless_after_w6",
    weight: 4,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.wins !== 0 || ctx.completedWeek < 6) return false;
      return { team: t.teamName, record: t.record };
    },
  },

  // --- weight 2 ---
  {
    id: "starter_underperformed_once",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t) return false;
      const repeatIds = new Set(t.repeatUnderperformers.map((p) => p.playerId));
      const candidates = t.underperformingStarters.filter((p) => !repeatIds.has(p.playerId));
      if (candidates.length === 0) return false;
      const lowest = candidates[0];
      return { team: t.teamName, player: lowest.name, points: round1(lowest.points) };
    },
  },
  {
    id: "taxi_over_5",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.taxiScores.length === 0) return false;
      const best = t.taxiScores.reduce((a, b) => (b.points > a.points ? b : a));
      if (
        best.points < MEDIA_CONFIG.thresholds.taxiGood ||
        best.points >= MEDIA_CONFIG.thresholds.taxiGreat
      ) {
        return false;
      }
      return { team: t.teamName, player: best.name, points: round1(best.points) };
    },
  },
  {
    id: "undefeated_w2plus",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.losses !== 0 || ctx.completedWeek < 2 || ctx.completedWeek > 3) return false;
      return { team: t.teamName, record: t.record, week: ctx.completedWeek };
    },
  },
  {
    id: "winless_w2plus",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.wins !== 0 || ctx.completedWeek < 2 || ctx.completedWeek > 3) return false;
      return { team: t.teamName, record: t.record, week: ctx.completedWeek };
    },
  },
  oppCategory("opp_undefeated"),
  oppCategory("opp_winless"),
  oppCategory("opp_won_last"),
  oppCategory("opp_lost_last"),
  oppCategory("opp_win_streak", (opp) => ({ streak: opp.winStreak })),
  oppCategory("opp_loss_streak", (opp) => ({ streak: opp.lossStreak })),
  oppCategory("opp_more_pf"),
  oppCategory("opp_more_wins"),
  {
    id: "expectations_early_over500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 1 || ctx.upcomingWeek > 4 || t.wins <= t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "expectations_early_at500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 1 || ctx.upcomingWeek > 4 || t.wins !== t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "expectations_early_under500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 1 || ctx.upcomingWeek > 4 || t.wins >= t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "expectations_mid_over500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 5 || ctx.upcomingWeek > 9 || t.wins <= t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "expectations_mid_at500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 5 || ctx.upcomingWeek > 9 || t.wins !== t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "expectations_mid_under500",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 5 || ctx.upcomingWeek > 9 || t.wins >= t.losses) return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "late_division_1st",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 10 || ctx.upcomingWeek > 14) return false;
      if (divisionRankLabel(t.divisionRank) !== "1st") return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "late_division_2nd3rd",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 10 || ctx.upcomingWeek > 14) return false;
      if (divisionRankLabel(t.divisionRank) !== "2nd3rd") return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "late_division_4th",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || ctx.upcomingWeek < 10 || ctx.upcomingWeek > 14) return false;
      if (divisionRankLabel(t.divisionRank) !== "4th") return false;
      return { team: t.teamName, record: t.record };
    },
  },
  {
    id: "division_game",
    weight: 2,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t || t.opponentRosterId === null) return false;
      const opp = ctx.teams.get(t.opponentRosterId);
      if (!opp || opp.division !== t.division) return false;
      return { team: t.teamName, opponent: opp.teamName };
    },
  },

  // --- weight 1 ---
  {
    id: "generic_fallback",
    weight: 1,
    appliesTo(ctx, rosterId) {
      const t = ctx.teams.get(rosterId);
      if (!t) return false;
      return { team: t.teamName, record: t.record, week: ctx.completedWeek };
    },
  },
];
