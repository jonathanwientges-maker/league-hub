import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { SeasonRef } from "../domain/seasonChain";
import type { TeamsData } from "../hooks/useTeams";
import type { Team } from "../domain/types";
import type { PlayoffBracket } from "../domain/playoffBracket";
import type { PickRaceResult, DraftPick } from "../domain/pickPlacement";

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

const liveSeason2026: SeasonRef = { leagueId: "L2026", season: "2026", name: "x", status: "in_season" };

let mockSeasonContextValue = {
  chain: [liveSeason2026],
  currentSeason: liveSeason2026 as SeasonRef | undefined,
  selectedSeason: liveSeason2026 as SeasonRef | undefined,
  setSelectedSeason: vi.fn(),
  isAwaitingNewSeason: false,
  isLoading: false,
  error: null as Error | null,
};

vi.mock("../context/SeasonContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../context/SeasonContext")>();
  return {
    ...actual,
    useSeasonContext: () => mockSeasonContextValue,
  };
});

const usePickRaceMock = vi.fn(
  (): {
    pickRace: PickRaceResult | undefined;
    draftOrder: DraftPick[] | undefined;
    isLoading: boolean;
    error: Error | null;
  } => ({
    pickRace: undefined,
    draftOrder: undefined,
    isLoading: true,
    error: null,
  })
);
vi.mock("../hooks/usePickRace", () => ({ usePickRace: usePickRaceMock }));

const usePlayoffBracketMock = vi.fn(
  (): { bracket: PlayoffBracket | undefined; isLoading: boolean; error: Error | null } => ({
    bracket: undefined,
    isLoading: true,
    error: null,
  })
);
vi.mock("../hooks/usePlayoffBracket", () => ({ usePlayoffBracket: usePlayoffBracketMock }));

const useTeamsMock = vi.fn(
  (): { data: TeamsData | undefined; isLoading: boolean; error: Error | null } => ({
    data: undefined,
    isLoading: true,
    error: null,
  })
);
vi.mock("../hooks/useTeams", () => ({ useTeams: useTeamsMock }));

const useCustomRulesSeasonSummaryMock = vi.fn(() => ({
  teams: undefined as Team[] | undefined,
  placements: undefined as { place: number; rosterId: number }[] | undefined,
  isLoading: true,
  error: null as Error | null,
}));
vi.mock("../hooks/useCustomRulesSeasonSummary", () => ({
  useCustomRulesSeasonSummary: useCustomRulesSeasonSummaryMock,
}));

vi.mock("../hooks/useAsPlayedSeasonResult", () => ({
  useAsPlayedSeasonResult: () => ({
    placements: undefined,
    teams: undefined,
    draftOrder: undefined,
    nextSeason: undefined,
    isLoading: true,
    error: null,
  }),
}));

vi.mock("../hooks/useLeaguePhase", () => ({
  useLeaguePhase: () => ({
    phase: "regular-season",
    league: undefined,
    draft: undefined,
    draftStartMs: null,
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useMatchups", () => ({
  useMatchups: () => ({ data: undefined, isLoading: false, error: null }),
  useRegularSeasonMatchups: () => [],
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSeasonContextValue = {
    chain: [liveSeason2026],
    currentSeason: liveSeason2026,
    selectedSeason: liveSeason2026,
    setSelectedSeason: vi.fn(),
    isAwaitingNewSeason: false,
    isLoading: false,
    error: null,
  };
});

describe("placeholder until Week 1 has real data", () => {
  it("Home shows a placeholder (not a computed bracket) and never calls usePlayoffBracket/usePickRace before Week 1", async () => {
    useTeamsMock.mockReturnValue({
      data: {
        teams: [team({ rosterId: 1 })],
        h2hMap: {},
        playoffWeekStart: 15,
        currentWeek: 0, // season hasn't started
      },
      isLoading: false,
      error: null,
    });

    const { Home } = await import("./Home");
    const { container } = renderWithProviders(<Home />);

    await waitFor(() =>
      expect(container.textContent).toContain("Playoff picture will appear once Week 1 has been played.")
    );
    expect(container.textContent).toContain("Pick race order will appear once Week 1 has been played.");
    expect(usePlayoffBracketMock).not.toHaveBeenCalled();
    expect(usePickRaceMock).not.toHaveBeenCalled();
  });

  it("Playoffs shows the not-started notice before Week 1 instead of the bracket", async () => {
    useTeamsMock.mockReturnValue({
      data: { teams: [team({ rosterId: 1 })], h2hMap: {}, playoffWeekStart: 15, currentWeek: 0 },
      isLoading: false,
      error: null,
    });
    usePlayoffBracketMock.mockReturnValue({
      bracket: { seeds: [], games: [] },
      isLoading: false,
      error: null,
    });

    const { Playoffs } = await import("./Playoffs");
    const { container } = renderWithProviders(<Playoffs />);

    await waitFor(() =>
      expect(container.textContent).toContain("The playoff bracket will appear once Week 1 has been played.")
    );
  });

  it("PickRace shows the not-started notice before Week 1 instead of Potential Points/brackets", async () => {
    useTeamsMock.mockReturnValue({
      data: { teams: [team({ rosterId: 1 })], h2hMap: {}, playoffWeekStart: 15, currentWeek: 0 },
      isLoading: false,
      error: null,
    });
    usePickRaceMock.mockReturnValue({
      pickRace: {
        groupA: { id: "A", rosterIds: [], byeRosterId: 1, games: [] },
        groupB: { id: "B", rosterIds: [], byeRosterId: 1, games: [] },
      },
      draftOrder: [],
      isLoading: false,
      error: null,
    });

    const { PickRace } = await import("./PickRace");
    const { container } = renderWithProviders(<PickRace />);

    await waitFor(() =>
      expect(container.textContent).toContain("The pick race will appear once Week 1 has been played.")
    );
  });
});

describe("History: champion badges only after the season is actually complete", () => {
  it("does not show a champion for an in-progress season, even though someone is currently in 1st", async () => {
    useCustomRulesSeasonSummaryMock.mockReturnValue({
      teams: [team({ rosterId: 1, teamName: "Leaders FC", wins: 5 })],
      placements: [{ place: 1, rosterId: 1 }],
      isLoading: false,
      error: null,
    });

    const { History } = await import("./History");
    const { container } = renderWithProviders(<History />);

    await waitFor(() => expect(container.textContent).toContain("Season in progress"));
    expect(container.textContent).not.toContain("League Champion");
    // "Best record so far" / all-time stats legitimately still show the
    // current leader's name — only the champion crown/runner-up/3rd claims
    // are withheld pre-completion.
    expect(container.textContent).not.toContain("Runner-up:");
    expect(container.textContent).not.toContain("3rd:");
  });

  it("does show the champion once the season is marked complete", async () => {
    const completeSeason: SeasonRef = { leagueId: "L2026", season: "2026", name: "x", status: "complete" };
    mockSeasonContextValue = {
      chain: [completeSeason],
      currentSeason: completeSeason,
      selectedSeason: completeSeason,
      setSelectedSeason: vi.fn(),
      isAwaitingNewSeason: false,
      isLoading: false,
      error: null,
    };
    useCustomRulesSeasonSummaryMock.mockReturnValue({
      teams: [team({ rosterId: 1, teamName: "Champs United", wins: 12 })],
      placements: [{ place: 1, rosterId: 1 }],
      isLoading: false,
      error: null,
    });

    const { History } = await import("./History");
    const { container } = renderWithProviders(<History />);

    await waitFor(() => expect(container.textContent).toContain("League Champion"));
    expect(container.textContent).toContain("Champs United");
  });
});
