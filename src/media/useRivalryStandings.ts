import { useQuery } from "@tanstack/react-query";
import { useTeams } from "../hooks/useTeams";
import { LEAGUE_CONFIG } from "../config/league";
import { MEDIA_CONFIG } from "./config";
import { getAllRivals } from "./api";
import { computeRivalryStandings, buildRivalryRanking } from "./rivalryStandings";

/**
 * Season-long rivalry standings for the /rivalries page. Reuses useTeams'
 * already-fetched whole-regular-season weeklyScores — no separate matchup
 * fetch needed.
 */
export function useRivalryStandings(leagueId: string) {
  const teamsResult = useTeams(leagueId);

  const rivalsQuery = useQuery({
    queryKey: ["mediaRoom", "rivals", MEDIA_CONFIG.season],
    queryFn: () => getAllRivals(MEDIA_CONFIG.season),
  });

  const teams = teamsResult.data?.teams ?? [];
  const playoffWeekStart = teamsResult.data?.playoffWeekStart ?? LEAGUE_CONFIG.regularSeasonWeeks + 1;
  const entries = (rivalsQuery.data ?? []).map((r) => ({ rosterId: r.rosterId, rivals: r.rivalRosterIds }));

  const { records, gameLog } = computeRivalryStandings(teams, entries, playoffWeekStart);
  const { ranking, lambs } = buildRivalryRanking(teams, records);

  return {
    ranking,
    lambs,
    gameLog,
    teamsById: new Map(teams.map((t) => [t.rosterId, t])),
    isLoading: teamsResult.isLoading || rivalsQuery.isLoading,
    error: teamsResult.error ?? rivalsQuery.error ?? null,
  };
}
