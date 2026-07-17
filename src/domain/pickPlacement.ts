import type { SleeperBracketMatchup, SleeperMatchup } from "../api/types";
import { LEAGUE_CONFIG } from "../config/league";
import { rankDivisions, rankByRecord } from "./standings";
import { gameStatus, resolveGameResult } from "./playoffBracket";
import type { BracketGame } from "./playoffBracket";
import type { GameResult } from "./playoffBracket";
import type { H2hMap, Team } from "./types";

// ---------------------------------------------------------------------------
// Step 5.1 — the two pick-race groups
// ---------------------------------------------------------------------------

/**
 * Sorts by season Potential Points ascending (worst first). Ties broken via
 * LEAGUE_CONFIG.tiebreakers.potentialPoints — default "actualPointsFor",
 * where a LOWER actual points-for is considered the worse (earlier) team.
 */
export function sortByPotentialPointsAscending(
  teams: Team[],
  tiebreakers: readonly string[] = LEAGUE_CONFIG.tiebreakers.potentialPoints
): Team[] {
  return [...teams].sort((a, b) => {
    if (a.potentialPointsTotal !== b.potentialPointsTotal) {
      return a.potentialPointsTotal - b.potentialPointsTotal;
    }
    for (const tiebreaker of tiebreakers) {
      if (tiebreaker === "actualPointsFor" && a.pointsFor !== b.pointsFor) {
        return a.pointsFor - b.pointsFor;
      }
    }
    return 0;
  });
}

/**
 * The 6 non-playoff teams (3rd + 4th of each division), split by season
 * Potential Points: the 3 lowest form Group A (picks 1.01-1.03), the other
 * 3 form Group B (picks 1.04-1.06).
 */
export function determinePickRaceGroups(
  teams: Team[],
  h2hMap: H2hMap
): { groupA: Team[]; groupB: Team[] } {
  const nonPlayoffTeams = rankDivisions(teams, h2hMap)
    .filter((standing) => !standing.isPlayoffPosition)
    .map((standing) => standing.team);

  const sorted = sortByPotentialPointsAscending(nonPlayoffTeams);

  return {
    groupA: sorted.slice(0, 3),
    groupB: sorted.slice(3, 6),
  };
}

// ---------------------------------------------------------------------------
// Step 5.2 — per-group bracket
// ---------------------------------------------------------------------------

export interface PickRaceTeamRef {
  rosterId: number;
}

/** The only chained slot in this bracket: FINAL's second seat waits on SEMI. */
export interface PickRacePlaceholder {
  from: "winner";
  gameId: "SEMI";
}

export interface PickRaceGame {
  id: "SEMI" | "FINAL";
  week: number;
  home: PickRaceTeamRef | PickRacePlaceholder;
  away: PickRaceTeamRef | PickRacePlaceholder;
  homeScore: number | null;
  awayScore: number | null;
  winnerRosterId: number | null;
  status: "upcoming" | "live" | "final";
  pairingFoundInSleeper: boolean;
}

export interface PickRaceGroup {
  id: "A" | "B";
  rosterIds: number[]; // the 3 teams in this group
  byeRosterId: number;
  games: PickRaceGame[]; // [SEMI, FINAL]
}

/**
 * Primary source is Sleeper's own losers_bracket: if it has this exact
 * pairing decided, its winner is authoritative. Individual weekly scores
 * are still read from that week's matchups for display. Falls back to
 * matching purely against the week's matchup_id pairing when the losers
 * bracket doesn't have (or doesn't decide) this pairing.
 */
function resolvePickRaceGameResult(
  homeRosterId: number,
  awayRosterId: number,
  weekMatchups: SleeperMatchup[],
  losersBracket: SleeperBracketMatchup[]
): GameResult {
  const bracketMatch = losersBracket.find(
    (m) =>
      (m.t1 === homeRosterId && m.t2 === awayRosterId) ||
      (m.t1 === awayRosterId && m.t2 === homeRosterId)
  );

  if (bracketMatch && bracketMatch.w !== null) {
    const fromWeek = resolveGameResult(homeRosterId, awayRosterId, weekMatchups);
    return {
      homeScore: fromWeek.homeScore,
      awayScore: fromWeek.awayScore,
      winnerRosterId: bracketMatch.w,
      pairingFoundInSleeper: true,
    };
  }

  return resolveGameResult(homeRosterId, awayRosterId, weekMatchups);
}

function buildPickRaceGroup(
  id: "A" | "B",
  groupTeams: Team[],
  h2hMap: H2hMap,
  semiWeek: number,
  finalWeek: number,
  currentWeek: number,
  semiWeekMatchups: SleeperMatchup[],
  finalWeekMatchups: SleeperMatchup[],
  losersBracket: SleeperBracketMatchup[]
): PickRaceGroup {
  // Best actual regular-season record (win%, tiebreak per Step 3.4) gets the bye.
  const rankedByRecord = rankByRecord(groupTeams, h2hMap);
  const byeTeam = rankedByRecord[0];
  const [semiHome, semiAway] = [rankedByRecord[1], rankedByRecord[2]];

  const semiResult = resolvePickRaceGameResult(
    semiHome.rosterId,
    semiAway.rosterId,
    semiWeekMatchups,
    losersBracket
  );
  const semiGame: PickRaceGame = {
    id: "SEMI",
    week: semiWeek,
    home: { rosterId: semiHome.rosterId },
    away: { rosterId: semiAway.rosterId },
    homeScore: semiResult.homeScore,
    awayScore: semiResult.awayScore,
    winnerRosterId: semiResult.winnerRosterId,
    status: gameStatus(semiWeek, currentWeek, semiResult.winnerRosterId),
    pairingFoundInSleeper: semiResult.pairingFoundInSleeper,
  };

  const finalAway: PickRaceTeamRef | PickRacePlaceholder =
    semiGame.winnerRosterId !== null
      ? { rosterId: semiGame.winnerRosterId }
      : { from: "winner", gameId: "SEMI" };

  let finalGame: PickRaceGame;
  if ("rosterId" in finalAway) {
    const finalResult = resolvePickRaceGameResult(
      byeTeam.rosterId,
      finalAway.rosterId,
      finalWeekMatchups,
      losersBracket
    );
    finalGame = {
      id: "FINAL",
      week: finalWeek,
      home: { rosterId: byeTeam.rosterId },
      away: finalAway,
      homeScore: finalResult.homeScore,
      awayScore: finalResult.awayScore,
      winnerRosterId: finalResult.winnerRosterId,
      status: gameStatus(finalWeek, currentWeek, finalResult.winnerRosterId),
      pairingFoundInSleeper: finalResult.pairingFoundInSleeper,
    };
  } else {
    finalGame = {
      id: "FINAL",
      week: finalWeek,
      home: { rosterId: byeTeam.rosterId },
      away: finalAway,
      homeScore: null,
      awayScore: null,
      winnerRosterId: null,
      status: "upcoming",
      pairingFoundInSleeper: true,
    };
  }

  return {
    id,
    rosterIds: groupTeams.map((t) => t.rosterId),
    byeRosterId: byeTeam.rosterId,
    games: [semiGame, finalGame],
  };
}

export interface BuildPickRaceInput {
  teams: Team[];
  h2hMap: H2hMap;
  playoffWeekStart: number;
  currentWeek: number;
  semiWeekMatchups: SleeperMatchup[];
  finalWeekMatchups: SleeperMatchup[];
  losersBracket: SleeperBracketMatchup[];
  pickRaceSemiWeek?: number;
  pickRaceFinalWeek?: number;
}

export interface PickRaceResult {
  groupA: PickRaceGroup;
  groupB: PickRaceGroup;
}

export function buildPickRace(input: BuildPickRaceInput): PickRaceResult {
  const {
    teams,
    h2hMap,
    playoffWeekStart,
    currentWeek,
    semiWeekMatchups,
    finalWeekMatchups,
    losersBracket,
  } = input;
  const pickRaceSemiWeek = input.pickRaceSemiWeek ?? LEAGUE_CONFIG.pickRaceSemiWeek;
  const pickRaceFinalWeek = input.pickRaceFinalWeek ?? LEAGUE_CONFIG.pickRaceFinalWeek;

  // "playoff week N" is 1-indexed relative to playoffWeekStart.
  const semiWeek = playoffWeekStart + (pickRaceSemiWeek - 1);
  const finalWeek = playoffWeekStart + (pickRaceFinalWeek - 1);

  const { groupA, groupB } = determinePickRaceGroups(teams, h2hMap);

  return {
    groupA: buildPickRaceGroup(
      "A",
      groupA,
      h2hMap,
      semiWeek,
      finalWeek,
      currentWeek,
      semiWeekMatchups,
      finalWeekMatchups,
      losersBracket
    ),
    groupB: buildPickRaceGroup(
      "B",
      groupB,
      h2hMap,
      semiWeek,
      finalWeek,
      currentWeek,
      semiWeekMatchups,
      finalWeekMatchups,
      losersBracket
    ),
  };
}

// ---------------------------------------------------------------------------
// Step 5.3 / 5.4 — full draft order
// ---------------------------------------------------------------------------

export interface DraftPick {
  pick: string; // "1.01".."1.12"
  rosterId: number | null;
  source: string; // human-readable explanation; UI prefixes "TBD — decided by " when rosterId is null
}

interface ResolvedGameLike {
  home: PickRaceTeamRef | PickRacePlaceholder | BracketGame["home"];
  away: PickRaceTeamRef | PickRacePlaceholder | BracketGame["away"];
  winnerRosterId: number | null;
}

function winnerOf(game: ResolvedGameLike): number | null {
  return game.winnerRosterId;
}

function loserOf(game: ResolvedGameLike): number | null {
  if (game.winnerRosterId === null) return null;
  const homeIsWinner = "rosterId" in game.home && game.home.rosterId === game.winnerRosterId;
  const loser = homeIsWinner ? game.away : game.home;
  return "rosterId" in loser ? loser.rosterId : null;
}

function draftPick(pick: string, rosterId: number | null, source: string): DraftPick {
  return { pick, rosterId, source };
}

/**
 * Assigns all 12 first-round picks. 1.01-1.06 come from the two pick-race
 * groups (Step 5.2); 1.07-1.12 come from the playoff bracket's results
 * (Step 5.3) — note the intentional inversion at 1.07/1.08: the CONSOLATION
 * game's WINNER gets the better pick (1.07), its loser gets 1.08.
 */
export function buildDraftOrder(
  pickRace: PickRaceResult,
  playoffGames: BracketGame[]
): DraftPick[] {
  const aSemi = pickRace.groupA.games.find((g) => g.id === "SEMI")!;
  const aFinal = pickRace.groupA.games.find((g) => g.id === "FINAL")!;
  const bSemi = pickRace.groupB.games.find((g) => g.id === "SEMI")!;
  const bFinal = pickRace.groupB.games.find((g) => g.id === "FINAL")!;

  const consolation = playoffGames.find((g) => g.id === "CONSOLATION")!;
  const third = playoffGames.find((g) => g.id === "THIRD")!;
  const final = playoffGames.find((g) => g.id === "FINAL")!;

  return [
    draftPick("1.01", winnerOf(aFinal), "Winner, Pick 1.01 Final"),
    draftPick("1.02", loserOf(aFinal), "Loser, Pick 1.01 Final"),
    draftPick("1.03", loserOf(aSemi), "Loser, Pick 1.01 Semifinal"),
    draftPick("1.04", winnerOf(bFinal), "Winner, Pick 1.04 Final"),
    draftPick("1.05", loserOf(bFinal), "Loser, Pick 1.04 Final"),
    draftPick("1.06", loserOf(bSemi), "Loser, Pick 1.04 Semifinal"),
    draftPick("1.07", winnerOf(consolation), "Winner, Consolation Game"),
    draftPick("1.08", loserOf(consolation), "Loser, Consolation Game"),
    draftPick("1.09", loserOf(third), "Loser, 3rd Place Game"),
    draftPick("1.10", winnerOf(third), "Winner, 3rd Place Game"),
    draftPick("1.11", loserOf(final), "Runner-up, Championship"),
    draftPick("1.12", winnerOf(final), "League Champion"),
  ];
}
