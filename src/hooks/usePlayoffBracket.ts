import { useTeams } from "./useTeams";
import { useMatchups } from "./useMatchups";
import { buildPlayoffBracket } from "../domain/playoffBracket";
import type { PlayoffBracket } from "../domain/playoffBracket";
import type { SleeperMatchup } from "../api/types";

export function usePlayoffBracket(leagueId: string) {
  const teamsResult = useTeams(leagueId);
  const currentWeek = teamsResult.data?.currentWeek;

  const playoffWeekStart = teamsResult.data?.playoffWeekStart;
  // 0 disables the underlying query (useMatchups requires week > 0) until
  // the league's playoff_week_start is known.
  const week1 = playoffWeekStart ?? 0;
  const week2 = playoffWeekStart ? playoffWeekStart + 1 : 0;
  const week3 = playoffWeekStart ? playoffWeekStart + 2 : 0;

  const week1Query = useMatchups(leagueId, week1, currentWeek);
  const week2Query = useMatchups(leagueId, week2, currentWeek);
  const week3Query = useMatchups(leagueId, week3, currentWeek);

  const isLoading =
    teamsResult.isLoading ||
    week1Query.isLoading ||
    week2Query.isLoading ||
    week3Query.isLoading;

  const error =
    teamsResult.error ??
    week1Query.error ??
    week2Query.error ??
    week3Query.error ??
    null;

  let bracket: PlayoffBracket | undefined;
  if (
    teamsResult.data &&
    currentWeek !== undefined &&
    week1Query.data &&
    week2Query.data &&
    week3Query.data
  ) {
    const matchupsByWeek = new Map<number, SleeperMatchup[]>([
      [week1, week1Query.data],
      [week2, week2Query.data],
      [week3, week3Query.data],
    ]);

    bracket = buildPlayoffBracket({
      teams: teamsResult.data.teams,
      h2hMap: teamsResult.data.h2hMap,
      playoffWeekStart: teamsResult.data.playoffWeekStart,
      currentWeek,
      matchupsByWeek,
    });
  }

  return { bracket, isLoading, error };
}
