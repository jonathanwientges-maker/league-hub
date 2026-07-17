import type { SleeperRoster, SleeperUser } from "../api/types";
import type { Team, WeeklyScore } from "./types";
import type { WeekResult } from "./weeklyResults";

/**
 * Sleeper omits fpts_decimal/fpts_against_decimal entirely (not just 0)
 * until a roster has recorded its first stats — true for every roster in a
 * freshly-created, not-yet-started season. Without the fallback this
 * computes NaN, which then breaks every downstream numeric comparison
 * (rankByRecord's tiebreakers use `===`, which NaN never satisfies) and
 * can silently drop teams out of ranked results.
 */
function decimalPoints(whole: number | undefined, decimal: number | undefined): number {
  return (whole ?? 0) + (decimal ?? 0) / 100;
}

/** Builds the unified Team model from raw Sleeper rosters/users and derived weekly results. */
export function assembleTeams(
  rosters: SleeperRoster[],
  users: SleeperUser[],
  weekResultsByRoster: Map<number, WeekResult[]>
): Team[] {
  const usersById = new Map(users.map((user) => [user.user_id, user]));

  return rosters.map((roster) => {
    const user = usersById.get(roster.owner_id);

    const weeklyScores: WeeklyScore[] = (
      weekResultsByRoster.get(roster.roster_id) ?? []
    )
      .slice()
      .sort((a, b) => a.week - b.week)
      .map((result) => ({
        week: result.week,
        actualPoints: result.actualPoints,
        optimalPoints: 0,
        opponentRosterId: result.opponentRosterId,
        result: result.result,
      }));

    return {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      displayName: user?.display_name ?? "Unknown",
      teamName: user?.metadata?.team_name ?? user?.display_name ?? "Unknown",
      avatarUrl: user?.avatar
        ? `https://sleepercdn.com/avatars/${user.avatar}`
        : null,
      division: roster.settings.division ?? 0,
      wins: roster.settings.wins,
      losses: roster.settings.losses,
      ties: roster.settings.ties,
      pointsFor: decimalPoints(
        roster.settings.fpts,
        roster.settings.fpts_decimal
      ),
      pointsAgainst: decimalPoints(
        roster.settings.fpts_against,
        roster.settings.fpts_against_decimal
      ),
      weeklyScores,
      potentialPointsTotal: 0,
    };
  });
}
