import type { NflState, SleeperDraft, SleeperLeague } from "../api/types";

export type LeaguePhase =
  | "pre-draft-unscheduled"
  | "pre-draft-countdown"
  | "drafting"
  | "pre-season"
  | "regular-season"
  | "playoffs"
  | "complete";

/**
 * Single source of truth for which hero/home state to show. `drafts` is the
 * season's draft list from GET /league/{id}/drafts — this app only ever has
 * one draft per season, so `drafts[0]` is the one that matters.
 *
 * countdownOverride (LEAGUE_CONFIG.draftCountdownOverride) wins over
 * Sleeper's own draft.start_time when set.
 */
export function getLeaguePhase(
  league: SleeperLeague,
  drafts: SleeperDraft[],
  nflState: NflState,
  countdownOverride: string | null
): LeaguePhase {
  if (league.status === "complete") {
    return "complete";
  }

  const draft = drafts[0];

  if (draft?.status === "drafting") {
    return "drafting";
  }

  if (league.status === "pre_draft") {
    const overrideMs = countdownOverride ? Date.parse(countdownOverride) : null;
    const startTimeMs = overrideMs ?? draft?.start_time ?? null;

    if (startTimeMs === null) {
      return "pre-draft-unscheduled";
    }
    if (startTimeMs > Date.now()) {
      return "pre-draft-countdown";
    }
    // Start time has passed but Sleeper hasn't flipped the draft to
    // "drafting" yet — treat it as drafting rather than a stale countdown.
    return "drafting";
  }

  if (draft && draft.status !== "complete") {
    return "drafting";
  }

  if (nflState.week < 1) {
    return "pre-season";
  }

  if (nflState.week >= league.settings.playoff_week_start) {
    return "playoffs";
  }

  return "regular-season";
}
