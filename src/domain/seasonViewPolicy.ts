import { LEAGUE_CONFIG } from "../config/league";
import type { SeasonRef } from "./seasonChain";

/**
 * The tiebreaker/offset values custom-rules seasons compute with. There is
 * only one league-wide rule set today (LEAGUE_CONFIG), so this is a
 * pass-through — but every custom-rule call site (buildPlayoffBracket,
 * buildPickRace, rankByRecord/rankDivisions, sortByPotentialPointsAscending)
 * should read its overrides from here rather than falling through to the
 * LEAGUE_CONFIG singleton directly, so a future per-season rule set only
 * needs to change this one function. Never called for as-played seasons —
 * see getSeasonMode in src/context/SeasonContext.tsx, the only place that
 * should ever branch on a season's year.
 */
export function getSeasonRules(_season: SeasonRef) {
  return {
    tiebreakers: LEAGUE_CONFIG.tiebreakers,
    consolationWeekOffset: LEAGUE_CONFIG.consolationWeekOffset,
    pickRaceSemiWeek: LEAGUE_CONFIG.pickRaceSemiWeek,
    pickRaceFinalWeek: LEAGUE_CONFIG.pickRaceFinalWeek,
  };
}
