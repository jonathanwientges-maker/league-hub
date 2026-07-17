import type { SleeperBracketMatchup, SleeperDraftPick, SleeperMatchup } from "../api/types";
import type { DraftPick } from "./pickPlacement";
import {
  gameStatus,
  isTeamRef,
  resolveGameResult,
  type BracketGame,
  type BracketGameId,
  type PlayoffBracket,
  type PlayoffSeed,
  type TeamRef,
} from "./playoffBracket";

/**
 * Resolves a t1/t2 participant to a concrete roster_id, following t1_from/
 * t2_from chains when Sleeper hasn't filled in the slot directly yet (only
 * relevant to a bracket still in progress — every game in an already-
 * complete historic season already has concrete t1/t2 values, but this
 * still handles the general case rather than assuming that).
 */
function resolveParticipant(
  game: SleeperBracketMatchup,
  side: "t1" | "t2",
  gamesByMatch: Map<number, SleeperBracketMatchup>
): number | null {
  const direct = side === "t1" ? game.t1 : game.t2;
  if (direct !== null) return direct;

  const from = side === "t1" ? game.t1_from : game.t2_from;
  if (!from) return null;

  const sourceMatchId = from.w ?? from.l;
  if (sourceMatchId === undefined) return null;
  const sourceGame = gamesByMatch.get(sourceMatchId);
  if (!sourceGame) return null;

  return from.w !== undefined ? sourceGame.w : sourceGame.l;
}

function toTeamRef(rosterId: number | null): TeamRef | null {
  return rosterId === null ? null : { rosterId, seed: null };
}

/**
 * Sleeper's bracket JSON doesn't carry seed numbers, so seeds are derived
 * structurally instead of by re-running this league's custom seeding rules
 * (determineSeeds is Phase-4 rule logic and must not run for as-played
 * seasons): a roster that appears in a non-placement round-2 game without
 * having played in round 1 is a bye. Only the two byes are labeled — seeds
 * 3-6 aren't recoverable from the bracket data alone, so they're left
 * unlabeled (TeamRef.seed: null) rather than guessed.
 */
function deriveByeSeeds(games: SleeperBracketMatchup[]): PlayoffSeed[] {
  const round1RosterIds = new Set<number>();
  for (const g of games) {
    if (g.r !== 1) continue;
    if (g.t1 !== null) round1RosterIds.add(g.t1);
    if (g.t2 !== null) round1RosterIds.add(g.t2);
  }

  const byeRosterIds: number[] = [];
  for (const g of games) {
    if (g.r !== 2 || g.p !== undefined) continue; // skip placement games
    for (const rosterId of [g.t1, g.t2]) {
      if (rosterId !== null && !round1RosterIds.has(rosterId) && !byeRosterIds.includes(rosterId)) {
        byeRosterIds.push(rosterId);
      }
    }
  }

  return byeRosterIds.map((rosterId, i) => ({ seed: i + 1, rosterId }));
}

function buildResolvedGame(
  id: BracketGameId,
  game: SleeperBracketMatchup,
  week: number,
  gamesByMatch: Map<number, SleeperBracketMatchup>,
  weekMatchups: SleeperMatchup[]
): BracketGame {
  const homeRosterId = resolveParticipant(game, "t1", gamesByMatch);
  const awayRosterId = resolveParticipant(game, "t2", gamesByMatch);
  const home = toTeamRef(homeRosterId);
  const away = toTeamRef(awayRosterId);

  if (!home || !away) {
    return {
      id,
      week,
      home: home ?? { from: "winner", gameId: id },
      away: away ?? { from: "winner", gameId: id },
      homeScore: null,
      awayScore: null,
      winnerRosterId: game.w,
      status: gameStatus(week, Infinity, game.w),
      pairingFoundInSleeper: true,
    };
  }

  const result = resolveGameResult(home.rosterId, away.rosterId, weekMatchups);
  // The bracket's own recorded winner is authoritative — a ghost/bye
  // placement game may have no paired matchup (pairingFoundInSleeper is
  // false, scores come back null) but Sleeper still recorded who won it.
  const winnerRosterId = game.w ?? result.winnerRosterId;

  return {
    id,
    week,
    home,
    away,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winnerRosterId,
    status: gameStatus(week, Infinity, winnerRosterId),
    pairingFoundInSleeper: result.pairingFoundInSleeper,
  };
}

/**
 * Renders Sleeper's actual recorded bracket for an as-played season — no
 * reseeding, no custom qualification rules, just what really happened. The
 * result is the same PlayoffBracket/BracketGame shape v1's PlayoffBracket
 * component already renders, mapped onto the same fixed W1/W2/S1/S2/FINAL/
 * THIRD/CONSOLATION ids by round + placement marker (`p`), confirmed against
 * real 2024/2025 Sleeper data to use this exact 7-game topology.
 */
export function resolveBracket(
  games: SleeperBracketMatchup[],
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  playoffWeekStart: number
): PlayoffBracket {
  const gamesByMatch = new Map(games.map((g) => [g.m, g]));
  const weekOf = (round: number) => playoffWeekStart + (round - 1);

  const round1 = games.filter((g) => g.r === 1).sort((a, b) => a.m - b.m);
  const round2 = games.filter((g) => g.r === 2).sort((a, b) => a.m - b.m);
  const round3 = games.filter((g) => g.r === 3).sort((a, b) => a.m - b.m);

  const round2Placement = round2.filter((g) => g.p !== undefined);
  const round2Semis = round2.filter((g) => g.p === undefined);
  const championship = round3.find((g) => g.p === 1);
  const thirdPlace = round3.find((g) => g.p === 3);

  const resolved: BracketGame[] = [];
  const idsInOrder: [BracketGameId, SleeperBracketMatchup | undefined, number][] = [
    ["W1", round1[0], weekOf(1)],
    ["W2", round1[1], weekOf(1)],
    ["S1", round2Semis[0], weekOf(2)],
    ["S2", round2Semis[1], weekOf(2)],
    ["CONSOLATION", round2Placement[0], weekOf(2)],
    ["FINAL", championship, weekOf(3)],
    ["THIRD", thirdPlace, weekOf(3)],
  ];

  for (const [id, game, week] of idsInOrder) {
    if (!game) continue;
    resolved.push(
      buildResolvedGame(id, game, week, gamesByMatch, matchupsByWeek.get(week) ?? [])
    );
  }

  return {
    seeds: deriveByeSeeds(games),
    games: resolved,
  };
}

export function ordinal(n: number): string {
  const specialCase = n % 100;
  if (specialCase >= 11 && specialCase <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export interface SeasonPlacement {
  place: number; // 1-based
  rosterId: number;
}

function loserOfGame(game: BracketGame | undefined): number | null {
  if (!game || game.winnerRosterId === null) return null;
  const home = isTeamRef(game.home) ? game.home.rosterId : null;
  const away = isTeamRef(game.away) ? game.away.rosterId : null;
  if (home === game.winnerRosterId) return away;
  if (away === game.winnerRosterId) return home;
  return null;
}

/**
 * Final season placements from the resolved winners bracket's placement
 * games (FINAL/THIRD/CONSOLATION), followed by non-playoff teams in the
 * order passed in — the caller supplies that order (regular-season record)
 * rather than this function importing any custom-rule ranking helper.
 */
export function derivePlacements(
  bracket: PlayoffBracket,
  nonPlayoffRosterIdsByStanding: number[]
): SeasonPlacement[] {
  const final = bracket.games.find((g) => g.id === "FINAL");
  const third = bracket.games.find((g) => g.id === "THIRD");
  const consolation = bracket.games.find((g) => g.id === "CONSOLATION");

  const ordered: (number | null)[] = [
    final?.winnerRosterId ?? null,
    loserOfGame(final),
    third?.winnerRosterId ?? null,
    loserOfGame(third),
    consolation?.winnerRosterId ?? null,
    loserOfGame(consolation),
    ...nonPlayoffRosterIdsByStanding,
  ];

  const placements: SeasonPlacement[] = [];
  const seen = new Set<number>();
  for (const rosterId of ordered) {
    if (rosterId === null || seen.has(rosterId)) continue;
    seen.add(rosterId);
    placements.push({ place: placements.length + 1, rosterId });
  }
  return placements;
}

/**
 * The draft order a historic season actually produced is the round-1 order
 * of the NEXT season's draft (see getNextSeason in seasonChain.ts) — reuses
 * the same DraftPick shape v1's DraftOrderBoard already renders.
 */
export function buildHistoricDraftOrder(picks: SleeperDraftPick[]): DraftPick[] {
  return picks
    .filter((p) => p.round === 1)
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({
      pick: `1.${String(p.pick_no).padStart(2, "0")}`,
      rosterId: p.roster_id,
      source: "As drafted",
    }));
}
