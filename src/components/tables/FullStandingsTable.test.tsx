import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FullStandingsTable } from "./FullStandingsTable";
import type { H2hMap, Team } from "../../domain/types";

function team(overrides: Partial<Team>): Team {
  return {
    rosterId: 1,
    ownerId: "u1",
    displayName: "Test",
    teamName: "Test Team",
    avatarUrl: null,
    division: 1,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    weeklyScores: [],
    potentialPointsTotal: 0,
    ...overrides,
  };
}

function teamNamesInOrder() {
  // Each row's team-name link may also render an avatar fallback (initials)
  // inside it, so pull the dedicated name span rather than the link's full
  // textContent.
  return screen
    .getAllByRole("link")
    .map((el) => el.querySelector(".teamName, [class*='teamName']")?.textContent);
}

describe("FullStandingsTable", () => {
  it("breaks a win% tie by head-to-head record, not array order, in the default record sort", () => {
    // Alpha and Bravo are both 5-5-0 (tied on win%) with Alpha listed first
    // in `teams`, but Bravo beat Alpha head-to-head — so Bravo should rank
    // above Alpha, matching the same rule DivisionTable/playoff seeding use.
    const alpha = team({ rosterId: 1, teamName: "Alpha", wins: 5, losses: 5, pointsFor: 100 });
    const bravo = team({ rosterId: 2, teamName: "Bravo", wins: 5, losses: 5, pointsFor: 90 });
    const teams = [alpha, bravo];
    const h2hMap: H2hMap = {
      1: { 2: { wins: 0, losses: 1, ties: 0 } },
      2: { 1: { wins: 1, losses: 0, ties: 0 } },
    };

    render(
      <MemoryRouter>
        <FullStandingsTable teams={teams} h2hMap={h2hMap} />
      </MemoryRouter>
    );

    expect(teamNamesInOrder()).toEqual(["Bravo", "Alpha"]);
  });

  it("falls back to points-for when h2h doesn't resolve the tie", () => {
    const alpha = team({ rosterId: 1, teamName: "Alpha", wins: 5, losses: 5, pointsFor: 100 });
    const bravo = team({ rosterId: 2, teamName: "Bravo", wins: 5, losses: 5, pointsFor: 120 });
    const teams = [alpha, bravo];
    const h2hMap: H2hMap = {};

    render(
      <MemoryRouter>
        <FullStandingsTable teams={teams} h2hMap={h2hMap} />
      </MemoryRouter>
    );

    expect(teamNamesInOrder()).toEqual(["Bravo", "Alpha"]);
  });
});
