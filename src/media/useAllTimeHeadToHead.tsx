import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSeasonContext } from "../context/SeasonContext";
import { useTeams } from "../hooks/useTeams";
import { computeAllTimeHeadToHead, type HeadToHeadRecord } from "../domain/allTimeRecords";
import type { Team } from "../domain/types";

/**
 * One invisible loader per season in the chain — same "component per season,
 * report up via callback" shape History.tsx uses for its all-time records,
 * since hooks can't be called in a variable-length loop directly. Unlike
 * History's version this doesn't need bracket/placement data, just teams +
 * weeklyScores, so it goes straight to useTeams (works the same whether the
 * season is as-played or custom-rules — see allTimeRecords.ts's ownerId note).
 *
 * Reports via useEffect, not during render — calling onLoaded (which
 * setStates a different component, the hook's caller) synchronously inside
 * render throws "Cannot update a component while rendering a different
 * component" and loops. reported guards against re-reporting every render
 * once teams has already been sent up, same as History.tsx's loader cards.
 */
function SeasonTeamsLoader({
  leagueId,
  onLoaded,
}: {
  leagueId: string;
  onLoaded: (leagueId: string, teams: Team[]) => void;
}) {
  const { data } = useTeams(leagueId);
  const reported = useRef(false);

  useEffect(() => {
    if (data && !reported.current) {
      reported.current = true;
      onLoaded(leagueId, data.teams);
    }
  }, [data, leagueId, onLoaded]);

  return null;
}

export interface AllTimeHeadToHeadResult {
  record: HeadToHeadRecord | null;
  /** True until every season in the chain has reported its teams at least once. */
  isLoading: boolean;
  /** Invisible per-season loaders — render these once, anywhere, to feed the hook. */
  loaders: ReactNode;
}

/**
 * All-time (every season in the chain) head-to-head record between two
 * managers, for the Rivalry Game cards on the Home screen. Renders a small
 * loader per season to fetch each one's teams, then tallies with
 * computeAllTimeHeadToHead once they've all reported in.
 */
export function useAllTimeHeadToHead(ownerIdA: string, ownerIdB: string): AllTimeHeadToHeadResult {
  const { chain } = useSeasonContext();
  const [teamsByLeague, setTeamsByLeague] = useState<Map<string, Team[]>>(new Map());

  const handleLoaded = useCallback((leagueId: string, teams: Team[]) => {
    setTeamsByLeague((prev) => {
      if (prev.get(leagueId) === teams) return prev;
      const next = new Map(prev);
      next.set(leagueId, teams);
      return next;
    });
  }, []);

  const isLoading = chain.length === 0 || chain.some((season) => !teamsByLeague.has(season.leagueId));

  const record = isLoading
    ? null
    : computeAllTimeHeadToHead(
        chain.map((season) => ({ teams: teamsByLeague.get(season.leagueId) ?? [] })),
        ownerIdA,
        ownerIdB
      );

  return {
    record,
    isLoading,
    loaders: (
      <>
        {chain.map((season) => (
          <SeasonTeamsLoader key={season.leagueId} leagueId={season.leagueId} onLoaded={handleLoaded} />
        ))}
      </>
    ),
  };
}
