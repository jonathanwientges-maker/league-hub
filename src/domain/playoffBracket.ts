import type { SleeperMatchup } from "../api/types";
import { LEAGUE_CONFIG } from "../config/league";
import { rankByRecord, rankDivisions } from "./standings";
import type { H2hMap, Team } from "./types";

// ---------------------------------------------------------------------------
// Step 4.1 — qualification & seeding
//
// Sleeper's own winners_bracket does NOT implement this league's reseeding
// rule (Step 4.3), so the site computes the bracket structure itself from
// standings and only borrows Sleeper's playoff-week matchup data to fill in
// scores/results (see buildGame below, and the pairingFoundInSleeper flag).
// ---------------------------------------------------------------------------

export interface PlayoffSeed {
  seed: number; // 1-6
  rosterId: number;
}

/**
 * Seeds 1-3 are the three division winners ranked by win%, tiebroken by
 * head-to-head among just the three of them, falling back to points for
 * (identical rule to Step 3.4's division standings, so it's reused directly
 * via rankByRecord — including its handling of incomplete/circular h2h).
 * Seeds 4-6 are the three second-place teams, ranked the same way.
 */
export function determineSeeds(teams: Team[], h2hMap: H2hMap): PlayoffSeed[] {
  const divisionStandings = rankDivisions(teams, h2hMap);
  const divisionWinners = divisionStandings
    .filter((s) => s.rank === 1)
    .map((s) => s.team);
  const secondPlace = divisionStandings
    .filter((s) => s.rank === 2)
    .map((s) => s.team);

  const rankedDivisionWinners = rankByRecord(divisionWinners, h2hMap);
  const rankedSecondPlace = rankByRecord(secondPlace, h2hMap);

  return [
    ...rankedDivisionWinners.map((team, i) => ({ seed: i + 1, rosterId: team.rosterId })),
    ...rankedSecondPlace.map((team, i) => ({ seed: i + 4, rosterId: team.rosterId })),
  ];
}

// ---------------------------------------------------------------------------
// Step 4.5 — bracket data structure
// ---------------------------------------------------------------------------

export type BracketGameId =
  | "W1"
  | "W2"
  | "S1"
  | "S2"
  | "FINAL"
  | "THIRD"
  | "CONSOLATION";

export interface TeamRef {
  rosterId: number;
  seed: number | null;
}

/** A not-yet-decided slot: fed by the winner/loser of an earlier game. */
export interface Placeholder {
  from: "winner" | "loser";
  gameId: BracketGameId;
}

export interface BracketGame {
  id: BracketGameId;
  week: number;
  home: TeamRef | Placeholder;
  away: TeamRef | Placeholder;
  homeScore: number | null;
  awayScore: number | null;
  winnerRosterId: number | null;
  status: "upcoming" | "live" | "final";
  /** False if the commissioner ran a different pairing in Sleeper than this league's rules compute. */
  pairingFoundInSleeper: boolean;
  /**
   * S1/S2 only. False before both wildcard games are decided — until then,
   * home/away show a provisional "bye team vs winner of its paired wildcard
   * game" pairing for display, NOT the real reseed (see Step 4.3).
   */
  reseeded?: boolean;
}

export function isTeamRef(participant: TeamRef | Placeholder): participant is TeamRef {
  return "rosterId" in participant;
}

function winnerRef(game: BracketGame, gameId: BracketGameId): TeamRef | Placeholder {
  if (game.winnerRosterId === null) return { from: "winner", gameId };
  return isTeamRef(game.home) && game.home.rosterId === game.winnerRosterId
    ? game.home
    : (game.away as TeamRef);
}

function loserRef(game: BracketGame, gameId: BracketGameId): TeamRef | Placeholder {
  if (game.winnerRosterId === null) return { from: "loser", gameId };
  return isTeamRef(game.home) && game.home.rosterId === game.winnerRosterId
    ? (game.away as TeamRef)
    : (game.home as TeamRef);
}

export function gameStatus(
  week: number,
  currentWeek: number,
  winnerRosterId: number | null
): BracketGame["status"] {
  if (week > currentWeek) return "upcoming";
  if (week === currentWeek) return "live";
  // week < currentWeek should be final, but if we never got a winner (no
  // matchup data at all) don't claim "final" over a blank scoreline.
  return winnerRosterId !== null ? "final" : "upcoming";
}

export interface GameResult {
  homeScore: number | null;
  awayScore: number | null;
  winnerRosterId: number | null;
  pairingFoundInSleeper: boolean;
}

/**
 * Reads two rosters' individual weekly scores from that week's Sleeper
 * matchups and determines a winner. Shared by the playoff bracket (Phase 4)
 * and the pick-race brackets (Phase 5), since both need the same "does
 * Sleeper's matchup_id pairing match our computed pairing" check.
 */
export function resolveGameResult(
  homeRosterId: number,
  awayRosterId: number,
  weekMatchups: SleeperMatchup[]
): GameResult {
  const homeMatchup = weekMatchups.find((m) => m.roster_id === homeRosterId);
  const awayMatchup = weekMatchups.find((m) => m.roster_id === awayRosterId);
  const homeScore = homeMatchup?.points ?? null;
  const awayScore = awayMatchup?.points ?? null;

  const bothFound = homeMatchup !== undefined && awayMatchup !== undefined;
  const pairingFoundInSleeper =
    !bothFound ||
    (homeMatchup!.matchup_id !== null &&
      homeMatchup!.matchup_id === awayMatchup!.matchup_id);

  let winnerRosterId: number | null = null;
  if (homeScore !== null && awayScore !== null) {
    if (homeScore > awayScore) winnerRosterId = homeRosterId;
    else if (awayScore > homeScore) winnerRosterId = awayRosterId;
  }

  return { homeScore, awayScore, winnerRosterId, pairingFoundInSleeper };
}

/**
 * Builds one game from two participants and that week's Sleeper matchups.
 * If either participant isn't decided yet, the game is "upcoming" with a
 * null score. If both are decided, their individual weekly scores are read
 * off their own matchup entries (roster_id -> points) regardless of whether
 * Sleeper paired them against each other — pairingFoundInSleeper flags when
 * it didn't, per the architectural note in Phase 4.
 */
function buildGame(
  id: BracketGameId,
  week: number,
  home: TeamRef | Placeholder,
  away: TeamRef | Placeholder,
  weekMatchups: SleeperMatchup[],
  currentWeek: number
): BracketGame {
  if (!isTeamRef(home) || !isTeamRef(away)) {
    return {
      id,
      week,
      home,
      away,
      homeScore: null,
      awayScore: null,
      winnerRosterId: null,
      status: "upcoming",
      pairingFoundInSleeper: true,
    };
  }

  const result = resolveGameResult(home.rosterId, away.rosterId, weekMatchups);

  return {
    id,
    week,
    home,
    away,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winnerRosterId: result.winnerRosterId,
    status: gameStatus(week, currentWeek, result.winnerRosterId),
    pairingFoundInSleeper: result.pairingFoundInSleeper,
  };
}

export interface BuildBracketInput {
  teams: Team[];
  h2hMap: H2hMap;
  playoffWeekStart: number;
  currentWeek: number;
  /** Playoff-week matchups only, keyed by week number (playoffWeekStart, +1, +2). */
  matchupsByWeek: Map<number, SleeperMatchup[]>;
  consolationWeekOffset?: 1 | 2;
}

export interface PlayoffBracket {
  seeds: PlayoffSeed[];
  games: BracketGame[];
}

/**
 * Computes the full playoff bracket from standings + playoff-week results.
 * Works identically whether the regular season is complete or still in
 * progress — called on partial-season data it naturally produces the
 * "if the season ended today" projection (Step 6.7).
 */
export function buildPlayoffBracket(input: BuildBracketInput): PlayoffBracket {
  const { teams, h2hMap, playoffWeekStart, currentWeek, matchupsByWeek } = input;
  const consolationWeekOffset =
    input.consolationWeekOffset ?? LEAGUE_CONFIG.consolationWeekOffset;

  const seeds = determineSeeds(teams, h2hMap);
  const rosterIdBySeed = new Map(seeds.map((s) => [s.seed, s.rosterId]));
  const seedByRosterId = new Map(seeds.map((s) => [s.rosterId, s.seed]));
  const teamsByRosterId = new Map(teams.map((t) => [t.rosterId, t]));

  const week1 = playoffWeekStart;
  const week2 = playoffWeekStart + 1;
  const week3 = playoffWeekStart + 2;
  const consolationWeek = consolationWeekOffset === 1 ? week2 : week3;

  const teamRef = (seed: number): TeamRef => ({
    rosterId: rosterIdBySeed.get(seed)!,
    seed,
  });

  // Step 4.2 — wildcard round.
  const w1 = buildGame(
    "W1",
    week1,
    teamRef(3),
    teamRef(6),
    matchupsByWeek.get(week1) ?? [],
    currentWeek
  );
  const w2 = buildGame(
    "W2",
    week1,
    teamRef(4),
    teamRef(5),
    matchupsByWeek.get(week1) ?? [],
    currentWeek
  );

  // Step 4.3 — semifinals, reseeded among {seed1, seed2, winner(W1), winner(W2)}.
  const canReseed = w1.winnerRosterId !== null && w2.winnerRosterId !== null;

  let s1: BracketGame;
  let s2: BracketGame;

  if (canReseed) {
    const remaining = [
      teamRef(1).rosterId,
      teamRef(2).rosterId,
      w1.winnerRosterId!,
      w2.winnerRosterId!,
    ].map((rosterId) => teamsByRosterId.get(rosterId)!);

    const reseededOrder = rankByRecord(remaining, h2hMap); // best -> worst
    const toRef = (team: Team): TeamRef => ({
      rosterId: team.rosterId,
      seed: seedByRosterId.get(team.rosterId) ?? null,
    });

    s1 = buildGame(
      "S1",
      week2,
      toRef(reseededOrder[0]),
      toRef(reseededOrder[3]),
      matchupsByWeek.get(week2) ?? [],
      currentWeek
    );
    s2 = buildGame(
      "S2",
      week2,
      toRef(reseededOrder[1]),
      toRef(reseededOrder[2]),
      matchupsByWeek.get(week2) ?? [],
      currentWeek
    );
    s1.reseeded = true;
    s2.reseeded = true;
  } else {
    // Provisional display only — see the `reseeded` doc comment.
    s1 = buildGame(
      "S1",
      week2,
      teamRef(1),
      { from: "winner", gameId: "W1" },
      matchupsByWeek.get(week2) ?? [],
      currentWeek
    );
    s2 = buildGame(
      "S2",
      week2,
      teamRef(2),
      { from: "winner", gameId: "W2" },
      matchupsByWeek.get(week2) ?? [],
      currentWeek
    );
    s1.reseeded = false;
    s2.reseeded = false;
  }

  // Step 4.4 — finals week.
  const final = buildGame(
    "FINAL",
    week3,
    winnerRef(s1, "S1"),
    winnerRef(s2, "S2"),
    matchupsByWeek.get(week3) ?? [],
    currentWeek
  );
  const third = buildGame(
    "THIRD",
    week3,
    loserRef(s1, "S1"),
    loserRef(s2, "S2"),
    matchupsByWeek.get(week3) ?? [],
    currentWeek
  );
  const consolation = buildGame(
    "CONSOLATION",
    consolationWeek,
    loserRef(w1, "W1"),
    loserRef(w2, "W2"),
    matchupsByWeek.get(consolationWeek) ?? [],
    currentWeek
  );

  return {
    seeds,
    games: [w1, w2, s1, s2, final, third, consolation],
  };
}
