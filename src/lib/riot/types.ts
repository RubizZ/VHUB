// ==========================================
// Riot Games Official Valorant API Types
// Based on https://developer.riotgames.com/apis
// ==========================================

// --- ACCOUNT-V1 ---
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

// --- VAL-MATCH-V1 ---
export interface MatchInfo {
  matchId: string;
  mapId: string;
  gameLengthMillis: number;
  gameStartMillis: number;
  provisioningFlowID: string;
  isCompleted: boolean;
  customGameName: string;
  queueID: string;
  gameMode: string;
  isRanked: boolean;
  seasonId: string;
}

export interface AbilityCasts {
  grenadeCasts: number;
  ability1Casts: number;
  ability2Casts: number;
  ultimateCasts: number;
}

export interface PlayerStats {
  score: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  playtimeMillis: number;
  abilityCasts: AbilityCasts;
}

export interface ValPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId: string;
  characterId: string;
  stats: PlayerStats;
  competitiveTier: number;
  playerCard: string;
  playerTitle: string;
}

export interface ValTeam {
  teamId: string;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints: number;
}

export interface RoundPlayerStats {
  puuid: string;
  kills: RoundKill[];
  damage: RoundDamage[];
  score: number;
  economy: PlayerEconomy;
  ability: RoundAbility;
}

export interface RoundKill {
  timeSinceGameStartMillis: number;
  timeSinceRoundStartMillis: number;
  killer: string;
  victim: string;
  victimLocation: Location;
  assistants: string[];
  playerLocations: PlayerLocation[];
  finishingDamage: FinishingDamage;
}

export interface RoundDamage {
  receiver: string;
  damage: number;
  legshots: number;
  bodyshots: number;
  headshots: number;
}

export interface PlayerEconomy {
  loadoutValue: number;
  weapon: string;
  armor: string;
  remaining: number;
  spent: number;
}

export interface RoundAbility {
  grenadeEffects: string | null;
  ability1Effects: string | null;
  ability2Effects: string | null;
  ultimateEffects: string | null;
}

export interface Location {
  x: number;
  y: number;
}

export interface PlayerLocation {
  puuid: string;
  viewRadians: number;
  location: Location;
}

export interface FinishingDamage {
  damageType: string;
  damageItem: string;
  isSecondaryFireMode: boolean;
}

export interface RoundResult {
  roundNum: number;
  roundResult: string;
  roundCeremony: string;
  winningTeam: string;
  bombPlanter?: string;
  bombDefuser?: string;
  plantRoundTime?: number;
  plantPlayerPuuid?: string;
  plantLocation?: Location;
  plantSite?: string;
  defuseRoundTime?: number;
  defusePlayerPuuid?: string;
  defuseLocation?: Location;
  playerStats: RoundPlayerStats[];
  roundResultCode: string;
}

export interface ValMatch {
  matchInfo: MatchInfo;
  players: ValPlayer[];
  coaches: unknown[];
  teams: ValTeam[];
  roundResults: RoundResult[];
}

export interface MatchlistEntry {
  matchId: string;
  gameStartTimeMillis: number;
  queueId: string;
}

export interface Matchlist {
  puuid: string;
  history: MatchlistEntry[];
}

export interface RecentMatches {
  currentTime: number;
  matchIds: string[];
}

// --- VAL-CONTENT-V1 ---
export interface ContentItem {
  name: string;
  id: string;
  assetName: string;
  assetPath?: string;
  localizedNames?: Record<string, string>;
}

export interface ActItem {
  name: string;
  id: string;
  localizedNames: Record<string, string>;
  parentId: string;
  type: string;
  isActive: boolean;
}

export interface ValContent {
  version: string;
  characters: ContentItem[];
  maps: ContentItem[];
  chromas: ContentItem[];
  skins: ContentItem[];
  skinLevels: ContentItem[];
  equips: ContentItem[];
  gameModes: ContentItem[];
  sprays: ContentItem[];
  sprayLevels: ContentItem[];
  charms: ContentItem[];
  charmLevels: ContentItem[];
  playerCards: ContentItem[];
  playerTitles: ContentItem[];
  acts: ActItem[];
  ceremonies: ContentItem[];
}

// --- VAL-RANKED-V1 ---
export interface LeaderboardPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  leaderboardRank: number;
  rankedRating: number;
  numberOfWins: number;
  competitiveTier: number;
}

export interface Leaderboard {
  shard: string;
  actId: string;
  totalPlayers: number;
  players: LeaderboardPlayer[];
}

// --- VAL-STATUS-V1 ---
export interface PlatformStatusUpdate {
  id: number;
  author: string;
  publish: boolean;
  publish_locations: string[];
  translations: { locale: string; content: string }[];
  created_at: string;
  updated_at: string;
}

export interface PlatformStatusEntry {
  id: number;
  maintenance_status: string;
  incident_severity: string;
  titles: { locale: string; content: string }[];
  updates: PlatformStatusUpdate[];
  created_at: string;
  archive_at: string;
  updated_at: string;
  platforms: string[];
}

export interface PlatformStatus {
  id: string;
  name: string;
  locales: string[];
  maintenances: PlatformStatusEntry[];
  incidents: PlatformStatusEntry[];
}

// --- Request params ---
export type ValorantRegion = 'eu' | 'na' | 'ap' | 'kr' | 'latam' | 'br';
export type ValorantShard = 'eu' | 'na' | 'ap' | 'kr';
export type RoutingRegion = 'americas' | 'europe' | 'asia';
export type QueueType = 'competitive' | 'unrated' | 'spikerush' | 'deathmatch' | 'escalation' | 'premier';

export interface GetLeaderboardParams {
  actId: string;
  size?: number;
  startIndex?: number;
}

export interface GetMatchlistParams {
  puuid: string;
}

export interface GetMatchParams {
  matchId: string;
}

export interface GetAccountParams {
  gameName: string;
  tagLine: string;
}

export interface GetContentParams {
  locale?: string;
}
