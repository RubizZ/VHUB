import { MatchData, MatchPlayer } from './valorant-api';

export interface PlayerStats {
  name: string;
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
  firstBloods: number;
  mostPlayedAgent: string;
  mostPlayedMap: string;
  agentStats: Record<string, AgentStat>;
  mapStats: Record<string, MapStat>;
  recentForm: ('W' | 'L')[];
}

export interface AgentStat {
  agent: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  avgACS: number;
  winRate: number;
}

export interface MapStat {
  map: string;
  games: number;
  wins: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
}

export function analyzePlayerStats(matches: MatchData[], playerName: string, playerTag?: string): PlayerStats {
  const stats: PlayerStats = {
    name: playerName,
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
    firstBloods: 0,
    mostPlayedAgent: '',
    mostPlayedMap: '',
    agentStats: {},
    mapStats: {},
    recentForm: [],
  };

  let totalHeadshots = 0;
  let totalBodyshots = 0;
  let totalLegshots = 0;
  let totalScore = 0;
  let totalDamage = 0;
  let totalRounds = 0;
  const agentCount: Record<string, number> = {};
  const mapCount: Record<string, number> = {};

  for (const match of matches) {
    const player = findPlayer(match, playerName, playerTag);
    if (!player) continue;

    stats.gamesPlayed++;
    const playerTeam = player.team.toLowerCase() as 'red' | 'blue';
    const won = match.teams[playerTeam]?.has_won ?? false;

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
    totalHeadshots += player.stats.headshots;
    totalBodyshots += player.stats.bodyshots;
    totalLegshots += player.stats.legshots;
    totalScore += player.stats.score;
    totalDamage += player.damage_made;
    totalRounds += match.metadata.rounds_played;

    // Agent stats
    const agent = player.character;
    if (!stats.agentStats[agent]) {
      stats.agentStats[agent] = { agent, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, avgACS: 0, winRate: 0 };
    }
    stats.agentStats[agent].games++;
    if (won) stats.agentStats[agent].wins++;
    stats.agentStats[agent].kills += player.stats.kills;
    stats.agentStats[agent].deaths += player.stats.deaths;
    stats.agentStats[agent].assists += player.stats.assists;
    agentCount[agent] = (agentCount[agent] || 0) + 1;

    // Map stats
    const map = match.metadata.map;
    if (!stats.mapStats[map]) {
      stats.mapStats[map] = { map, games: 0, wins: 0, winRate: 0, avgKills: 0, avgDeaths: 0 };
    }
    stats.mapStats[map].games++;
    if (won) stats.mapStats[map].wins++;
    stats.mapStats[map].avgKills += player.stats.kills;
    stats.mapStats[map].avgDeaths += player.stats.deaths;
    mapCount[map] = (mapCount[map] || 0) + 1;
  }

  if (stats.gamesPlayed > 0) {
    stats.winRate = Math.round((stats.wins / stats.gamesPlayed) * 100);
    stats.kdRatio = stats.totalDeaths > 0 ? +(stats.totalKills / stats.totalDeaths).toFixed(2) : stats.totalKills;
    stats.kdaRatio = stats.totalDeaths > 0 ? +((stats.totalKills + stats.totalAssists) / stats.totalDeaths).toFixed(2) : stats.totalKills + stats.totalAssists;
    stats.avgKills = +(stats.totalKills / stats.gamesPlayed).toFixed(1);
    stats.avgDeaths = +(stats.totalDeaths / stats.gamesPlayed).toFixed(1);
    stats.avgAssists = +(stats.totalAssists / stats.gamesPlayed).toFixed(1);
    stats.avgACS = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;
    stats.avgADR = totalRounds > 0 ? +(totalDamage / totalRounds).toFixed(1) : 0;

    const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
    stats.headshotPct = totalShots > 0 ? +(totalHeadshots / totalShots * 100).toFixed(1) : 0;
  }

  // Calculate per-agent and per-map averages
  for (const agent of Object.values(stats.agentStats)) {
    agent.winRate = agent.games > 0 ? Math.round((agent.wins / agent.games) * 100) : 0;
    agent.avgACS = agent.games > 0 ? Math.round(totalScore / totalRounds) : 0;
  }
  for (const map of Object.values(stats.mapStats)) {
    map.winRate = map.games > 0 ? Math.round((map.wins / map.games) * 100) : 0;
    map.avgKills = map.games > 0 ? +(map.avgKills / map.games).toFixed(1) : 0;
    map.avgDeaths = map.games > 0 ? +(map.avgDeaths / map.games).toFixed(1) : 0;
  }

  // Most played
  stats.mostPlayedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  stats.mostPlayedMap = Object.entries(mapCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Keep only last 10 form entries
  stats.recentForm = stats.recentForm.slice(-10);

  return stats;
}

function findPlayer(match: MatchData, name: string, tag?: string): MatchPlayer | undefined {
  return match.players.all_players.find(p => {
    if (tag) return p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase();
    return p.name.toLowerCase() === name.toLowerCase();
  });
}

export function compareTeamPlayers(allStats: PlayerStats[]): {
  bestKD: PlayerStats | null;
  bestWinRate: PlayerStats | null;
  bestHS: PlayerStats | null;
  bestACS: PlayerStats | null;
  mvp: PlayerStats | null;
} {
  if (allStats.length === 0) return { bestKD: null, bestWinRate: null, bestHS: null, bestACS: null, mvp: null };

  const bestKD = [...allStats].sort((a, b) => b.kdRatio - a.kdRatio)[0];
  const bestWinRate = [...allStats].sort((a, b) => b.winRate - a.winRate)[0];
  const bestHS = [...allStats].sort((a, b) => b.headshotPct - a.headshotPct)[0];
  const bestACS = [...allStats].sort((a, b) => b.avgACS - a.avgACS)[0];

  // MVP score: weighted combination
  const scored = allStats.map(s => ({
    ...s,
    mvpScore: s.kdRatio * 30 + s.winRate * 0.5 + s.avgACS * 0.1 + s.headshotPct * 0.3,
  }));
  const mvp = scored.sort((a, b) => b.mvpScore - a.mvpScore)[0];

  return { bestKD, bestWinRate, bestHS, bestACS, mvp };
}
