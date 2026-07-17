import type { NflState, SleeperLeague, SleeperMatchup, SleeperPlayer } from "../api/types";
import type { Team } from "./types";

/**
 * /state/nfl reports the real-world current NFL week — fine while browsing
 * this season's active league, wrong for a past completed league (or a
 * league from a different season than the live one), where "current week"
 * would come back lower than every week the league actually played,
 * silently marking every week "not final" and every playoff game "upcoming"
 * despite having real scores. league.status/season are the authoritative
 * signal for whether this league's own season has already wrapped.
 */
export function resolveCurrentWeek(league: SleeperLeague, nflState: NflState): number {
  if (league.status === "complete") return Infinity;
  if (league.season !== nflState.season) return Infinity;
  return nflState.week;
}

// ---------------------------------------------------------------------------
// Step 3.1 — lineup structure
// ---------------------------------------------------------------------------

export const SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  IDP_FLEX: ["DL", "LB", "DB"],
  DL: ["DL"],
  LB: ["LB"],
  DB: ["DB"],
};

const NON_STARTING_SLOTS = new Set(["BN", "IR", "TAXI"]);

/** Filters roster_positions down to the ordered list of starting slots to fill. */
export function getStartingSlots(rosterPositions: string[]): string[] {
  return rosterPositions.filter((slot) => !NON_STARTING_SLOTS.has(slot));
}

export function isEligible(slot: string, fantasyPositions: string[]): boolean {
  const eligiblePositions = SLOT_ELIGIBILITY[slot];
  if (!eligiblePositions) return false;
  return fantasyPositions.some((pos) => eligiblePositions.includes(pos));
}

const warnedMissingPlayerIds = new Set<string>();

/**
 * A player_id from a historic matchup that's missing from the current
 * /players/nfl map (retired, purged from Sleeper's metadata, etc.) gets no
 * eligible positions — isEligible() then returns false for every slot, so
 * they can never be placed into an optimal lineup over a real eligible
 * player. Warns once per ID instead of crashing.
 */
function getPlayerPositions(
  playerPositions: Map<string, string[]>,
  playerId: string
): string[] {
  const positions = playerPositions.get(playerId);
  if (positions !== undefined) return positions;
  if (!warnedMissingPlayerIds.has(playerId)) {
    warnedMissingPlayerIds.add(playerId);
    console.warn(`potentialPoints: player_id "${playerId}" missing from players map`);
  }
  return [];
}

/**
 * playerId -> eligible positions. Falls back to the singular `position`
 * field when `fantasy_positions` is missing — some players in Sleeper's
 * data have sparse metadata, and dropping them from every slot because of
 * that would understate potential points.
 */
export function buildPlayerPositionsMap(
  players: Record<string, SleeperPlayer>
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [playerId, player] of Object.entries(players)) {
    const positions = player.fantasy_positions?.length
      ? player.fantasy_positions
      : player.position
        ? [player.position]
        : [];
    map.set(playerId, positions);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Step 3.2 — optimal lineup solver (exact weighted bipartite matching)
// ---------------------------------------------------------------------------

export interface SlotAssignment {
  slot: string;
  playerId: string | null;
  points: number;
}

export interface OptimalLineupResult {
  optimalPoints: number;
  optimalLineup: SlotAssignment[];
}

/**
 * Exact solve via DP, memoized on (playerIndex, usedSlotsMask). The bitmask
 * is over SLOTS, not players: a real roster can run 20-35 players deep
 * (bench + taxi + IR) but starting slots are always few (~9-12), so
 * bitmasking over players (2^30+ states) is combinatorially explosive while
 * bitmasking over slots (2^12 states, × ~30 players ≈ tractable) is not.
 * For each player, in order: skip them (bench), or place them in any
 * currently-open slot they're eligible for. Leaving a slot unfilled is
 * implicit — it just never gets a bit set — which covers "not enough
 * eligible players for this slot" for free.
 */
export function computeOptimalLineup(
  players: string[],
  playersPoints: Record<string, number>,
  startingSlots: string[],
  playerPositions: Map<string, string[]>
): OptimalLineupResult {
  const pointsOf = (playerId: string) => playersPoints[playerId] ?? 0;
  const numSlots = startingSlots.length;
  const fullSlotsMask = numSlots >= 31 ? -1 : (1 << numSlots) - 1;

  const eligibleSlotsMaskPerPlayer: number[] = players.map((playerId) => {
    const positions = getPlayerPositions(playerPositions, playerId);
    let mask = 0;
    for (let s = 0; s < numSlots; s++) {
      if (isEligible(startingSlots[s], positions)) mask |= 1 << s;
    }
    return mask;
  });

  const memo = new Map<string, { points: number; slotToPlayer: Map<number, number> }>();

  function solve(playerIndex: number, usedSlotsMask: number): { points: number; slotToPlayer: Map<number, number> } {
    if (playerIndex === players.length || usedSlotsMask === fullSlotsMask) {
      return { points: 0, slotToPlayer: new Map() };
    }

    const key = `${playerIndex}:${usedSlotsMask}`;
    const cached = memo.get(key);
    if (cached) return cached;

    // Option: bench this player.
    let best = solve(playerIndex + 1, usedSlotsMask);

    // Option: start them in each currently-open slot they're eligible for.
    let openEligible = eligibleSlotsMaskPerPlayer[playerIndex] & ~usedSlotsMask;
    while (openEligible !== 0) {
      const slotBit = openEligible & -openEligible;
      const slotIndex = 31 - Math.clz32(slotBit);
      const rest = solve(playerIndex + 1, usedSlotsMask | slotBit);
      const candidatePoints = pointsOf(players[playerIndex]) + rest.points;
      if (candidatePoints > best.points) {
        const slotToPlayer = new Map(rest.slotToPlayer);
        slotToPlayer.set(slotIndex, playerIndex);
        best = { points: candidatePoints, slotToPlayer };
      }
      openEligible &= openEligible - 1;
    }

    memo.set(key, best);
    return best;
  }

  const result = solve(0, 0);

  const optimalLineup: SlotAssignment[] = startingSlots.map((slot, slotIndex) => {
    const playerIndex = result.slotToPlayer.get(slotIndex);
    const playerId = playerIndex !== undefined ? players[playerIndex] : null;
    return { slot, playerId, points: playerId ? pointsOf(playerId) : 0 };
  });

  return {
    optimalPoints: result.points,
    optimalLineup,
  };
}

/**
 * The lineup actually started that week, for comparison against the optimal
 * one on the Team detail page (Step 6.6). Sleeper's `starters` array is
 * already ordered to match `roster_positions`' starting slots 1:1, and uses
 * "0" as a sentinel for an empty slot.
 */
export function buildActualLineup(
  starters: string[],
  startingSlots: string[],
  playersPoints: Record<string, number>
): SlotAssignment[] {
  return startingSlots.map((slot, i) => {
    const playerId = starters[i];
    const isEmpty = !playerId || playerId === "0";
    return {
      slot,
      playerId: isEmpty ? null : playerId,
      points: isEmpty ? 0 : (playersPoints[playerId] ?? 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Weekly + season aggregation (Step 3.2 bench points lost, Step 3.3 totals)
// ---------------------------------------------------------------------------

export interface WeeklyOptimalResult {
  week: number;
  actualPoints: number;
  optimalPoints: number;
  benchPointsLost: number;
  optimalLineup: SlotAssignment[];
}

export function computeWeeklyOptimalResult(
  week: number,
  matchup: Pick<SleeperMatchup, "players" | "players_points" | "points">,
  startingSlots: string[],
  playerPositions: Map<string, string[]>
): WeeklyOptimalResult {
  const { optimalPoints, optimalLineup } = computeOptimalLineup(
    matchup.players,
    matchup.players_points,
    startingSlots,
    playerPositions
  );

  return {
    week,
    actualPoints: matchup.points,
    optimalPoints,
    benchPointsLost: optimalPoints - matchup.points,
    optimalLineup,
  };
}

/** A regular-season week counts once its games are final: week < the NFL's current week. */
export function isWeekFinal(week: number, currentWeek: number): boolean {
  return week < currentWeek;
}

export interface TeamPotentialPoints {
  weeklyResults: WeeklyOptimalResult[];
  potentialPointsTotal: number;
  actualPointsTotal: number;
  benchPointsLostTotal: number;
  lineupEfficiency: number; // actualPointsTotal / potentialPointsTotal
}

export function computeTeamPotentialPoints(
  rosterId: number,
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  startingSlots: string[],
  playerPositions: Map<string, string[]>,
  playoffWeekStart: number,
  currentWeek: number
): TeamPotentialPoints {
  const weeklyResults: WeeklyOptimalResult[] = [];

  for (const [week, matchups] of matchupsByWeek) {
    if (week >= playoffWeekStart) continue;
    if (!isWeekFinal(week, currentWeek)) continue;

    const matchup = matchups.find((m) => m.roster_id === rosterId);
    if (!matchup) continue;

    weeklyResults.push(
      computeWeeklyOptimalResult(week, matchup, startingSlots, playerPositions)
    );
  }

  weeklyResults.sort((a, b) => a.week - b.week);

  const potentialPointsTotal = weeklyResults.reduce(
    (sum, w) => sum + w.optimalPoints,
    0
  );
  const actualPointsTotal = weeklyResults.reduce(
    (sum, w) => sum + w.actualPoints,
    0
  );

  return {
    weeklyResults,
    potentialPointsTotal,
    actualPointsTotal,
    benchPointsLostTotal: potentialPointsTotal - actualPointsTotal,
    lineupEfficiency:
      potentialPointsTotal > 0 ? actualPointsTotal / potentialPointsTotal : 0,
  };
}

export function computeAllTeamsPotentialPoints(
  rosterIds: number[],
  matchupsByWeek: Map<number, SleeperMatchup[]>,
  startingSlots: string[],
  playerPositions: Map<string, string[]>,
  playoffWeekStart: number,
  currentWeek: number
): Map<number, TeamPotentialPoints> {
  const result = new Map<number, TeamPotentialPoints>();
  for (const rosterId of rosterIds) {
    result.set(
      rosterId,
      computeTeamPotentialPoints(
        rosterId,
        matchupsByWeek,
        startingSlots,
        playerPositions,
        playoffWeekStart,
        currentWeek
      )
    );
  }
  return result;
}

/** Folds computed potential points back into the Team model's weeklyScores + potentialPointsTotal. */
export function mergeTeamsWithPotentialPoints(
  teams: Team[],
  potentialPointsByRoster: Map<number, TeamPotentialPoints>
): Team[] {
  return teams.map((team) => {
    const potentialPoints = potentialPointsByRoster.get(team.rosterId);
    if (!potentialPoints) return team;

    const optimalPointsByWeek = new Map(
      potentialPoints.weeklyResults.map((w) => [w.week, w.optimalPoints])
    );

    return {
      ...team,
      weeklyScores: team.weeklyScores.map((weeklyScore) => ({
        ...weeklyScore,
        optimalPoints:
          optimalPointsByWeek.get(weeklyScore.week) ?? weeklyScore.optimalPoints,
      })),
      potentialPointsTotal: potentialPoints.potentialPointsTotal,
    };
  });
}
