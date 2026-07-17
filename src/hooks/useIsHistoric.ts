import { useSeasonContext } from "../context/SeasonContext";

/**
 * A season's Sleeper data is immutable once its league status is "complete"
 * — used to switch hooks from short/live staleTimes to Infinity so historic
 * payloads are fetched once per browser, not on every visit.
 */
export function useIsHistoric(leagueId: string): boolean {
  const { chain } = useSeasonContext();
  const season = chain.find((ref) => ref.leagueId === leagueId);
  return season?.status === "complete";
}
