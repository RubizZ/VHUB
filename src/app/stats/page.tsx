"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";

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
        <div className="card glass-card" style={{ marginBottom: 24, padding: "16px" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {players.map(p => (
              <button 
                key={p.id} 
                className={`btn ${selected?.id === p.id ? "btn-primary" : "btn-secondary"} hover-lift`} 
                onClick={() => loadStats(p)} 
                style={{ 
                  borderColor: selected?.id === p.id ? p.avatar_color : undefined,
                  boxShadow: selected?.id === p.id ? `0 0 15px ${p.avatar_color}44` : undefined
                }}
              >
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: "50%", 
                  background: p.avatar_color, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 12, 
                  color: "#fff", 
                  fontWeight: 800,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
                }}>{p.name[0]}</div>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {!selected && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📊</p>
            <p>Selecciona un jugador para ver sus estadísticas</p>
          </div>
        )}

        {loading && (
          <div className="animate-fade-in">
            {/* MMR Skeleton */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <Skeleton width={60} height={60} circle />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton width={120} height={20} />
                <Skeleton width={180} height={14} />
              </div>
            </div>

            {/* Key Stats Skeleton */}
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card" style={{ textAlign: "center" }}>
                  <Skeleton width="60%" height={28} style={{ margin: "0 auto 8px" }} />
                  <Skeleton width="40%" height={12} style={{ margin: "0 auto" }} />
                </div>
              ))}
            </div>

            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div className="card">
                <Skeleton width={150} height={18} style={{ marginBottom: 16 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} width="100%" height={14} />
                  ))}
                </div>
              </div>
              <div className="card">
                <Skeleton width={120} height={18} style={{ marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} width={24} height={24} />
                  ))}
                </div>
                <Skeleton width={100} height={14} style={{ marginTop: 16, marginBottom: 8 }} />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height={20} style={{ margin: "8px 0" }} />
                ))}
              </div>
            </div>
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

            {/* Tarjeta de Perfil y Rango */}
            <div className="card glass-card animate-in" style={{ marginBottom: 24, position: "relative", overflow: "hidden" }}>
              <div className="hero-gradient" style={{ position: "absolute", inset: 0, opacity: 0.5 }}></div>
              <div style={{ display: "flex", alignItems: "center", gap: 24, position: "relative", zIndex: 1 }}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: "24px", 
                  background: `linear-gradient(135deg, ${selected.avatar_color}, #000)`, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 32, 
                  color: "#fff", 
                  fontWeight: 900,
                  boxShadow: `0 10px 20px ${selected.avatar_color}44`,
                  border: `2px solid ${selected.avatar_color}`
                }}>{selected.name[0]}</div>
                <div>
                  <h3 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{selected.name}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: "4px 12px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
                      {data.mmr ? data.mmr.currenttierpatched : "Sin Rango"}
                    </div>
                    {data.mmr && (
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
                        {data.mmr.ranking_in_tier} RR
                      </div>
                    )}
                  </div>
                </div>
                {data.mmr && (
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div className="stat-value" style={{ 
                      fontSize: 24, 
                      color: (data.mmr?.mmr_change_to_last_game ?? 0) >= 0 ? "var(--val-cyan)" : "var(--val-red)",
                      background: "none",
                      WebkitTextFillColor: "initial"
                    }}>
                      {(data.mmr?.mmr_change_to_last_game ?? 0) >= 0 ? "+" : ""}{data.mmr?.mmr_change_to_last_game}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Última Partida</div>
                  </div>
                )}
              </div>
            </div>

            {/* Estadísticas Clave */}
            <div className="grid grid-4 animate-in" style={{ marginBottom: 24, animationDelay: "0.1s" }}>
              {[
                { label: "K/D Ratio", value: data.stats?.kdRatio || "0.0", color: "var(--val-red)" },
                { label: "Win Rate", value: `${data.stats?.winRate || 0}%`, color: "var(--val-cyan)" },
                { label: "Avg Score", value: data.stats?.avgACS || 0, color: "var(--val-purple)" },
                { label: "HS Percentage", value: `${data.stats?.headshotPct || 0}%`, color: "var(--val-yellow)" },
              ].map(s => (
                <div key={s.label} className="card glass-card stat-card hover-lift" style={{ textAlign: "center", "--glow-color": s.color } as any}>
                  <div className="stat-value" style={{ fontSize: 32 }}>{s.value}</div>
                  <div className="stat-label" style={{ fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-2 animate-in" style={{ marginBottom: 24, animationDelay: "0.2s" }}>
              {/* Resumen */}
              <div className="card glass-card">
                <div className="card-header">
                  <h4 className="card-title">Resumen de Temporada</h4>
                  <div className="nav-badge" style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-secondary)" }}>{data.stats?.gamesPlayed || 0} Games</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>W/L Ratio</span>
                    <div style={{ fontWeight: 700 }}>
                      <span style={{ color: "var(--val-cyan)" }}>{data.stats?.wins || 0}W</span> / <span style={{ color: "var(--val-red)" }}>{data.stats?.losses || 0}L</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Avg Kills</span>
                    <div style={{ fontWeight: 700 }}>{data.stats?.avgKills || 0}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>KDA Ratio</span>
                    <div style={{ fontWeight: 700 }}>{data.stats?.kdaRatio || 0}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>ADR</span>
                    <div style={{ fontWeight: 700 }}>{data.stats?.avgADR || 0}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Top Agente</span>
                    <div style={{ fontWeight: 700, color: "var(--val-red)", fontSize: 16 }}>{data.stats?.mostPlayedAgent || "N/A"}</div>
                  </div>
                </div>
              </div>

              {/* Forma Reciente */}
              <div className="card glass-card">
                <div className="card-header">
                  <h4 className="card-title">Rendimiento Reciente</h4>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {data.stats?.recentForm?.map((f, i) => (
                    <span key={i} className={`form-indicator form-${f.toLowerCase()}`} style={{ 
                      width: 32, 
                      height: 32, 
                      fontSize: 12, 
                      fontWeight: 800,
                      borderRadius: "8px",
                      boxShadow: f === 'W' ? '0 0 10px rgba(0, 212, 170, 0.2)' : '0 0 10px rgba(255, 70, 85, 0.2)'
                    }}>{f}</span>
                  )) || <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Sin datos</span>}
                </div>
                
                <h4 className="card-title" style={{ marginBottom: 12, fontSize: 13, opacity: 0.8 }}>Top 3 Agentes</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.values(data.stats?.agentStats || {}).sort((a, b) => b.games - a.games).slice(0, 3).map(a => (
                    <div key={a.agent} className="hover-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                      <span style={{ fontWeight: 600 }}>{a.agent}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{a.games} games</span>
                        <span style={{ color: a.winRate >= 50 ? "var(--val-cyan)" : "var(--val-red)", fontWeight: 700 }}>{a.winRate}% WR</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Historial de Partidas */}
            <div className="card glass-card animate-in" style={{ animationDelay: "0.3s" }}>
              <div className="card-header">
                <h4 className="card-title">Historial de Partidas</h4>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>
                      <th style={{ padding: "8px 16px", textAlign: "left" }}>Resultado</th>
                      <th style={{ padding: "8px 16px", textAlign: "left" }}>Mapa</th>
                      <th style={{ padding: "8px 16px", textAlign: "left" }}>Agente</th>
                      <th style={{ padding: "8px 16px", textAlign: "center" }}>KDA</th>
                      <th style={{ padding: "8px 16px", textAlign: "center" }}>ACS</th>
                      <th style={{ padding: "8px 16px", textAlign: "right" }}>Fecha</th>
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
                        <tr key={i} className="hover-row" style={{ background: "rgba(255,255,255,0.03)", transition: "var(--transition)" }}>
                          <td style={{ padding: "12px 16px", borderRadius: "8px 0 0 8px", borderLeft: `4px solid ${won ? "var(--val-cyan)" : "var(--val-red)"}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span className={`form-indicator ${won ? "form-w" : "form-l"}`} style={{ width: 24, height: 24, fontSize: 10 }}>{won ? "W" : "L"}</span>
                              <span style={{ fontFamily: "var(--font-valorant)", fontWeight: 700, fontSize: 14 }}>{rw}-{rl}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 500 }}>{m.metadata.map}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 600 }}>{me.character}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: 4, fontFamily: "var(--font-valorant)", fontSize: 13 }}>
                              <span style={{ color: "var(--val-cyan)" }}>{me.stats.kills}</span>
                              <span style={{ opacity: 0.3 }}>/</span>
                              <span style={{ color: "var(--val-red)" }}>{me.stats.deaths}</span>
                              <span style={{ opacity: 0.3 }}>/</span>
                              <span style={{ color: "var(--text-secondary)" }}>{me.stats.assists}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{ fontWeight: 800, color: acs >= 250 ? "var(--val-yellow)" : "inherit" }}>{acs}</span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", borderRadius: "0 8px 8px 0" }}>
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                              {new Date(m.metadata.game_start_patched).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            </span>
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
