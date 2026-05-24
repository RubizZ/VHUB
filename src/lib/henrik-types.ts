/**
 * Manual type definitions for HenrikDev VALORANT API
 * Based on LIVE API response analysis (v4.6.0)
 */

export interface HenrikResponse<T> {
  status: number;
  data: T;
}

// --- Account ---
export interface HenrikAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: {
    id: string;
    small: string;
    large: string;
    wide: string;
  };
  last_update: string;
  last_update_raw: number;
}

// --- MMR (V2) ---
export interface HenrikMMRCurrentData {
  currenttier: number;
  currenttierpatched: string;
  images: {
    small: string;
    large: string;
    triangle_down: string;
    triangle_up: string;
  };
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  games_needed_for_rating: number;
  old: boolean;
}

export interface HenrikMMR {
  name: string;
  tag: string;
  puuid: string;
  current_data: HenrikMMRCurrentData;
  highest_rank: {
    old: boolean;
    tier: number;
    patched_tier: string;
    season: string;
  };
  by_season: Record<string, any>;
}

// --- MMR History (V1) ---
export interface HenrikMMRHistory {
  currenttier: number;
  currenttierpatched: string;
  images: {
    small: string;
    large: string;
    triangle_down: string;
    triangle_up: string;
  };
  match_id: string;
  map: {
    name: string;
    id: string;
  };
  season_id: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  date: string;
  date_raw: number;
}

// --- Matches (V3) ---
export interface HenrikMatchMetadata {
  map: string;
  game_version: string;
  game_length: number;
  game_start: number;
  game_start_patched: string;
  rounds_played: number;
  mode: string;
  mode_id: string;
  queue: string;
  season_id: string;
  platform: string;
  matchid: string;
  region: string;
  cluster: string;
  premier_info?: {
    season_id: string;
    event_id: string;
  };
}

export interface HenrikMatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team: string;
  level: number;
  character: string;
  currenttier: number;
  currenttierpatched: string;
  player_card: string;
  player_title: string;
  assets: {
    card: { small: string; large: string; wide: string };
    agent: { small: string; full: string; bust: string; killfeed: string };
  };
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    bodyshots: number;
    headshots: number;
    legshots: number;
  };
  ability_casts: {
    c_cast: number;
    q_cast: number;
    e_cast: number;
    x_cast: number;
  };
  damage_made: number;
  damage_received: number;
}

export interface HenrikMatch {
  metadata: HenrikMatchMetadata;
  players: {
    all_players: HenrikMatchPlayer[];
    red: HenrikMatchPlayer[];
    blue: HenrikMatchPlayer[];
  };
  teams: {
    red: { 
      has_won: boolean; 
      rounds_won: number; 
      rounds_lost: number;
      roster?: {
        id: string;
        name: string;
        tag: string;
        members: string[];
        customization?: {
          icon: string;
          image: string;
          primary_color: string;
          secondary_color: string;
          tertiary_color: string;
        };
      };
      customization?: {
        name: string;
        tag: string;
      };
    };
    blue: { 
      has_won: boolean; 
      rounds_won: number; 
      rounds_lost: number;
      roster?: {
        id: string;
        name: string;
        tag: string;
        members: string[];
        customization?: {
          icon: string;
          image: string;
          primary_color: string;
          secondary_color: string;
          tertiary_color: string;
        };
      };
      customization?: {
        name: string;
        tag: string;
      };
    };
  };
  rounds: any[];
  kills: any[];
}

// --- Premier ---
export interface HenrikPremierMember {
  puuid: string;
  name: string;
  tag: string;
}

export interface HenrikPremierTeam {
  id: string;
  name: string;
  tag: string;
  enrolled: boolean;
  stats: {
    wins: number;
    matches: number;
    losses: number;
  };
  placement: {
    points: number;
    conference: string;
    division: number;
    place: number;
  };
  customization: {
    icon: string;
    image: string;
    primary: string;
    secondary: string;
    tertiary: string;
  };
  member: HenrikPremierMember[];
}

export interface HenrikPremierHistory {
  league_matches: {
    id: string;
    points_before: number;
    points_after: number;
    started_at: string;
  }[];
}

export interface HenrikPremierLeaderboardEntry {
  ranking: number;
  name: string;
  tag: string;
  wins: number;
  losses: number;
  score: number;
}

export interface HenrikPremierLeaderboard {
  leaderboard: HenrikPremierLeaderboardEntry[];
}

export type HenrikPremierEventType = 'LEAGUE' | 'TOURNAMENT' | 'SCRIM';

export interface HenrikPremierEvent {
  id: string;
  type: HenrikPremierEventType;
  starts_at: string;
  ends_at: string;
  conference_schedules: any[];
  map_selection?: {
    maps: { name: string; id: string }[];
    type: 'RANDOM' | 'PICK' | string;
  };
  points_required_to_participate?: number;
}

export interface HenrikPremierScheduledEvent {
  event_id: string;
  conference: string;
  starts_at: string;
  ends_at: string;
}

export interface HenrikPremierSeason {
  id: string;
  championship_event_id: string;
  championship_points_required: number;
  starts_at: string;
  ends_at: string;
  enrollment_starts_at: string;
  enrollment_ends_at: string;
  events: HenrikPremierEvent[];
  scheduled_events: HenrikPremierScheduledEvent[];
}
