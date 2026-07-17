import type {
  NflState,
  SleeperBracketMatchup,
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

const BASE_URL = "https://api.sleeper.app/v1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper API error ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export function getLeague(leagueId: string): Promise<SleeperLeague> {
  return fetchJson<SleeperLeague>(`/league/${leagueId}`);
}

export function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return fetchJson<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return fetchJson<SleeperUser[]>(`/league/${leagueId}/users`);
}

export function getMatchups(
  leagueId: string,
  week: number
): Promise<SleeperMatchup[]> {
  return fetchJson<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
}

export function getWinnersBracket(
  leagueId: string
): Promise<SleeperBracketMatchup[]> {
  return fetchJson<SleeperBracketMatchup[]>(
    `/league/${leagueId}/winners_bracket`
  );
}

export function getLosersBracket(
  leagueId: string
): Promise<SleeperBracketMatchup[]> {
  return fetchJson<SleeperBracketMatchup[]>(
    `/league/${leagueId}/losers_bracket`
  );
}

export function getNflState(): Promise<NflState> {
  return fetchJson<NflState>(`/state/nfl`);
}

export function getPlayers(): Promise<Record<string, SleeperPlayer>> {
  return fetchJson<Record<string, SleeperPlayer>>(`/players/nfl`);
}

export function getUserLeagues(
  userId: string,
  season: string
): Promise<SleeperLeague[]> {
  return fetchJson<SleeperLeague[]>(
    `/user/${userId}/leagues/nfl/${season}`
  );
}

export function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return fetchJson<SleeperDraft[]>(`/league/${leagueId}/drafts`);
}

export function getDraft(draftId: string): Promise<SleeperDraft> {
  return fetchJson<SleeperDraft>(`/draft/${draftId}`);
}

export function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return fetchJson<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
}
