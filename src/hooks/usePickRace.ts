import { useTeams } from "./useTeams";
import { usePlayoffBracket } from "./usePlayoffBracket";
import { useMatchups } from "./useMatchups";
import { useLosersBracket } from "./useLosersBracket";
import { buildPickRace, buildDraftOrder } from "../domain/pickPlacement";
import type { PickRaceResult, DraftPick } from "../domain/pickPlacement";
import { LEAGUE_CONFIG } from "../config/league";

export function usePickRace(leagueId: string) {
  const teamsResult = useTeams(leagueId);
  const bracketResult = usePlayoffBracket(leagueId);
  const losersBracketQuery = useLosersBracket(leagueId);
  const currentWeek = teamsResult.data?.currentWeek;

  const playoffWeekStart = teamsResult.data?.playoffWeekStart;
  const semiWeek = playoffWeekStart
    ? playoffWeekStart + (LEAGUE_CONFIG.pickRaceSemiWeek - 1)
    : 0;
  const finalWeek = playoffWeekStart
    ? playoffWeekStart + (LEAGUE_CONFIG.pickRaceFinalWeek - 1)
    : 0;

  const semiWeekQuery = useMatchups(leagueId, semiWeek, currentWeek);
  const finalWeekQuery = useMatchups(leagueId, finalWeek, currentWeek);

  const isLoading =
    teamsResult.isLoading ||
    bracketResult.isLoading ||
    losersBracketQuery.isLoading ||
    semiWeekQuery.isLoading ||
    finalWeekQuery.isLoading;

  const error =
    teamsResult.error ??
    bracketResult.error ??
    losersBracketQuery.error ??
    semiWeekQuery.error ??
    finalWeekQuery.error ??
    null;

  let pickRace: PickRaceResult | undefined;
  let draftOrder: DraftPick[] | undefined;

  if (
    teamsResult.data &&
    bracketResult.bracket &&
    currentWeek !== undefined &&
    losersBracketQuery.data &&
    semiWeekQuery.data &&
    finalWeekQuery.data
  ) {
    pickRace = buildPickRace({
      teams: teamsResult.data.teams,
      h2hMap: teamsResult.data.h2hMap,
      playoffWeekStart: teamsResult.data.playoffWeekStart,
      currentWeek,
      semiWeekMatchups: semiWeekQuery.data,
      finalWeekMatchups: finalWeekQuery.data,
      losersBracket: losersBracketQuery.data,
    });

    draftOrder = buildDraftOrder(pickRace, bracketResult.bracket.games);
  }

  return { pickRace, draftOrder, isLoading, error };
}
