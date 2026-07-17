import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { LEAGUE_CONFIG } from "../config/league";
import type { SeasonRef } from "../domain/seasonChain";
import { useSeasonChain } from "../hooks/useSeasonChain";

export type SeasonMode = "custom-rules" | "as-played";

/**
 * The only place a year comparison should happen anywhere in this app —
 * every page/component branches on the mode this returns, never on the
 * season string directly.
 */
export function getSeasonMode(season: SeasonRef): SeasonMode {
  return Number(season.season) >= LEAGUE_CONFIG.rulesCutoffSeason
    ? "custom-rules"
    : "as-played";
}

interface SeasonContextValue {
  chain: SeasonRef[];
  currentSeason: SeasonRef | undefined;
  selectedSeason: SeasonRef | undefined;
  setSelectedSeason: (season: SeasonRef) => void;
  isAwaitingNewSeason: boolean;
  isLoading: boolean;
  error: Error | null;
}

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined);

const HISTORY_SEASON_PATTERN = "/history/:season/*";
const EMPTY_CHAIN: SeasonRef[] = [];

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useSeasonChain();
  const location = useLocation();
  const navigate = useNavigate();

  const chain = data?.chain ?? EMPTY_CHAIN;
  const currentSeason = data?.current;

  const routeSeasonParam = matchPath(HISTORY_SEASON_PATTERN, location.pathname)
    ?.params.season;

  const selectedSeason = useMemo(() => {
    if (routeSeasonParam) {
      return chain.find((ref) => ref.season === routeSeasonParam) ?? currentSeason;
    }
    return currentSeason;
  }, [chain, currentSeason, routeSeasonParam]);

  const setSelectedSeason = (season: SeasonRef) => {
    if (currentSeason && season.leagueId === currentSeason.leagueId) {
      navigate("/");
      return;
    }
    navigate(`/history/${season.season}`);
  };

  const value: SeasonContextValue = {
    chain,
    currentSeason,
    selectedSeason,
    setSelectedSeason,
    isAwaitingNewSeason: data?.isAwaitingNewSeason ?? false,
    isLoading,
    error: error as Error | null,
  };

  return (
    <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
  );
}

export function useSeasonContext(): SeasonContextValue {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeasonContext must be used within a SeasonProvider");
  }
  return context;
}
