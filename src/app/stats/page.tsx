"use client";
import { useEffect, useState } from "react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; }
interface Stats { name: string; gamesPlayed: number; wins: number; losses: number; winRate: number; totalKills: number; totalDeaths: number; totalAssists: number; kdRatio: number; kdaRatio: number; avgKills: number; avgDeaths: number; avgAssists: number; avgACS: number; avgADR: number; headshotPct: number; mostPlayedAgent: string; mostPlayedMap: string; recentForm: string[]; agentStats: Record<string, { agent: string; games: number; wins: number; winRate: number }>; mapStats: Record<string, { map: string; games: number; wins: number; winRate: number; avgKills: number; avgDeaths: number }>; }
interface MMR { currenttierpatched: string; ranking_in_tier: number; mmr_change_to_last_game: number; elo: number; }
interface Match { metadata: { map: string; game_start_patched: string; rounds_played: number; mode: string; matchid: string }; players: { all_players: Array<{ name: string; tag: string; character: string; team: string; stats: { kills: number; deaths: number; assists: number; score: number; headshots: number }; damage_made: number }> }; teams: { red: { has_won: boolean; rounds_won: number; rounds_lost: number }; blue: { has_won: boolean; rounds_won: number; rounds_lost: number } }; }
interface PlayerData { stats: Stats; mmr: MMR; matches: Match[]; mock: boolean; }

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || [])); }, []);

  const loadStats = async (p: Player) => {
    setSelected(p);
    setLoading(true);
    const name = p.riot_name || p.name;
    const tag = p.riot_tag || "EUW";
    const res = await fetch(`/api/valorant?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  const roleColors: Record<string, string> = { duelist: "#FF4655", initiator: "#00D4AA", controller: "#A855F7", sentinel: "#3B82F6", flex: "#F59E0B" };

  return (
    <>
      <div className="page-header">
        <h2>📊 Estadísticas</h2>
        <p>Análisis de rendimiento del equipo</p>
      </div>
      <div className="page-content animate-in">
        {/* Player selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {players.map(p => (
            <button key={p.id} className={`btn ${selected?.id === p.id ? "btn-primary" : "btn-secondary"}`} onClick={() => loadStats(p)} style={{ borderColor: selected?.id === p.id ? p.avatar_color : undefined }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.name[0]}</div>
              {p.name}
            </button>
          ))}
        </div>

        {!selected && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><p style={{ fontSize: 48, marginBottom: 12 }}>📊</p><p>Selecciona un jugador para ver sus estadísticas</p></div>}

        {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><p style={{ animation: "pulse 1.5s infinite" }}>Cargando estadísticas...</p></div>}

        {data && !loading && selected && (
          <>
            {data.mock && <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--val-yellow)" }}>⚠️ Datos de demostración. Configura HENRIK_API_KEY en .env.local para datos reales.</div>}

            {/* MMR Card */}
            <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${roleColors[selected.role] || "#FF4655"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: selected.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 800 }}>{selected.name[0]}</div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{data.mmr.currenttierpatched} · {data.mmr.ranking_in_tier} RR</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: data.mmr.mmr_change_to_last_game >= 0 ? "var(--val-cyan)" : "var(--val-red)" }}>
                    {data.mmr.mmr_change_to_last_game >= 0 ? "+" : ""}{data.mmr.mmr_change_to_last_game} RR
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Última partida</div>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              {[
                { label: "K/D", value: data.stats.kdRatio },
                { label: "Win Rate", value: `${data.stats.winRate}%` },
                { label: "ACS", value: data.stats.avgACS },
                { label: "HS%", value: `${data.stats.headshotPct}%` },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: "center" }}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              {/* Overview */}
              <div className="card">
                <h4 className="card-title" style={{ marginBottom: 12 }}>Resumen General</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
                  <div><span style={{ color: "var(--text-muted)" }}>Partidas:</span> {data.stats.gamesPlayed}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>W/L:</span> <span style={{ color: "var(--val-cyan)" }}>{data.stats.wins}W</span> / <span style={{ color: "var(--val-red)" }}>{data.stats.losses}L</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Avg Kills:</span> {data.stats.avgKills}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Avg Deaths:</span> {data.stats.avgDeaths}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>KDA:</span> {data.stats.kdaRatio}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>ADR:</span> {data.stats.avgADR}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Top Agente:</span> {data.stats.mostPlayedAgent}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Top Mapa:</span> {data.stats.mostPlayedMap}</div>
                </div>
              </div>

              {/* Recent Form */}
              <div className="card">
                <h4 className="card-title" style={{ marginBottom: 12 }}>Forma Reciente</h4>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {data.stats.recentForm.map((f, i) => (
                    <span key={i} className={`form-indicator form-${f.toLowerCase()}`}>{f}</span>
                  ))}
                </div>
                <h4 className="card-title" style={{ marginBottom: 8, marginTop: 16 }}>Por Agente</h4>
                {Object.values(data.stats.agentStats).sort((a, b) => b.games - a.games).slice(0, 5).map(a => (
                  <div key={a.agent} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border-color)" }}>
                    <span>{a.agent}</span>
                    <span style={{ color: a.winRate >= 50 ? "var(--val-cyan)" : "var(--val-red)" }}>{a.games}G · {a.winRate}% WR</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Match History */}
            <div className="card">
              <h4 className="card-title" style={{ marginBottom: 12 }}>Historial de Partidas</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11 }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>Resultado</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Mapa</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Agente</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>K</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>D</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>A</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>ACS</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matches.map((m, i) => {
                      const me = m.players.all_players[0];
                      if (!me) return null;
                      const team = me.team.toLowerCase() as "red" | "blue";
                      const won = m.teams[team]?.has_won;
                      const rw = m.teams[team]?.rounds_won || 0;
                      const rl = m.teams[team]?.rounds_lost || 0;
                      const acs = m.metadata.rounds_played > 0 ? Math.round(me.stats.score / m.metadata.rounds_played) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ padding: "8px" }}>
                            <span className={`form-indicator ${won ? "form-w" : "form-l"}`} style={{ marginRight: 8 }}>{won ? "W" : "L"}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{rw}-{rl}</span>
                          </td>
                          <td style={{ padding: "8px" }}>{m.metadata.map}</td>
                          <td style={{ padding: "8px" }}>{me.character}</td>
                          <td style={{ padding: "8px", textAlign: "center", color: "var(--val-cyan)" }}>{me.stats.kills}</td>
                          <td style={{ padding: "8px", textAlign: "center", color: "var(--val-red)" }}>{me.stats.deaths}</td>
                          <td style={{ padding: "8px", textAlign: "center" }}>{me.stats.assists}</td>
                          <td style={{ padding: "8px", textAlign: "center" }}>{acs}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--text-muted)", fontSize: 12 }}>
                            {new Date(m.metadata.game_start * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
