import { useAsPlayedBracket } from "./useAsPlayedBracket";
import { useHistoricDraftOrder } from "./useHistoricDraftOrder";
import { useSeasonContext } from "../context/SeasonContext";
import { derivePlacements, type SeasonPlacement } from "../domain/asPlayed";
import { winPercentage } from "../domain/standings";

export function useAsPlayedSeasonResult(leagueId: string) {
  const { selectedSeason } = useSeasonContext();
  const { winnersBracket, teams, isLoading: bracketLoading, error: bracketError } =
    useAsPlayedBracket(leagueId);
  const { draftOrder, nextSeason, isLoading: draftLoading, error: draftError } =
    useHistoricDraftOrder(selectedSeason);

  let placements: SeasonPlacement[] | undefined;
  if (winnersBracket && teams) {
    const placedRosterIds = new Set(
      winnersBracket.games
        .filter((g) => g.id === "FINAL" || g.id === "THIRD" || g.id === "CONSOLATION")
        .flatMap((g) => [g.home, g.away])
        .filter((side): side is { rosterId: number; seed: number | null } => "rosterId" in side)
        .map((side) => side.rosterId)
    );
    const nonPlayoffTeams = teams
      .filter((t) => !placedRosterIds.has(t.rosterId))
      .sort((a, b) => winPercentage(b) - winPercentage(a) || b.pointsFor - a.pointsFor);

    placements = derivePlacements(
      winnersBracket,
      nonPlayoffTeams.map((t) => t.rosterId)
    );
  }

  return {
    placements,
    teams,
    draftOrder,
    nextSeason,
    isLoading: bracketLoading || draftLoading,
    error: bracketError ?? draftError,
  };
}
