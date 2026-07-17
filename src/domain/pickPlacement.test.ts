import { describe, expect, it } from "vitest";
import { determinePickRaceGroups, buildPickRace, buildDraftOrder } from "./pickPlacement";
import type { BracketGame } from "./playoffBracket";
import type { Team, H2hMap } from "./types";
import type { SleeperMatchup, SleeperBracketMatchup } from "../api/types";

function team(rosterId: number, division: number, wins: number, losses: number, potentialPointsTotal: number): Team {
  return {
    rosterId,
    ownerId: `u${rosterId}`,
    displayName: `T${rosterId}`,
    teamName: `T${rosterId}`,
    avatarUrl: null,
    division,
    wins,
    losses,
    ties: 0,
    pointsFor: 1000 + rosterId,
    pointsAgainst: 1000,
    weeklyScores: [],
    potentialPointsTotal,
  };
}

// 3 divisions x 4 teams. Ranks 1-2 per division = playoffs; 3-4 = pick race.
const teams: Team[] = [
  team(1, 1, 10, 3, 0), team(2, 1, 7, 6, 0), team(3, 1, 5, 8, 1000), team(4, 1, 3, 10, 900),
  team(5, 2, 9, 4, 0), team(6, 2, 8, 5, 0), team(7, 2, 6, 7, 1100), team(8, 2, 2, 11, 800),
  team(9, 3, 8, 5, 0), team(10, 3, 7, 6, 0), team(11, 3, 4, 9, 1050), team(12, 3, 1, 12, 950),
];
const emptyH2h: H2hMap = {};

describe("determinePickRaceGroups", () => {
  it("splits the 6 non-playoff teams into Group A (lowest 3 Potential Points) and Group B (the other 3)", () => {
    const { groupA, groupB } = determinePickRaceGroups(teams, emptyH2h);
    expect(groupA.map((t) => t.rosterId).sort((a, b) => a - b)).toEqual([4, 8, 12]); // 800, 900, 950
    expect(groupB.map((t) => t.rosterId).sort((a, b) => a - b)).toEqual([3, 7, 11]); // 1000, 1050, 1100
  });
});

describe("buildPickRace", () => {
  // Group A records: T8 2-11 (.1538), T4 3-10 (.2308), T12 1-12 (.0769) -> best = T4.
  // Group B records: T3 5-8 (.3846), T11 4-9 (.3077), T7 6-7 (.4615) -> best = T7.
  const semiMatchups: SleeperMatchup[] = [
    { roster_id: 8, matchup_id: 1, points: 100, starters: [], players: [], players_points: {} },
    { roster_id: 12, matchup_id: 1, points: 80, starters: [], players: [], players_points: {} },
    { roster_id: 3, matchup_id: 2, points: 95, starters: [], players: [], players_points: {} },
    { roster_id: 11, matchup_id: 2, points: 85, starters: [], players: [], players_points: {} },
  ];
  const finalMatchups: SleeperMatchup[] = [
    { roster_id: 4, matchup_id: 3, points: 110, starters: [], players: [], players_points: {} },
    { roster_id: 8, matchup_id: 3, points: 90, starters: [], players: [], players_points: {} },
    { roster_id: 3, matchup_id: 4, points: 105, starters: [], players: [], players_points: {} },
    { roster_id: 7, matchup_id: 4, points: 100, starters: [], players: [], players_points: {} },
  ];
  const losersBracket: SleeperBracketMatchup[] = [];

  it("gives the bye to the best actual record within each group", () => {
    const pickRace = buildPickRace({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 17,
      semiWeekMatchups: semiMatchups,
      finalWeekMatchups: finalMatchups,
      losersBracket,
    });

    expect(pickRace.groupA.byeRosterId).toBe(4);
    expect(pickRace.groupB.byeRosterId).toBe(7);
  });

  it("assigns 1.01-1.06 correctly: final winner gets the best pick, final loser next, semifinal loser last", () => {
    const pickRace = buildPickRace({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 17,
      semiWeekMatchups: semiMatchups,
      finalWeekMatchups: finalMatchups,
      losersBracket,
    });

    const consolation: BracketGame = {
      id: "CONSOLATION", week: 17, home: { rosterId: 20, seed: null }, away: { rosterId: 21, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 20, status: "final", pairingFoundInSleeper: true,
    };
    const third: BracketGame = {
      id: "THIRD", week: 17, home: { rosterId: 22, seed: null }, away: { rosterId: 23, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 22, status: "final", pairingFoundInSleeper: true,
    };
    const final: BracketGame = {
      id: "FINAL", week: 17, home: { rosterId: 24, seed: null }, away: { rosterId: 25, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 24, status: "final", pairingFoundInSleeper: true,
    };

    const draftOrder = buildDraftOrder(pickRace, [consolation, third, final]);
    const byPick = Object.fromEntries(draftOrder.map((p) => [p.pick, p.rosterId]));

    expect(byPick["1.01"]).toBe(4); // Group A final winner (T4, the bye)
    expect(byPick["1.02"]).toBe(8); // Group A final loser
    expect(byPick["1.03"]).toBe(12); // Group A semifinal loser
    expect(byPick["1.04"]).toBe(3); // Group B final winner
    expect(byPick["1.05"]).toBe(7); // Group B final loser (the bye, upset in the final)
    expect(byPick["1.06"]).toBe(11); // Group B semifinal loser
  });

  it("assigns 1.07-1.12 from the playoff bracket, with the INTENTIONAL inversion: the consolation game's WINNER gets 1.07 (the better pick), its loser gets 1.08", () => {
    const pickRace = buildPickRace({
      teams,
      h2hMap: emptyH2h,
      playoffWeekStart: 15,
      currentWeek: 17,
      semiWeekMatchups: semiMatchups,
      finalWeekMatchups: finalMatchups,
      losersBracket,
    });

    const consolation: BracketGame = {
      id: "CONSOLATION", week: 17, home: { rosterId: 20, seed: null }, away: { rosterId: 21, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 20, status: "final", pairingFoundInSleeper: true,
    };
    const third: BracketGame = {
      id: "THIRD", week: 17, home: { rosterId: 22, seed: null }, away: { rosterId: 23, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 22, status: "final", pairingFoundInSleeper: true,
    };
    const final: BracketGame = {
      id: "FINAL", week: 17, home: { rosterId: 24, seed: null }, away: { rosterId: 25, seed: null },
      homeScore: 100, awayScore: 90, winnerRosterId: 24, status: "final", pairingFoundInSleeper: true,
    };

    const draftOrder = buildDraftOrder(pickRace, [consolation, third, final]);
    const byPick = Object.fromEntries(draftOrder.map((p) => [p.pick, p.rosterId]));

    expect(byPick["1.07"]).toBe(20); // consolation WINNER — not the loser
    expect(byPick["1.08"]).toBe(21); // consolation loser
    expect(byPick["1.09"]).toBe(23); // 3rd-place game loser (4th place)
    expect(byPick["1.10"]).toBe(22); // 3rd-place game winner (3rd place)
    expect(byPick["1.11"]).toBe(25); // championship loser (runner-up)
    expect(byPick["1.12"]).toBe(24); // league champion
  });
});
