import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { SeasonRef } from "../domain/seasonChain";
import type { TeamsData } from "../hooks/useTeams";

const asPlayedSeason: SeasonRef = { leagueId: "L2024", season: "2024", name: "x", status: "complete" };
const currentSeason: SeasonRef = { leagueId: "L2025", season: "2025", name: "x", status: "complete" };

let mockSeasonContextValue = {
  chain: [asPlayedSeason, currentSeason],
  currentSeason,
  selectedSeason: asPlayedSeason as SeasonRef | undefined,
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

const usePickRaceMock = vi.fn(() => ({
  pickRace: undefined,
  draftOrder: undefined,
  isLoading: true,
  error: null,
}));
vi.mock("../hooks/usePickRace", () => ({ usePickRace: usePickRaceMock }));

const usePlayoffBracketMock = vi.fn(() => ({ bracket: undefined, isLoading: true, error: null }));
vi.mock("../hooks/usePlayoffBracket", () => ({ usePlayoffBracket: usePlayoffBracketMock }));

const useTeamsMock = vi.fn(
  (): { data: TeamsData | undefined; isLoading: boolean; error: Error | null } => ({
    data: undefined,
    isLoading: true,
    error: null,
  })
);
vi.mock("../hooks/useTeams", () => ({ useTeams: useTeamsMock }));

const useAsPlayedSeasonResultMock = vi.fn(() => ({
  placements: undefined,
  teams: undefined,
  draftOrder: undefined,
  nextSeason: undefined,
  isLoading: true,
  error: null,
}));
vi.mock("../hooks/useAsPlayedSeasonResult", () => ({
  useAsPlayedSeasonResult: useAsPlayedSeasonResultMock,
}));

const useAsPlayedBracketMock = vi.fn(() => ({
  winnersBracket: undefined,
  losersBracket: undefined,
  teams: undefined,
  isLoading: true,
  error: null,
}));
vi.mock("../hooks/useAsPlayedBracket", () => ({ useAsPlayedBracket: useAsPlayedBracketMock }));

// Home.tsx also uses these — mocked so the test never makes a real network
// call to Sleeper's API.
vi.mock("../hooks/useLeaguePhase", () => ({
  useLeaguePhase: () => ({
    phase: "complete",
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

describe("as-played policy: custom-rules hooks are never invoked", () => {
  beforeEach(() => {
    mockSeasonContextValue = {
      chain: [asPlayedSeason, currentSeason],
      currentSeason,
      selectedSeason: asPlayedSeason,
      setSelectedSeason: vi.fn(),
      isAwaitingNewSeason: false,
      isLoading: false,
      error: null,
    };
  });

  it("PickRace renders the as-played branch and never calls usePickRace", async () => {
    const { PickRace } = await import("./PickRace");
    renderWithProviders(<PickRace />);

    await waitFor(() => expect(useAsPlayedSeasonResultMock).toHaveBeenCalled());
    expect(usePickRaceMock).not.toHaveBeenCalled();
  });

  it("Playoffs renders the as-played branch and never calls usePlayoffBracket", async () => {
    const { Playoffs } = await import("./Playoffs");
    renderWithProviders(<Playoffs />);

    await waitFor(() => expect(useAsPlayedBracketMock).toHaveBeenCalled());
    expect(usePlayoffBracketMock).not.toHaveBeenCalled();
  });

  it("Home's summary cards render the as-played branch and never call usePickRace/usePlayoffBracket", async () => {
    useTeamsMock.mockReturnValue({
      data: { teams: [], h2hMap: {}, playoffWeekStart: 15, currentWeek: 18 },
      isLoading: false,
      error: null,
    });
    const { Home } = await import("./Home");
    renderWithProviders(<Home />);

    await waitFor(() => expect(useAsPlayedSeasonResultMock).toHaveBeenCalled());
    expect(usePickRaceMock).not.toHaveBeenCalled();
    expect(usePlayoffBracketMock).not.toHaveBeenCalled();
  });

  it("Home shows the 'waiting on the commissioner' hero (not the old season's 'Season Complete') when the next season hasn't been created on Sleeper yet", async () => {
    mockSeasonContextValue = {
      chain: [asPlayedSeason, currentSeason],
      currentSeason,
      selectedSeason: currentSeason, // viewing the live season
      setSelectedSeason: vi.fn(),
      isAwaitingNewSeason: true, // next season's Sleeper league doesn't exist yet
      isLoading: false,
      error: null,
    };
    useTeamsMock.mockReturnValue({
      data: { teams: [], h2hMap: {}, playoffWeekStart: 15, currentWeek: 18 },
      isLoading: false,
      error: null,
    });

    const { Home } = await import("./Home");
    const { container } = renderWithProviders(<Home />);

    await waitFor(() => expect(container.textContent).toContain("Draft date: TBD"));
    expect(container.textContent).not.toContain("Season Complete");
    // The season shown is the one being waited on (2026), not the last
    // completed one (2025) that isAwaitingNewSeason is keyed off of.
    expect(container.textContent).toContain("Season 2026");
  });
});
