import { getLeague, getNflState, getUserLeagues } from "../api/sleeper";
import type { SleeperLeague } from "../api/types";

export interface SeasonRef {
  leagueId: string;
  season: string;
  name: string;
  status: string;
}

const MAX_BACKWARD_DEPTH = 20;

function toSeasonRef(league: SleeperLeague): SeasonRef {
  return {
    leagueId: league.league_id,
    season: league.season,
    name: league.name,
    status: league.status,
  };
}

/**
 * Walks previous_league_id backward from the anchor league, oldest first.
 * Guards against malformed data with a visited-set (breaks cycles) and a
 * max-depth cap, rather than trusting Sleeper's chain to always terminate.
 */
export async function discoverSeasonChain(
  anchorLeagueId: string
): Promise<SeasonRef[]> {
  const anchor = await getLeague(anchorLeagueId);
  const chain: SeasonRef[] = [toSeasonRef(anchor)];
  const visited = new Set<string>([anchor.league_id]);

  let previousId = anchor.previous_league_id;
  let depth = 0;

  while (
    previousId &&
    previousId !== "0" &&
    !visited.has(previousId) &&
    depth < MAX_BACKWARD_DEPTH
  ) {
    visited.add(previousId);
    const league = await getLeague(previousId);
    chain.unshift(toSeasonRef(league));
    previousId = league.previous_league_id;
    depth += 1;
  }

  return chain;
}

/**
 * Finds the league in `candidates` whose previous_league_id points exactly
 * at `targetLeagueId`. Matching is by pointer only — never by league name,
 * since two unrelated leagues can share a display name.
 */
function findChild(
  candidates: SleeperLeague[],
  targetLeagueId: string
): SleeperLeague | undefined {
  const matches = candidates.filter(
    (league) => league.previous_league_id === targetLeagueId
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export interface DiscoverCurrentSeasonResult {
  chain: SeasonRef[];
  current: SeasonRef;
  isAwaitingNewSeason: boolean;
}

/**
 * Extends `chain` forward past its newest known season by checking Sleeper's
 * global NFL state for the current season, then listing the anchor owner's
 * leagues for that season and matching by previous_league_id. Loops in case
 * more than one season was skipped since the chain was last resolved.
 */
export async function discoverCurrentSeason(
  ownerUserId: string,
  chain: SeasonRef[]
): Promise<DiscoverCurrentSeasonResult> {
  if (chain.length === 0) {
    throw new Error("discoverCurrentSeason requires a non-empty chain");
  }

  const nflState = await getNflState();

  let workingChain = chain;
  let newest = workingChain[workingChain.length - 1];

  while (newest.season !== nflState.season) {
    const candidates = await getUserLeagues(ownerUserId, nflState.season);
    const child = findChild(candidates, newest.leagueId);
    if (!child) {
      return { chain: workingChain, current: newest, isAwaitingNewSeason: true };
    }
    const childRef = toSeasonRef(child);
    workingChain = [...workingChain, childRef];
    newest = childRef;
  }

  return { chain: workingChain, current: newest, isAwaitingNewSeason: false };
}

export function getNextSeason(
  chain: SeasonRef[],
  season: SeasonRef
): SeasonRef | undefined {
  const index = chain.findIndex((ref) => ref.leagueId === season.leagueId);
  if (index === -1) return undefined;
  return chain[index + 1];
}
