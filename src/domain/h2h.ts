import type { H2hMap, H2hRecord } from "./types";
import type { WeekResult } from "./weeklyResults";

function emptyRecord(): H2hRecord {
  return { wins: 0, losses: 0, ties: 0 };
}

/** Accumulates head-to-head records between every pair of rosters across all weeks supplied. */
export function buildH2hMap(weekResults: WeekResult[]): H2hMap {
  const map: H2hMap = {};

  for (const result of weekResults) {
    if (result.opponentRosterId === null || result.result === null) continue;

    map[result.rosterId] ??= {};
    map[result.rosterId][result.opponentRosterId] ??= emptyRecord();
    const record = map[result.rosterId][result.opponentRosterId];

    if (result.result === "W") record.wins += 1;
    else if (result.result === "L") record.losses += 1;
    else record.ties += 1;
  }

  return map;
}
