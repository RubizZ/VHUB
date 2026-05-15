"use client";
import { useEffect, useState } from "react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; }
interface Stats { name: string; gamesPlayed: number; wins: number; losses: number; winRate: number; totalKills: number; totalDeaths: number; totalAssists: number; kdRatio: number; kdaRatio: number; avgKills: number; avgDeaths: number; avgAssists: number; avgACS: number; avgADR: number; headshotPct: number; mostPlayedAgent: string; mostPlayedMap: string; recentForm: string[]; agentStats: Record<string, { agent: string; games: number; wins: number; winRate: number }>; mapStats: Record<string, { map: string; games: number; wins: number; winRate: number; avgKills: number; avgDeaths: number }>; }
interface MMR { currenttierpatched: string; ranking_in_tier: number; mmr_change_to_last_game: number; elo: number; }
interface Match { metadata: { map: string; game_start_patched: string; rounds_played: number; mode: string; matchid: string }; players: { all_players: Array<{ name: string; tag: string; character: string; team: string; stats: { kills: number; deaths: number; assists: number; score: number; headshots: number }; damage_made: number }> }; teams: { red: { has_won: boolean; rounds_won: number; rounds_lost: number }; blue: { has_won: boolean; rounds_won: number; rounds_lost: number } }; }
interface PlayerData { stats: Stats; mmr: MMR | null; matches: Match[]; mock: boolean; }

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { 
    fetch("/api/players")
      .then(r => r.json())
      .then(d => setPlayers(d.players || [])); 
  }, []);

  const loadStats = async (p: Player) => {
    setSelected(p);
    setLoading(true);
    setError(null);
    setData(null);
    const name = p.riot_name || p.name;
    const tag = p.riot_tag || "EUW";
    try {
      const res = await fetch(`/api/valorant?action=stats&name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
      const d = await res.json();
      
      if (d.error) {
        if (d.error.includes("401")) {
          throw new Error("La Riot API Key ha caducado o es inválida. Por favor, renuévala en el .env");
        }
        if (d.error.includes("429")) {
          throw new Error("Demasiadas solicitudes a Riot. Espera un minuto y vuelve a intentarlo.");
        }
        throw new Error(d.error);
      }
      
      setData(d);
    } catch (err) {
      console.error("Error al cargar estadísticas:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  const roleColors: Record<string, string> = { 
    duelist: "#FF4655", 
    initiator: "#00D4AA", 
    controller: "#A855F7", 
    sentinel: "#3B82F6", 
    flex: "#F59E0B" 
  };

  return (
    <>
      <div className="page-header">
        <h2>📊 Estadísticas</h2>
        <p>Análisis de rendimiento del equipo</p>
      </div>
      <div className="page-content animate-in">
        {/* Selector de Jugador */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {players.map(p => (
            <button 
              key={p.id} 
              className={`btn ${selected?.id === p.id ? "btn-primary" : "btn-secondary"}`} 
              onClick={() => loadStats(p)} 
              style={{ borderColor: selected?.id === p.id ? p.avatar_color : undefined }}
            >
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.name[0]}</div>
              {p.name}
            </button>
          ))}
        </div>

        {!selected && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📊</p>
            <p>Selecciona un jugador para ver sus estadísticas</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <p style={{ animation: "pulse 1.5s infinite" }}>Cargando estadísticas reales...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ border: "1px solid var(--val-red)", background: "rgba(255,70,85,0.05)", textAlign: "center", padding: 32 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
            <h4 style={{ color: "var(--val-red)", marginBottom: 8 }}>Error al cargar datos</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400, margin: "0 auto 20px" }}>{error}</p>
            {error.includes("Key") && (
              <p style={{ fontSize: 12, opacity: 0.7 }}>Tip: Si usas una clave de desarrollo, recuerda que caducan cada 24 horas.</p>
            )}
          </div>
        )}

        {data && data.stats && !loading && selected && (
          <>
            {data.mock && (
              <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--val-yellow)" }}>
                ⚠️ Datos de demostración. Configura RIOT_API_KEY para datos reales.
              </div>
            )}

            {/* Tarjeta de Rango (MMR) */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: selected.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 800 }}>{selected.name[0]}</div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{selected.name}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    {data.mmr ? `${data.mmr.currenttierpatched} · ${data.mmr.ranking_in_tier} RR` : "Sin rango clasificado"}
                  </div>
                </div>
                {data.mmr && (
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: (data.mmr?.mmr_change_to_last_game ?? 0) >= 0 ? "var(--val-cyan)" : "var(--val-red)" }}>
                      {(data.mmr?.mmr_change_to_last_game ?? 0) >= 0 ? "+" : ""}{data.mmr?.mmr_change_to_last_game} RR
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Última partida</div>
                  </div>
                )}
              </div>

            {/* Estadísticas Clave */}
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              {[
                { label: "K/D", value: data.stats?.kdRatio || "0.0" },
                { label: "Win Rate", value: `${data.stats?.winRate || 0}%` },
                { label: "ACS", value: data.stats?.avgACS || 0 },
                { label: "HS%", value: `${data.stats?.headshotPct || 0}%` },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: "center" }}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              {/* Resumen */}
              <div className="card">
                <h4 className="card-title" style={{ marginBottom: 12 }}>Resumen de Temporada</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                  <div><span style={{ color: "var(--text-muted)" }}>Partidas:</span> {data.stats?.gamesPlayed || 0}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>W/L:</span> <span style={{ color: "var(--val-cyan)" }}>{data.stats?.wins || 0}W</span> / <span style={{ color: "var(--val-red)" }}>{data.stats?.losses || 0}L</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Avg Kills:</span> {data.stats?.avgKills || 0}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>KDA:</span> {data.stats?.kdaRatio || 0}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>ADR:</span> {data.stats?.avgADR || 0}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Top Agente:</span> {data.stats?.mostPlayedAgent || "N/A"}</div>
                </div>
              </div>

              {/* Forma Reciente */}
              <div className="card">
                <h4 className="card-title" style={{ marginBottom: 12 }}>Forma Reciente</h4>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {data.stats?.recentForm?.map((f, i) => (
                    <span key={i} className={`form-indicator form-${f.toLowerCase()}`} style={{ width: 24, height: 24, fontSize: 10 }}>{f}</span>
                  )) || <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Sin datos</span>}
                </div>
                <h4 className="card-title" style={{ marginBottom: 8, marginTop: 16, fontSize: 13 }}>Top 3 Agentes</h4>
                {Object.values(data.stats?.agentStats || {}).sort((a, b) => b.games - a.games).slice(0, 3).map(a => (
                  <div key={a.agent} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
                    <span>{a.agent}</span>
                    <span style={{ color: a.winRate >= 50 ? "var(--val-cyan)" : "var(--val-red)", fontWeight: 600 }}>{a.winRate}% WR</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de Partidas */}
            <div className="card">
              <h4 className="card-title" style={{ marginBottom: 16 }}>Historial de Partidas</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11 }}>
                      <th style={{ padding: "12px 8px", textAlign: "left" }}>Resultado</th>
                      <th style={{ padding: "12px 8px", textAlign: "left" }}>Mapa</th>
                      <th style={{ padding: "12px 8px", textAlign: "left" }}>Agente</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>K/D/A</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>ACS</th>
                      <th style={{ padding: "12px 8px", textAlign: "right" }}>Fecha</th>
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
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s" }} className="hover-row">
                          <td style={{ padding: "12px 8px" }}>
                            <span className={`form-indicator ${won ? "form-w" : "form-l"}`} style={{ marginRight: 8 }}>{won ? "W" : "L"}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{rw}-{rl}</span>
                          </td>
                          <td style={{ padding: "12px 8px" }}>{m.metadata.map}</td>
                          <td style={{ padding: "12px 8px" }}>{me.character}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center" }}>
                            <span style={{ color: "var(--val-cyan)" }}>{me.stats.kills}</span>/
                            <span style={{ color: "var(--val-red)" }}>{me.stats.deaths}</span>/
                            <span>{me.stats.assists}</span>
                          </td>
                          <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 600 }}>{acs}</td>
                          <td style={{ padding: "12px 8px", textAlign: "right", color: "var(--text-muted)", fontSize: 12 }}>
                            {new Date(m.metadata.game_start_patched).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
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
