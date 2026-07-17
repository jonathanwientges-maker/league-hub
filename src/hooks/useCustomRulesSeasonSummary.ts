import { usePlayoffBracket } from "./usePlayoffBracket";
import { useTeams } from "./useTeams";
import { derivePlacements, type SeasonPlacement } from "../domain/asPlayed";
import { winPercentage } from "../domain/standings";

/**
 * Same shape as useAsPlayedSeasonResult, sourced from this league's custom
 * playoff rules instead — used for any historic season where
 * getSeasonMode() === "custom-rules" (a completed season played under the
 * 2026+ rules). buildPlayoffBracket is deterministic once the season is
 * over, so "the projected bracket" and "what actually happened" coincide.
 */
export function useCustomRulesSeasonSummary(leagueId: string) {
  const { bracket, isLoading: bracketLoading, error: bracketError } = usePlayoffBracket(leagueId);
  const teamsResult = useTeams(leagueId);
  const teams = teamsResult.data?.teams;

  let placements: SeasonPlacement[] | undefined;
  if (bracket && teams) {
    const placedRosterIds = new Set(
      bracket.games
        .filter((g) => g.id === "FINAL" || g.id === "THIRD" || g.id === "CONSOLATION")
        .flatMap((g) => [g.home, g.away])
        .filter((side): side is { rosterId: number; seed: number | null } => "rosterId" in side)
        .map((side) => side.rosterId)
    );
    const nonPlayoffTeams = teams
      .filter((t) => !placedRosterIds.has(t.rosterId))
      .sort((a, b) => winPercentage(b) - winPercentage(a) || b.pointsFor - a.pointsFor);

    placements = derivePlacements(
      bracket,
      nonPlayoffTeams.map((t) => t.rosterId)
    );
  }

  return {
    placements,
    teams,
    isLoading: bracketLoading || teamsResult.isLoading,
    error: bracketError ?? teamsResult.error ?? null,
  };
}
