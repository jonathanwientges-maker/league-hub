import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getMatchups } from "../../api/sleeper";
import type { SleeperMatchup, SleeperPlayer, SleeperRoster } from "../../api/types";
import type { Team } from "../../domain/types";
import { assembleTeams, enrichUsersWithLiveAvatars } from "../../domain/team";
import { buildAllWeekResults, buildWeekResultsByRoster, groupMatchupsByMatchupId } from "../../domain/weeklyResults";
import { buildH2hMap } from "../../domain/h2h";
import { rankDivisions } from "../../domain/standings";
import { LEAGUE_CONFIG } from "../../config/league";
import { MEDIA_CONFIG } from "../config";
import { useLeague } from "../../hooks/useLeague";
import { useRosters } from "../../hooks/useRosters";
import { useUsers } from "../../hooks/useUsers";
import { useLiveUserAvatars } from "../../hooks/useLiveAvatars";
import { usePlayers } from "../../hooks/usePlayers";
import { useNflState } from "../../hooks/useNflState";
import byeWeeksBySeason from "../../../data/nfl-bye-weeks.json";

const OUT_STATUSES = new Set(["Out", "IR", "PUP", "Sus"]);

export interface TaxiScore {
  playerId: string;
  name: string;
  points: number;
}

export interface BenchOutperformer {
  playerId: string;
  name: string;
  position: string;
  points: number;
}

export interface ScoredPlayer {
  playerId: string;
  name: string;
  points: number;
}

export interface FlaggedPlayer {
  playerId: string;
  name: string;
}

export interface ResultLastWeek {
  result: "W" | "L" | "T";
  margin: number;
  opponentRosterId: number;
}

export interface WeekTeamContext {
  rosterId: number;
  teamName: string;
  avatarUrl: string | null;
  division: number;
  divisionRank: number;
  wins: number;
  losses: number;
  ties: number;
  record: string;
  pointsFor: number;
  resultLastWeek: ResultLastWeek | null;
  winStreak: number;
  lossStreak: number;
  starterPointsByPosition: { QB: number; RB: number; WR: number; TE: number };
  benchOutperformers: BenchOutperformer[];
  underperformingStarters: ScoredPlayer[];
  repeatUnderperformers: FlaggedPlayer[];
  byeStarters: FlaggedPlayer[];
  outStarters: FlaggedPlayer[];
  newIrPlayers: FlaggedPlayer[];
  taxiScores: TaxiScore[];
  opponentRosterId: number | null;
}

export interface WeekContext {
  season: string;
  completedWeek: number;
  upcomingWeek: number;
  teams: Map<number, WeekTeamContext>;
}

export interface WeekContextInput {
  season: string;
  completedWeek: number;
  upcomingWeek: number;
  teams: Team[];
  rosters: SleeperRoster[];
  /** Must cover every week from 1 through completedWeek, plus upcomingWeek. */
  matchupsByWeek: Map<number, SleeperMatchup[]>;
  players: Record<string, SleeperPlayer>;
  byeWeeks: Record<string, number>;
  outStatusSnapshot: Record<string, string> | null;
}

function playerName(players: Record<string, SleeperPlayer>, id: string): string {
  return players[id]?.full_name ?? id;
}

function matchupFor(
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  week: number,
  rosterId: number
): SleeperMatchup | undefined {
  return matchupsByWeek.get(week)?.find((m) => m.roster_id === rosterId);
}

function computeUpcomingOpponents(
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  upcomingWeek: number
): Map<number, number> {
  const map = new Map<number, number>();
  for (const group of groupMatchupsByMatchupId(matchupsByWeek.get(upcomingWeek) ?? [])) {
    if (group.length !== 2) continue;
    const [a, b] = group;
    map.set(a.roster_id, b.roster_id);
    map.set(b.roster_id, a.roster_id);
  }
  return map;
}

function computeStreaks(
  weeklyScores: Team["weeklyScores"],
  completedWeek: number
): { winStreak: number; lossStreak: number } {
  const byWeek = new Map(weeklyScores.map((w) => [w.week, w.result]));
  let winStreak = 0;
  for (let w = completedWeek; w >= 1; w--) {
    if (byWeek.get(w) === "W") winStreak++;
    else break;
  }
  let lossStreak = 0;
  for (let w = completedWeek; w >= 1; w--) {
    if (byWeek.get(w) === "L") lossStreak++;
    else break;
  }
  return { winStreak, lossStreak };
}

function computeResultLastWeek(
  team: Team,
  teamsById: Map<number, Team>,
  completedWeek: number
): ResultLastWeek | null {
  const entry = team.weeklyScores.find((w) => w.week === completedWeek);
  if (!entry || entry.result === null || entry.opponentRosterId === null) return null;
  const oppEntry = teamsById
    .get(entry.opponentRosterId)
    ?.weeklyScores.find((w) => w.week === completedWeek);
  const oppPoints = oppEntry?.actualPoints ?? 0;
  return {
    result: entry.result,
    margin: Math.round(Math.abs(entry.actualPoints - oppPoints) * 10) / 10,
    opponentRosterId: entry.opponentRosterId,
  };
}

function computeStarterPointsByPosition(
  matchup: SleeperMatchup,
  players: Record<string, SleeperPlayer>
): { QB: number; RB: number; WR: number; TE: number } {
  const totals = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const id of matchup.starters) {
    if (!id || id === "0") continue;
    const position = players[id]?.position;
    if (position && position in totals) {
      totals[position as keyof typeof totals] += matchup.players_points[id] ?? 0;
    }
  }
  return totals;
}

function computeBenchOutperformers(
  matchup: SleeperMatchup,
  players: Record<string, SleeperPlayer>
): BenchOutperformer[] {
  const starterIds = matchup.starters.filter((id) => id && id !== "0");
  const starterSet = new Set(starterIds);
  const starterPointsByPosition = new Map<string, number[]>();
  for (const id of starterIds) {
    const position = players[id]?.position;
    if (!position) continue;
    const arr = starterPointsByPosition.get(position) ?? [];
    arr.push(matchup.players_points[id] ?? 0);
    starterPointsByPosition.set(position, arr);
  }

  const result: BenchOutperformer[] = [];
  for (const id of matchup.players) {
    if (starterSet.has(id)) continue;
    const position = players[id]?.position;
    if (!position || position === "QB") continue;
    const points = matchup.players_points[id] ?? 0;
    if (points < MEDIA_CONFIG.thresholds.benchOutperformMin) continue;
    const starterPoints = starterPointsByPosition.get(position) ?? [];
    if (starterPoints.some((sp) => points > sp)) {
      result.push({ playerId: id, name: playerName(players, id), position, points });
    }
  }
  return result.sort((a, b) => b.points - a.points);
}

function computeUnderperformingStarters(
  matchup: SleeperMatchup,
  players: Record<string, SleeperPlayer>
): ScoredPlayer[] {
  const result: ScoredPlayer[] = [];
  for (const id of matchup.starters) {
    if (!id || id === "0") continue;
    const position = players[id]?.position;
    if (position === "TE") continue;
    const points = matchup.players_points[id] ?? 0;
    if (points < MEDIA_CONFIG.thresholds.starterUnderperform) {
      result.push({ playerId: id, name: playerName(players, id), points });
    }
  }
  return result.sort((a, b) => a.points - b.points);
}

function computeRepeatUnderperformers(
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  rosterId: number,
  players: Record<string, SleeperPlayer>,
  completedWeek: number
): FlaggedPlayer[] {
  if (completedWeek < 3) return [];
  const weekMatchups = [completedWeek, completedWeek - 1, completedWeek - 2].map((w) =>
    matchupFor(matchupsByWeek, w, rosterId)
  );
  if (weekMatchups.some((m) => !m)) return [];
  const [m0, m1, m2] = weekMatchups as SleeperMatchup[];

  const flagged: FlaggedPlayer[] = [];
  for (const id of m0.starters) {
    if (!id || id === "0") continue;
    const qualifies = [m0, m1, m2].every((m) => {
      if (!m.starters.includes(id)) return false;
      const points = m.players_points[id] ?? 0;
      return points < MEDIA_CONFIG.thresholds.starterUnderperform;
    });
    if (qualifies) flagged.push({ playerId: id, name: playerName(players, id) });
  }
  return flagged;
}

function computeByeStarters(
  matchup: SleeperMatchup,
  players: Record<string, SleeperPlayer>,
  byeWeeks: Record<string, number>,
  completedWeek: number
): FlaggedPlayer[] {
  const result: FlaggedPlayer[] = [];
  for (const id of matchup.starters) {
    if (!id || id === "0") continue;
    const team = players[id]?.team;
    if (!team) continue;
    if (byeWeeks[team] === completedWeek) {
      result.push({ playerId: id, name: playerName(players, id) });
    }
  }
  return result;
}

function computeOutStarters(
  matchup: SleeperMatchup,
  players: Record<string, SleeperPlayer>,
  byeWeeks: Record<string, number>,
  completedWeek: number,
  outStatusSnapshot: Record<string, string> | null
): FlaggedPlayer[] {
  const result: FlaggedPlayer[] = [];
  for (const id of matchup.starters) {
    if (!id || id === "0") continue;
    if (outStatusSnapshot) {
      const status = outStatusSnapshot[id];
      if (status && OUT_STATUSES.has(status)) {
        result.push({ playerId: id, name: playerName(players, id) });
      }
      continue;
    }
    const points = matchup.players_points[id] ?? 0;
    if (points !== 0) continue;
    const team = players[id]?.team;
    const onBye = team ? byeWeeks[team] === completedWeek : false;
    if (onBye) continue;
    const status = players[id]?.injury_status;
    if (status && OUT_STATUSES.has(status)) {
      result.push({ playerId: id, name: playerName(players, id) });
    }
  }
  return result;
}

function computeNewIrPlayers(
  roster: SleeperRoster,
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  completedWeek: number,
  players: Record<string, SleeperPlayer>
): FlaggedPlayer[] {
  const result: FlaggedPlayer[] = [];
  for (const id of roster.reserve ?? []) {
    let scoredEarlier = false;
    for (let w = 1; w < completedWeek; w++) {
      const points = matchupFor(matchupsByWeek, w, roster.roster_id)?.players_points[id];
      if (points !== undefined && points > 0) {
        scoredEarlier = true;
        break;
      }
    }
    if (scoredEarlier) result.push({ playerId: id, name: playerName(players, id) });
  }
  return result;
}

function computeTaxiScores(
  roster: SleeperRoster,
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  completedWeek: number,
  players: Record<string, SleeperPlayer>
): TaxiScore[] {
  const matchup = matchupFor(matchupsByWeek, completedWeek, roster.roster_id);
  return (roster.taxi ?? []).map((id) => ({
    playerId: id,
    name: playerName(players, id),
    points: matchup?.players_points[id] ?? 0,
  }));
}

/** Pure assembly of the per-roster derived data every category predicate reads. */
export function computeWeekContext(input: WeekContextInput): WeekContext {
  const { season, completedWeek, upcomingWeek, teams, rosters, matchupsByWeek, players, byeWeeks, outStatusSnapshot } =
    input;

  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));
  const rostersById = new Map(rosters.map((r) => [r.roster_id, r]));

  const completedMatchupsByWeek = new Map(
    [...matchupsByWeek].filter(([w]) => w <= completedWeek)
  );
  const h2hMap = buildH2hMap(buildAllWeekResults(completedMatchupsByWeek));
  const rankByRoster = new Map(
    rankDivisions(teams, h2hMap).map((d) => [d.team.rosterId, d.rank])
  );
  const upcomingOpponents = computeUpcomingOpponents(matchupsByWeek, upcomingWeek);

  const teamContexts = new Map<number, WeekTeamContext>();

  for (const team of teams) {
    const roster = rostersById.get(team.rosterId);
    const matchup = matchupFor(matchupsByWeek, completedWeek, team.rosterId);

    teamContexts.set(team.rosterId, {
      rosterId: team.rosterId,
      teamName: team.teamName,
      avatarUrl: team.avatarUrl,
      division: team.division,
      divisionRank: rankByRoster.get(team.rosterId) ?? 0,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      record: `${team.wins}-${team.losses}`,
      pointsFor: team.pointsFor,
      resultLastWeek: computeResultLastWeek(team, teamsById, completedWeek),
      ...computeStreaks(team.weeklyScores, completedWeek),
      starterPointsByPosition: matchup
        ? computeStarterPointsByPosition(matchup, players)
        : { QB: 0, RB: 0, WR: 0, TE: 0 },
      benchOutperformers: matchup ? computeBenchOutperformers(matchup, players) : [],
      underperformingStarters: matchup ? computeUnderperformingStarters(matchup, players) : [],
      repeatUnderperformers: computeRepeatUnderperformers(
        matchupsByWeek,
        team.rosterId,
        players,
        completedWeek
      ),
      byeStarters: matchup ? computeByeStarters(matchup, players, byeWeeks, completedWeek) : [],
      outStarters: matchup
        ? computeOutStarters(matchup, players, byeWeeks, completedWeek, outStatusSnapshot)
        : [],
      newIrPlayers: roster
        ? computeNewIrPlayers(roster, matchupsByWeek, completedWeek, players)
        : [],
      taxiScores: roster ? computeTaxiScores(roster, matchupsByWeek, completedWeek, players) : [],
      opponentRosterId: upcomingOpponents.get(team.rosterId) ?? null,
    });
  }

  return { season, completedWeek, upcomingWeek, teams: teamContexts };
}

function matchupStaleTime(week: number, nflWeek: number | undefined): number {
  const ONE_MINUTE_MS = 60 * 1000;
  if (nflWeek === undefined) return ONE_MINUTE_MS;
  return week < nflWeek ? Infinity : ONE_MINUTE_MS;
}

function useOutStatusSnapshot(season: string, week: number | undefined) {
  return useQuery({
    queryKey: ["mediaRoom", "outStatusSnapshot", season, week],
    queryFn: async () => {
      const weekStr = String(week).padStart(2, "0");
      const res = await fetch(`/data/player-status/${season}-w${weekStr}.json`);
      if (!res.ok) return null;
      return (await res.json()) as Record<string, string>;
    },
    enabled: week !== undefined,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Fetches everything computeWeekContext needs, via the app's existing hooks
 * and query cache, and assembles the WeekContext for the live season.
 */
export function useWeekContext(leagueId: string) {
  const leagueQuery = useLeague(leagueId);
  const rostersQuery = useRosters(leagueId);
  const usersQuery = useUsers(leagueId);
  const liveAvatarById = useLiveUserAvatars(usersQuery.data);
  const playersQuery = usePlayers();
  const nflStateQuery = useNflState();

  const nflWeek = nflStateQuery.data?.week;
  const completedWeek = nflWeek !== undefined ? Math.max(1, nflWeek - 1) : undefined;
  const upcomingWeek = nflWeek;

  const weeks = useMemo(() => {
    if (completedWeek === undefined || upcomingWeek === undefined) return [];
    const list = Array.from({ length: completedWeek }, (_, i) => i + 1);
    if (upcomingWeek > completedWeek) list.push(upcomingWeek);
    return list;
  }, [completedWeek, upcomingWeek]);

  const matchupQueries = useQueries({
    queries: weeks.map((week) => ({
      queryKey: ["matchups", leagueId, week],
      queryFn: () => getMatchups(leagueId, week),
      staleTime: matchupStaleTime(week, nflWeek),
      enabled: Boolean(leagueId),
    })),
  });

  const outStatusQuery = useOutStatusSnapshot(MEDIA_CONFIG.season, completedWeek);

  const isLoading =
    leagueQuery.isLoading ||
    rostersQuery.isLoading ||
    usersQuery.isLoading ||
    playersQuery.isLoading ||
    nflStateQuery.isLoading ||
    matchupQueries.some((q) => q.isLoading);

  const error =
    leagueQuery.error ??
    rostersQuery.error ??
    usersQuery.error ??
    playersQuery.error ??
    nflStateQuery.error ??
    matchupQueries.find((q) => q.error)?.error ??
    null;

  let data: WeekContext | undefined;
  if (
    rostersQuery.data &&
    usersQuery.data &&
    playersQuery.data &&
    completedWeek !== undefined &&
    upcomingWeek !== undefined &&
    matchupQueries.every((q) => q.data)
  ) {
    const matchupsByWeek = new Map<number, SleeperMatchup[]>();
    weeks.forEach((week, i) => {
      matchupsByWeek.set(week, matchupQueries[i].data ?? []);
    });

    const weekResultsByRoster = buildWeekResultsByRoster(matchupsByWeek);
    const teams = assembleTeams(
      rostersQuery.data,
      enrichUsersWithLiveAvatars(usersQuery.data, liveAvatarById),
      weekResultsByRoster
    );
    const byeWeeks =
      (byeWeeksBySeason as Record<string, Record<string, number>>)[MEDIA_CONFIG.season] ?? {};

    data = computeWeekContext({
      season: MEDIA_CONFIG.season,
      completedWeek,
      upcomingWeek,
      teams,
      rosters: rostersQuery.data,
      matchupsByWeek,
      players: playersQuery.data,
      byeWeeks,
      outStatusSnapshot: outStatusQuery.data ?? null,
    });
  }

  return { data, isLoading, error, playoffWeekStart: leagueQuery.data?.settings.playoff_week_start ?? LEAGUE_CONFIG.regularSeasonWeeks + 1 };
}
