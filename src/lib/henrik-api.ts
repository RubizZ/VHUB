import { henrikAxiosInstance } from './henrik-axios';
import { 
  HenrikResponse, 
  HenrikAccount, 
  HenrikMMR, 
  HenrikMMRHistory, 
  HenrikMatch, 
  HenrikPremierTeam,
  HenrikPremierSeason
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

/**
 * Get Match History (V3)
 */
export async function getMatches(region: string, name: string, tag: string, mode: string = 'competitive', size: number = 10) {
  try {
    const res = await henrikAxiosInstance<HenrikResponse<HenrikMatch[]>>({
      url: `/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      method: 'GET',
      params: { mode, size }
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
