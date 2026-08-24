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

/**
 * We always show the manager's account-level avatar (their Sleeper profile
 * picture) — NOT the league-specific team picture (metadata.avatar). Sleeper's
 * public /league/{id}/users endpoint serves the team picture from a backend
 * cache that can lag hours behind a manager's actual change (confirmed even
 * when hitting Sleeper's origin directly, bypassing every CDN/client cache),
 * whereas the account avatar — fetched live from /user/{id} and swapped in via
 * enrichUsersWithLiveAvatars — updates promptly. So the account avatar is the
 * reliable, fast-updating source and the one we render everywhere.
 */
export function resolveAvatarUrl(user: SleeperUser | undefined): string | null {
  return user?.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null;
}

/**
 * Replaces each user's stale league-snapshot `avatar` with the live account
 * avatar hash fetched from /user/{id}, when one is available. Falls through
 * unchanged for any user whose live hash hasn't loaded yet.
 */
export function enrichUsersWithLiveAvatars(
  users: SleeperUser[],
  liveAvatarById: Map<string, string | null>
): SleeperUser[] {
  return users.map((user) => {
    const fresh = liveAvatarById.get(user.user_id);
    return fresh ? { ...user, avatar: fresh } : user;
  });
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
      avatarUrl: resolveAvatarUrl(user),
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
