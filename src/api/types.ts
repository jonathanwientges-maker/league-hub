export interface SleeperLeagueSettings {
  playoff_week_start: number;
  divisions?: number;
  num_teams?: number;
  leg?: number;
  [key: string]: number | undefined;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
  settings: SleeperLeagueSettings;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  avatar: string | null;
  previous_league_id: string | null;
  draft_id: string | null;
}

export interface SleeperRosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal: number;
  fpts_against: number;
  fpts_against_decimal: number;
  division?: number;
  [key: string]: number | undefined;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings: SleeperRosterSettings;
  metadata?: Record<string, string> | null;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: {
    team_name?: string;
    [key: string]: unknown;
  } | null;
  is_owner?: boolean | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  starters: string[];
  starters_points?: number[];
  players: string[];
  players_points: Record<string, number>;
  custom_points?: number | null;
}

export interface SleeperBracketMatchup {
  r: number; // round
  m: number; // matchup id
  t1: number | null; // roster id, or null if not yet decided
  t2: number | null;
  w: number | null; // winner roster id
  l: number | null; // loser roster id
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
  p?: number; // place awarded by this game (e.g. 1 = championship, 3 = third place)
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  team: string | null;
  status?: string | null;
}

export interface NflState {
  week: number;
  season_type: string;
  season: string;
  previous_season: string;
  leg: number;
  league_season: string;
  league_create_season: string;
  display_week: number;
}

export type SleeperDraftStatus = "pre_draft" | "drafting" | "paused" | "complete";

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: string;
  status: SleeperDraftStatus;
  start_time: number | null; // ms epoch
  draft_order: Record<string, number> | null; // user_id -> slot
  settings: {
    rounds: number;
    [key: string]: number | undefined;
  };
}

export interface SleeperDraftPick {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  draft_slot: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
    [key: string]: string | undefined;
  };
}
