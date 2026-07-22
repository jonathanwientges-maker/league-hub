import { useQuery } from "@tanstack/react-query";
import { useLeague } from "../hooks/useLeague";
import { useMatchups } from "../hooks/useMatchups";
import { useNflState } from "../hooks/useNflState";
import { LEAGUE_CONFIG } from "../config/league";
import { MEDIA_CONFIG } from "./config";
import { getAllRivals } from "./api";
import { getRivalryGames, type RivalryGame } from "./rivals";

export function useRivalryGames(leagueId: string): {
  games: RivalryGame[];
  upcomingWeek: number | undefined;
  isLoading: boolean;
} {
  const leagueQuery = useLeague(leagueId);
  const nflStateQuery = useNflState();
  const upcomingWeek = nflStateQuery.data?.week;
  const playoffWeekStart =
    leagueQuery.data?.settings.playoff_week_start ?? LEAGUE_CONFIG.regularSeasonWeeks + 1;
  const matchupsQuery = useMatchups(leagueId, upcomingWeek ?? 0, upcomingWeek);

  const rivalsQuery = useQuery({
    queryKey: ["mediaRoom", "rivals", MEDIA_CONFIG.season],
    queryFn: () => getAllRivals(MEDIA_CONFIG.season),
  });

  const games =
    matchupsQuery.data && upcomingWeek !== undefined && rivalsQuery.data
      ? getRivalryGames(
          rivalsQuery.data.map((r) => ({ rosterId: r.rosterId, rivals: r.rivalRosterIds })),
          upcomingWeek,
          matchupsQuery.data,
          playoffWeekStart
        )
      : [];

  return {
    games,
    upcomingWeek,
    isLoading:
      matchupsQuery.isLoading || leagueQuery.isLoading || nflStateQuery.isLoading || rivalsQuery.isLoading,
  };
}
