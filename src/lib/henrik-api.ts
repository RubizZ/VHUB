import { henrikAxiosInstance } from './henrik-axios';
import { 
  HenrikResponse, 
  HenrikAccount, 
  HenrikMMR, 
  HenrikMMRHistory, 
  HenrikMatch, 
  HenrikPremierTeam,
  HenrikPremierSeason,
  HenrikPremierHistory,
  HenrikPremierLeaderboard,
  HenrikPremierLeaderboardEntry
} from './henrik-types';

// Re-exporting types for backward compatibility or direct use
export type { 
  HenrikAccount as ValorantAccount,
  HenrikMMR as ValorantMMR,
  HenrikMMRHistory as MMRHistoryEntry,
  HenrikMatch as MatchData,
  HenrikPremierTeam as PremierTeam,
} from './henrik-types';

/**
 * Get account details (V1)
 */
export async function getAccount(name: string, tag: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikAccount>>({
      url: `/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getAccount error:', error);
    return null;
  }
}

/**
 * Get MMR details (V2)
 */
export async function getMMR(region: string, name: string, tag: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikMMR>>({
      url: `/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getMMR error:', error);
    return null;
  }
}

/**
 * Get MMR History (V1)
 */
export async function getMMRHistory(region: string, name: string, tag: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikMMRHistory[]>>({
      url: `/valorant/v1/mmr-history/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getMMRHistory error:', error);
    return null;
  }
}

export async function getMatches(region: string, name: string, tag: string, mode?: string, size: number = 10, page?: number) {
  try {
    const params: any = { size };
    if (mode) params.mode = mode;
    if (page) params.page = page;

    const res = await henrikAxiosInstance<HenrikResponse<HenrikMatch[]>>({
      url: `/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      method: 'GET',
      params
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getMatches error:', error);
    return null;
  }
}

/**
 * Get Match by ID (V2)
 */
export async function getMatchById(matchId: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikMatch>>({
      url: `/valorant/v2/match/${matchId}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getMatchById error:', error);
    return null;
  }
}

/**
 * Get Premier Team details (V1)
 */
export async function getPremierTeam(teamName: string, teamTag: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikPremierTeam>>({
      url: `/valorant/v1/premier/${encodeURIComponent(teamName)}/${encodeURIComponent(teamTag)}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getPremierTeam error:', error);
    return null;
  }
}

/**
 * Get Premier Seasons (V1)
 */
export async function getPremierSeasons(region: string = 'eu') {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikPremierSeason[]>>({
      url: `/valorant/v1/premier/seasons/${region}`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getPremierSeasons error:', error);
    return [];
  }
}

/**
 * Get Premier Team History (V1)
 */
export async function getPremierHistory(teamName: string, teamTag: string) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikPremierHistory>>({
      url: `/valorant/v1/premier/${encodeURIComponent(teamName)}/${encodeURIComponent(teamTag)}/history`,
      method: 'GET'
    });
    return res.data || null;
  } catch (error) {
    console.error('[HenrikDev] getPremierHistory error:', error);
    return null;
  }
}

/**
 * Get Premier Leaderboard/Standings (V1)
 */
export async function getPremierLeaderboard(region: string, conference: string, division: number) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikPremierLeaderboardEntry[]>>({
      url: `/valorant/v1/premier/leaderboard/${region}/${encodeURIComponent(conference)}/${division}`,
      method: 'GET'
    });
    return res.data || [];
  } catch (error) {
    console.error('[HenrikDev] getPremierLeaderboard error:', error);
    return [];
  }
}
