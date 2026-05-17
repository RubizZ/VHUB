import { HenrikMatch } from './henrik-types';

export interface ModeStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  kdRatio: number;
  kdaRatio: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgACS: number;
  avgADR: number;
  headshotPct: number;
  mostPlayedAgent: string;
  mostPlayedMap: string;
  agentStats: Record<string, { agent: string; games: number; wins: number; winRate: number }>;
  mapStats: Record<string, { map: string; games: number; wins: number; winRate: number; avgKills: number; avgDeaths: number }>;
  recentForm: ('W' | 'L')[];
}

export interface DeathmatchStats {
  gamesPlayed: number;
  totalKills: number;
  totalDeaths: number;
  kdRatio: number;
  avgKills: number;
  avgDeaths: number;
  mostPlayedAgent: string;
  mostPlayedMap: string;
  agentStats: Record<string, { agent: string; games: number; avgKills: number; avgDeaths: number }>;
}

export interface PlayerStats {
  name: string;
  competitive: ModeStats | null;
  premier: ModeStats | null;
  standard: ModeStats | null;
  others: ModeStats | null;
  deathmatch: DeathmatchStats | null;
}

function calculateModeStats(matches: HenrikMatch[], cleanName: string, cleanTag: string): ModeStats | null {
  if (matches.length === 0) return null;

  const stats: ModeStats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    kdRatio: 0,
    kdaRatio: 0,
    avgKills: 0,
    avgDeaths: 0,
    avgAssists: 0,
    avgACS: 0,
    avgADR: 0,
    headshotPct: 0,
    mostPlayedAgent: 'N/A',
    mostPlayedMap: 'N/A',
    agentStats: {},
    mapStats: {},
    recentForm: [],
  };

  let totalHeadshots = 0;
  let totalBodyshots = 0;
  let totalLegshots = 0;
  let totalDamage = 0;
  let totalRounds = 0;
  let totalScore = 0;
  const agentCount: Record<string, number> = {};
  const mapCount: Record<string, number> = {};

  for (const match of matches) {
    const player = match.players.all_players.find(p => {
      const pName = p.name.trim().toLowerCase();
      const pTag = p.tag.trim().toLowerCase().replace(/^#/, '');
      return pName === cleanName && pTag === cleanTag;
    }) || match.players.all_players.find(p => {
      const pName = p.name.trim().toLowerCase();
      return pName === cleanName;
    }) || match.players.all_players[0];

    if (!player) continue;

    stats.gamesPlayed++;
    const team = player.team?.toLowerCase() as 'red' | 'blue' || 'red';
    const won = match.teams?.[team]?.has_won || false;

    if (won) {
      stats.wins++;
      stats.recentForm.push('W');
    } else {
      stats.losses++;
      stats.recentForm.push('L');
    }

    stats.totalKills += player.stats.kills;
    stats.totalDeaths += player.stats.deaths;
    stats.totalAssists += player.stats.assists;
    totalRounds += match.metadata.rounds_played;
    totalScore += player.stats.score;
    totalDamage += player.damage_made;
    
    totalHeadshots += player.stats.headshots;
    totalBodyshots += player.stats.bodyshots;
    totalLegshots += player.stats.legshots;

    const agent = player.character;
    if (!stats.agentStats[agent]) {
      stats.agentStats[agent] = { agent, games: 0, wins: 0, winRate: 0 };
    }
    stats.agentStats[agent].games++;
    if (won) stats.agentStats[agent].wins++;
    agentCount[agent] = (agentCount[agent] || 0) + 1;

    const map = match.metadata.map;
    if (!stats.mapStats[map]) {
      stats.mapStats[map] = { map, games: 0, wins: 0, winRate: 0, avgKills: 0, avgDeaths: 0 };
    }
    stats.mapStats[map].games++;
    if (won) stats.mapStats[map].wins++;
    mapCount[map] = (mapCount[map] || 0) + 1;
  }

  if (stats.gamesPlayed > 0) {
    stats.winRate = Math.round((stats.wins / stats.gamesPlayed) * 100);
    stats.kdRatio = stats.totalDeaths > 0 ? Number((stats.totalKills / stats.totalDeaths).toFixed(2)) : stats.totalKills;
    stats.kdaRatio = stats.totalDeaths > 0 ? Number(((stats.totalKills + stats.totalAssists) / stats.totalDeaths).toFixed(2)) : stats.totalKills + stats.totalAssists;
    stats.avgKills = Number((stats.totalKills / stats.gamesPlayed).toFixed(1));
    stats.avgDeaths = Number((stats.totalDeaths / stats.gamesPlayed).toFixed(1));
    stats.avgAssists = Number((stats.totalAssists / stats.gamesPlayed).toFixed(1));
    stats.avgACS = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;
    stats.avgADR = totalRounds > 0 ? Math.round(totalDamage / totalRounds) : 0;
    
    const totalHits = totalHeadshots + totalBodyshots + totalLegshots;
    stats.headshotPct = totalHits > 0 ? Math.round((totalHeadshots / totalHits) * 100) : 0;
  }

  stats.recentForm = stats.recentForm.slice(0, 5).reverse();
  stats.mostPlayedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  stats.mostPlayedMap = Object.entries(mapCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  for (const agent in stats.agentStats) {
    stats.agentStats[agent].winRate = Math.round((stats.agentStats[agent].wins / stats.agentStats[agent].games) * 100);
  }

  return stats;
}

function calculateDeathmatchStats(matches: HenrikMatch[], cleanName: string, cleanTag: string): DeathmatchStats | null {
  if (matches.length === 0) return null;

  const stats: DeathmatchStats = {
    gamesPlayed: 0,
    totalKills: 0,
    totalDeaths: 0,
    kdRatio: 0,
    avgKills: 0,
    avgDeaths: 0,
    mostPlayedAgent: 'N/A',
    mostPlayedMap: 'N/A',
    agentStats: {},
  };

  const agentCount: Record<string, number> = {};
  const mapCount: Record<string, number> = {};
  const localAgentStats: Record<
    string,
    { agent: string; games: number; totalKills: number; totalDeaths: number }
  > = {};

  for (const match of matches) {
    const player = match.players.all_players.find(p => {
      const pName = p.name.trim().toLowerCase();
      const pTag = p.tag.trim().toLowerCase().replace(/^#/, '');
      return pName === cleanName && pTag === cleanTag;
    }) || match.players.all_players.find(p => {
      const pName = p.name.trim().toLowerCase();
      return pName === cleanName;
    }) || match.players.all_players[0];

    if (!player) continue;

    stats.gamesPlayed++;
    stats.totalKills += player.stats.kills;
    stats.totalDeaths += player.stats.deaths;

    const agent = player.character;
    if (!localAgentStats[agent]) {
      localAgentStats[agent] = { agent, games: 0, totalKills: 0, totalDeaths: 0 };
    }
    localAgentStats[agent].games++;
    localAgentStats[agent].totalKills += player.stats.kills;
    localAgentStats[agent].totalDeaths += player.stats.deaths;
    agentCount[agent] = (agentCount[agent] || 0) + 1;

    const map = match.metadata.map;
    mapCount[map] = (mapCount[map] || 0) + 1;
  }

  if (stats.gamesPlayed > 0) {
    stats.kdRatio = stats.totalDeaths > 0 ? Number((stats.totalKills / stats.totalDeaths).toFixed(2)) : stats.totalKills;
    stats.avgKills = Number((stats.totalKills / stats.gamesPlayed).toFixed(1));
    stats.avgDeaths = Number((stats.totalDeaths / stats.gamesPlayed).toFixed(1));
  }

  stats.mostPlayedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  stats.mostPlayedMap = Object.entries(mapCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  for (const agent in localAgentStats) {
    const ag = localAgentStats[agent];
    stats.agentStats[agent] = {
      agent: ag.agent,
      games: ag.games,
      avgKills: Number((ag.totalKills / ag.games).toFixed(1)),
      avgDeaths: Number((ag.totalDeaths / ag.games).toFixed(1)),
    };
  }

  return stats;
}

export function analyzeHenrikPlayerStats(matches: HenrikMatch[], name: string, tag: string): PlayerStats {
  const cleanName = name.trim().toLowerCase();
  const cleanTag = tag.trim().toLowerCase().replace(/^#/, '');

  const competitiveMatches: HenrikMatch[] = [];
  const premierMatches: HenrikMatch[] = [];
  const standardMatches: HenrikMatch[] = [];
  const othersMatches: HenrikMatch[] = [];
  const deathmatchMatches: HenrikMatch[] = [];

  for (const m of matches) {
    const mode = (m.metadata.mode || '').toLowerCase();
    if (mode.includes('deathmatch') || mode.includes('tdm') || mode.includes('escalation')) {
      deathmatchMatches.push(m);
    } else if (mode === 'competitive') {
      competitiveMatches.push(m);
    } else if (mode === 'premier') {
      premierMatches.push(m);
    } else if (mode === 'unrated') {
      standardMatches.push(m);
    } else {
      othersMatches.push(m);
    }
  }

  return {
    name,
    competitive: calculateModeStats(competitiveMatches, cleanName, cleanTag),
    premier: calculateModeStats(premierMatches, cleanName, cleanTag),
    standard: calculateModeStats(standardMatches, cleanName, cleanTag),
    others: calculateModeStats(othersMatches, cleanName, cleanTag),
    deathmatch: calculateDeathmatchStats(deathmatchMatches, cleanName, cleanTag),
  };
}
