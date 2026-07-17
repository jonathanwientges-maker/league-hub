import { getNextSeason, type SeasonRef } from "../domain/seasonChain";
import { buildHistoricDraftOrder } from "../domain/asPlayed";
import { useSeasonContext } from "../context/SeasonContext";
import { useLeagueDrafts } from "./useLeagueDrafts";
import { useDraftPicks } from "./useDraftPicks";

/**
 * The draft order a historic season produced lives on the NEXT season's
 * league in Sleeper's chain — there's nothing to show if that season hasn't
 * been created yet (see isAwaitingNewSeason at the tail of the chain).
 */
export function useHistoricDraftOrder(season: SeasonRef | undefined) {
  const { chain } = useSeasonContext();
  const nextSeason = season ? getNextSeason(chain, season) : undefined;

  const draftsQuery = useLeagueDrafts(nextSeason?.leagueId ?? "");
  const draft = draftsQuery.data?.[0];
  const picksQuery = useDraftPicks(draft?.draft_id);

  const draftOrder = picksQuery.data ? buildHistoricDraftOrder(picksQuery.data) : undefined;

  return {
    nextSeason,
    draftOrder,
    isLoading: draftsQuery.isLoading || picksQuery.isLoading,
    error: draftsQuery.error ?? picksQuery.error ?? null,
  };
}
