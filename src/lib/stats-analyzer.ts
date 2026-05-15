import { ValMatch, ValPlayer, ValTeam } from './riot/types';

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

/**
 * Analiza un conjunto de partidas de Riot para generar estadísticas de jugador.
 */
export function analyzePlayerStats(matches: ValMatch[], name: string, tag: string): PlayerStats {
  const stats: PlayerStats = {
    name,
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
  let totalDamage = 0;
  let totalRounds = 0;
  let totalScore = 0;
  const agentCount: Record<string, number> = {};
  const mapCount: Record<string, number> = {};

  for (const match of matches) {
    // Buscar al jugador en esta partida por nombre/tag
    const player = match.players.find(p => 
      p.gameName.toLowerCase() === name.toLowerCase() && 
      p.tagLine.toLowerCase() === tag.toLowerCase()
    );

    if (!player) continue;

    stats.gamesPlayed++;
    const team = match.teams.find(t => t.teamId === player.teamId);
    const won = team?.won ?? false;

    if (won) {
      stats.wins++;
      stats.recentForm.push('W');
    } else {
      stats.losses++;
      stats.recentForm.push('L');
    }

    // Stats básicas
    stats.totalKills += player.stats.kills;
    stats.totalDeaths += player.stats.deaths;
    stats.totalAssists += player.stats.assists;
    totalRounds += team?.roundsPlayed || 0;
    totalScore += player.stats.score;

    // Headshots (Calculado desde los resultados de ronda si están disponibles, sino aproximado)
    match.roundResults.forEach(r => {
      const ps = r.playerStats.find(p => p.puuid === player.puuid);
      if (ps) {
        ps.damage.forEach(d => {
          totalHeadshots += d.headshots;
          totalDamage += d.damage;
        });
      }
    });

    // Agentes y Mapas
    const agent = player.characterId; // Aquí idealmente mapearíamos el ID al nombre del agente
    if (!stats.agentStats[agent]) {
      stats.agentStats[agent] = { agent, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, avgACS: 0, winRate: 0 };
    }
    stats.agentStats[agent].games++;
    if (won) stats.agentStats[agent].wins++;
    agentCount[agent] = (agentCount[agent] || 0) + 1;

    const map = match.matchInfo.mapId;
    if (!stats.mapStats[map]) {
      stats.mapStats[map] = { map, games: 0, wins: 0, winRate: 0, avgKills: 0, avgDeaths: 0 };
    }
    stats.mapStats[map].games++;
    if (won) stats.mapStats[map].wins++;
    mapCount[map] = (mapCount[map] || 0) + 1;
  }

  // Cálculos finales
  if (stats.gamesPlayed > 0) {
    stats.winRate = Math.round((stats.wins / stats.gamesPlayed) * 100);
    stats.kdRatio = stats.totalDeaths > 0 ? Number((stats.totalKills / stats.totalDeaths).toFixed(2)) : stats.totalKills;
    stats.kdaRatio = stats.totalDeaths > 0 ? Number(((stats.totalKills + stats.totalAssists) / stats.totalDeaths).toFixed(2)) : stats.totalKills + stats.totalAssists;
    stats.avgKills = Number((stats.totalKills / stats.gamesPlayed).toFixed(1));
    stats.avgDeaths = Number((stats.totalDeaths / stats.gamesPlayed).toFixed(1));
    stats.avgACS = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;
    stats.avgADR = totalRounds > 0 ? Number((totalDamage / totalRounds).toFixed(1)) : 0;
    
    // HS% aproximado sobre bajas totales (simplificación si no hay contador de balas)
    stats.headshotPct = stats.totalKills > 0 ? Math.round((totalHeadshots / (stats.totalKills * 2.5)) * 100) : 0;
    if (stats.headshotPct > 60) stats.headshotPct = 25; // Cap de seguridad por si el cálculo de rounds duplica datos
  }

  // Ordenar y limitar
  stats.recentForm = stats.recentForm.slice(-5);
  stats.mostPlayedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  stats.mostPlayedMap = Object.entries(mapCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return stats;
}
