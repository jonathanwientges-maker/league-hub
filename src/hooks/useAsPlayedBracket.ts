import { useTeams } from "./useTeams";
import { useMatchups } from "./useMatchups";
import { useWinnersBracket } from "./useWinnersBracket";
import { useLosersBracket } from "./useLosersBracket";
import { resolveBracket } from "../domain/asPlayed";
import type { PlayoffBracket } from "../domain/playoffBracket";
import type { SleeperMatchup } from "../api/types";

/**
 * As-played counterpart to usePlayoffBracket: resolves Sleeper's actual
 * recorded winners + losers brackets instead of computing this league's
 * custom reseeded bracket.
 */
export function useAsPlayedBracket(leagueId: string) {
  const teamsResult = useTeams(leagueId);
  const currentWeek = teamsResult.data?.currentWeek;
  const playoffWeekStart = teamsResult.data?.playoffWeekStart;

  const week1 = playoffWeekStart ?? 0;
  const week2 = playoffWeekStart ? playoffWeekStart + 1 : 0;
  const week3 = playoffWeekStart ? playoffWeekStart + 2 : 0;

  const week1Query = useMatchups(leagueId, week1, currentWeek);
  const week2Query = useMatchups(leagueId, week2, currentWeek);
  const week3Query = useMatchups(leagueId, week3, currentWeek);
  const winnersQuery = useWinnersBracket(leagueId);
  const losersQuery = useLosersBracket(leagueId);

  const isLoading =
    teamsResult.isLoading ||
    week1Query.isLoading ||
    week2Query.isLoading ||
    week3Query.isLoading ||
    winnersQuery.isLoading ||
    losersQuery.isLoading;

  const error =
    teamsResult.error ??
    week1Query.error ??
    week2Query.error ??
    week3Query.error ??
    winnersQuery.error ??
    losersQuery.error ??
    null;

  let winnersBracket: PlayoffBracket | undefined;
  let losersBracket: PlayoffBracket | undefined;

  if (
    playoffWeekStart !== undefined &&
    week1Query.data &&
    week2Query.data &&
    week3Query.data &&
    winnersQuery.data &&
    losersQuery.data
  ) {
    const matchupsByWeek = new Map<number, SleeperMatchup[]>([
      [week1, week1Query.data],
      [week2, week2Query.data],
      [week3, week3Query.data],
    ]);

    winnersBracket = resolveBracket(winnersQuery.data, matchupsByWeek, playoffWeekStart);
    losersBracket = resolveBracket(losersQuery.data, matchupsByWeek, playoffWeekStart);
  }

  return {
    winnersBracket,
    losersBracket,
    teams: teamsResult.data?.teams,
    isLoading,
    error,
  };
}
