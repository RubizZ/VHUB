const HENRIK_BASE = 'https://api.henrikdev.xyz';

interface HenrikResponse<T> {
  status: number;
  data: T;
  errors?: Array<{ message: string }>;
}

async function henrikFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = process.env.HENRIK_API_KEY;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = apiKey;
  }

  try {
    const res = await fetch(`${HENRIK_BASE}${endpoint}`, {
      headers,
      next: { revalidate: 300 }, // Cache 5 min
    });

    if (!res.ok) {
      console.error(`HenrikDev API error: ${res.status} for ${endpoint}`);
      return null;
    }

    const json = await res.json() as HenrikResponse<T>;
    return json.data;
  } catch (err) {
    console.error('HenrikDev API fetch error:', err);
    return null;
  }
}

// --- Account ---
export interface ValorantAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: {
    small: string;
    large: string;
    wide: string;
    id: string;
  };
}

export async function getAccount(name: string, tag: string): Promise<ValorantAccount | null> {
  return henrikFetch<ValorantAccount>(`/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

// --- MMR ---
export interface ValorantMMR {
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  name: string;
  tag: string;
  images: {
    small: string;
    large: string;
    triangle_down: string;
    triangle_up: string;
  };
}

export async function getMMR(region: string, name: string, tag: string): Promise<ValorantMMR | null> {
  return henrikFetch<ValorantMMR>(`/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

// --- MMR History ---
export interface MMRHistoryEntry {
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  date_raw: number;
  date: string;
}

export async function getMMRHistory(region: string, name: string, tag: string): Promise<MMRHistoryEntry[] | null> {
  return henrikFetch<MMRHistoryEntry[]>(`/valorant/v1/mmr-history/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

// --- Match History ---
export interface MatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team: string;
  level: number;
  character: string;
  currenttier: number;
  currenttier_patched: string;
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    bodyshots: number;
    headshots: number;
    legshots: number;
  };
  economy: {
    spent: { overall: number; average: number };
    loadout_value: { overall: number; average: number };
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

export interface MatchData {
  metadata: {
    map: string;
    game_version: string;
    game_length: number;
    game_start: number;
    game_start_patched: string;
    rounds_played: number;
    mode: string;
    queue: string;
    season_id: string;
    platform: string;
    matchid: string;
    region: string;
    cluster: string;
  };
  players: {
    all_players: MatchPlayer[];
    red: MatchPlayer[];
    blue: MatchPlayer[];
  };
  teams: {
    red: { has_won: boolean; rounds_won: number; rounds_lost: number };
    blue: { has_won: boolean; rounds_won: number; rounds_lost: number };
  };
  rounds?: Array<{
    winning_team: string;
    end_type: string;
    bomb_planted: boolean;
    bomb_defused: boolean;
    plant_events: unknown;
    defuse_events: unknown;
    player_stats: Array<{
      player_puuid: string;
      player_display_name: string;
      player_team: string;
      kills: number;
      damage: number;
      score: number;
      economy: { loadout_value: number; spent: number; weapon: { id: string; name: string } };
      ability_casts: { c_casts: number; q_casts: number; e_casts: number; x_casts: number };
      was_afk: boolean;
      was_penalized: boolean;
      stayed_in_spawn: boolean;
    }>;
  }>;
}

export async function getMatches(region: string, name: string, tag: string, mode: string = 'competitive', size: number = 10): Promise<MatchData[] | null> {
  return henrikFetch<MatchData[]>(`/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?filter=${mode}&size=${size}`);
}

// --- Match by ID ---
export async function getMatchById(matchId: string): Promise<MatchData | null> {
  return henrikFetch<MatchData>(`/valorant/v4/match/eu/${matchId}`);
}

// --- Premier Team ---
export interface PremierTeam {
  id: string;
  name: string;
  tag: string;
  conference: string;
  division: number;
  affinity: string;
  region: string;
  losses: number;
  wins: number;
  score: number;
  ranking: number;
  customization: {
    icon: string;
    image: string;
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export async function getPremierTeam(teamName: string, teamTag: string): Promise<PremierTeam | null> {
  return henrikFetch<PremierTeam>(`/valorant/v1/premier/${encodeURIComponent(teamName)}/${encodeURIComponent(teamTag)}`);
}

// Generate mock data when no API key is configured
export function generateMockMatches(playerName: string): MatchData[] {
  const maps = ['Ascent', 'Haven', 'Split', 'Bind', 'Breeze', 'Lotus', 'Pearl'];
  const agents = ['Jett', 'Phoenix', 'Sage', 'Omen', 'Sova', 'Killjoy', 'Reyna', 'Viper'];
  const results: MatchData[] = [];

  for (let i = 0; i < 10; i++) {
    const map = maps[Math.floor(Math.random() * maps.length)];
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const roundsWon = Math.floor(Math.random() * 13) + 1;
    const roundsLost = roundsWon === 13 ? Math.floor(Math.random() * 12) : 13;
    const kills = Math.floor(Math.random() * 25) + 5;
    const deaths = Math.floor(Math.random() * 20) + 3;
    const assists = Math.floor(Math.random() * 10);
    const headshots = Math.floor(Math.random() * kills);
    const bodyshots = kills - headshots;
    const totalShots = headshots + bodyshots + Math.floor(Math.random() * 5);

    results.push({
      metadata: {
        map,
        game_version: '07.08.00.123456',
        game_length: (roundsWon + roundsLost) * 120000,
        game_start: Date.now() / 1000 - i * 86400,
        game_start_patched: new Date(Date.now() - i * 86400000).toISOString(),
        rounds_played: roundsWon + roundsLost,
        mode: 'Competitive',
        queue: 'competitive',
        season_id: 'act3-e8',
        platform: 'PC',
        matchid: `mock-match-${i}-${Date.now()}`,
        region: 'eu',
        cluster: 'eu-west',
      },
      players: {
        all_players: [{
          puuid: `mock-puuid-${playerName}`,
          name: playerName,
          tag: 'EUW',
          team: 'Blue',
          level: 150 + Math.floor(Math.random() * 100),
          character: agent,
          currenttier: 18 + Math.floor(Math.random() * 6),
          currenttier_patched: 'Diamond 1',
          stats: { score: (kills * 200 + assists * 50), kills, deaths, assists, bodyshots, headshots, legshots: 0 },
          economy: {
            spent: { overall: 40000, average: 2500 },
            loadout_value: { overall: 55000, average: 3500 },
          },
          ability_casts: {
            c_cast: Math.floor(Math.random() * 15),
            q_cast: Math.floor(Math.random() * 20),
            e_cast: Math.floor(Math.random() * 25),
            x_cast: Math.floor(Math.random() * 3),
          },
          damage_made: kills * 140 + Math.floor(Math.random() * 500),
          damage_received: deaths * 130 + Math.floor(Math.random() * 400),
        }],
        red: [],
        blue: [],
      },
      teams: {
        red: { has_won: roundsWon < roundsLost, rounds_won: roundsLost, rounds_lost: roundsWon },
        blue: { has_won: roundsWon >= roundsLost, rounds_won: roundsWon, rounds_lost: roundsLost },
      },
    });
  }

  return results;
}

export function generateMockMMR(): ValorantMMR {
  return {
    currenttier: 20,
    currenttierpatched: 'Diamond 2',
    ranking_in_tier: 45,
    mmr_change_to_last_game: 18,
    elo: 1545,
    name: 'Player',
    tag: 'EUW',
    images: { small: '', large: '', triangle_down: '', triangle_up: '' },
  };
}
