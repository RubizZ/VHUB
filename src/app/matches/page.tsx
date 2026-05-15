"use client";
import { useEffect, useState } from "react";
import { findAgentById, ROLE_COLORS } from "@/lib/agents";

interface Match {
  id: number; riot_match_id: string; map_name: string; game_mode: string;
  game_start: string; game_length_ms: number; queue_id: string;
  team_blue_score: number; team_red_score: number; team_blue_won: boolean;
  event_id: number | null;
  isHidden?: boolean;
  reason?: string;
}
interface PlayerStat {
  id: number; puuid: string; player_name: string; avatar_color: string;
  character_id: string; team_id: string; kills: number; deaths: number;
  assists: number; score: number; rounds_played: number;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<{id: string, name: string}[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selected, setSelected] = useState<Match | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMatches = async (season?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = season ? `/api/matches?season=${encodeURIComponent(season)}` : "/api/matches";
      const r = await fetch(url);
      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.error || "Error al cargar los partidos");
      }

      setMatches(d.matches || []);
      if (d.seasons) setSeasons(d.seasons);
      if (d.activeSeasonId && !season && !selectedSeason) {
        setSelectedSeason(d.activeSeasonId);
      }
    } catch (err) {
      console.error("[MatchesPage] fetchMatches error:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los partidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(selectedSeason);
  }, [selectedSeason]);

  const loadMatch = async (m: Match) => {
    if (m.isHidden) return;
    setSelected(m);
    setError(null);
    try {
      const res = await fetch(`/api/matches?id=${m.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data.playerStats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar detalles");
    }
  };

  const syncMatches = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      // Get first player with puuid
      const pRes = await fetch("/api/players");
      const pData = await pRes.json();

      if (!pRes.ok) {
        throw new Error(pData.error || "Error al cargar jugadores");
      }

      const playerWithPuuid = pData.players?.find((p: { puuid: string }) => p.puuid);

      if (!playerWithPuuid) {
        setError("Ningún jugador tiene un PUUID configurado. Ve a Ajustes y añade el Riot ID de un jugador.");
        setSyncing(false);
        return;
      }

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puuid: playerWithPuuid.puuid, action: "sync" })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : "Error en la sincronización";
        if (errMsg.toLowerCase().includes("consentimiento")) {
          setError("No has dado tu consentimiento para procesar tus datos. Ve a tu Perfil para activarlo.");
        } else {
          setError(errMsg);
        }
        return;
      }

      setSuccess(`Sincronización completada: ${data.synced} partidos procesados.`);
      await fetchMatches(selectedSeason);
    } catch (err) {
      console.error("[MatchesPage] syncMatches error:", err);
      setError(err instanceof Error ? err.message : "Error de conexión al servidor");
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (ms: number) => { const m = Math.floor(ms / 60000); return `${m}min`; };
  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const blueTeam = stats.filter(s => s.team_id === "Blue");
  const redTeam = stats.filter(s => s.team_id === "Red");

  const renderPlayerRow = (p: PlayerStat) => {
    const agent = findAgentById(p.character_id);
    const acs = p.rounds_played > 0 ? Math.round(p.score / p.rounds_played) : 0;
    const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString();
    return (
      <tr key={p.id}>
        <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {agent && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={agent.displayIcon} alt={agent.name} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[agent.role]}` }} />
          )}
          <span>{p.player_name || p.puuid?.substring(0, 8) || "?"}</span>
        </td>
        <td style={{ textAlign: "center" }}>{agent?.name || "?"}</td>
        <td style={{ textAlign: "center", fontWeight: 700 }}>{p.kills}</td>
        <td style={{ textAlign: "center", color: "#FF4655" }}>{p.deaths}</td>
        <td style={{ textAlign: "center", color: "#00D4AA" }}>{p.assists}</td>
        <td style={{ textAlign: "center", fontWeight: 600, color: parseFloat(kd as string) >= 1 ? "#00D4AA" : "#FF4655" }}>{kd}</td>
        <td style={{ textAlign: "center" }}>{acs}</td>
      </tr>
    );
  };

  return (
    <>
      <div className="page-header">
        <h2>🏆 Partidos de Premier</h2>
        <p>Historial competitivo y estadísticas de temporada</p>
      </div>
      <div className="page-content animate-in">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {error && (
            <div className="card" style={{ border: "1px solid var(--val-red)", background: "rgba(255,70,85,0.05)", color: "var(--val-red)", padding: "12px 16px", fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="card" style={{ border: "1px solid var(--val-cyan)", background: "rgba(0,212,170,0.05)", color: "var(--val-cyan)", padding: "12px 16px", fontSize: 14 }}>
              ✅ {success}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={syncMatches} disabled={syncing}>
                {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar Premier"}
              </button>
            </div>

            {seasons.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Temporada:</span>
                <select
                  className="card"
                  style={{ padding: "6px 12px", background: "var(--card-bg)", color: "white", border: "1px solid var(--border-color)", borderRadius: 4 }}
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                >
                  <option value="">Todas las temporadas</option>
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.id}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {loading && !syncing ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>Cargando partidos...</div>
        ) : !selected ? (
          <div className="grid grid-auto">
            {matches.map(m => (
              <div
                key={m.id}
                className="card"
                style={{ cursor: m.isHidden ? "default" : "pointer", opacity: m.isHidden ? 0.7 : 1 }}
                onClick={() => loadMatch(m)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{m.isHidden ? "Partido Privado" : m.map_name}</h3>
                  <span className={`tag ${m.queue_id?.toLowerCase() === "premier" ? "tag-gold" : "tag-blue"}`}>{m.queue_id || "premier"}</span>
                </div>

                {m.isHidden ? (
                  <div style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
                    🔒 {m.reason || "Sin consentimiento de datos"}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, margin: "12px 0" }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: m.team_blue_won ? "#3B82F6" : "var(--text-muted)" }}>{m.team_blue_score}</span>
                      <span style={{ fontSize: 14, color: "var(--text-muted)" }}>vs</span>
                      <span style={{ fontSize: 28, fontWeight: 800, color: !m.team_blue_won ? "#FF4655" : "var(--text-muted)" }}>{m.team_red_score}</span>
                    </div>
                  </>
                )}

                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span>{formatDate(m.game_start)}</span>
                  {!m.isHidden && <span>{formatDuration(m.game_length_ms)}</span>}
                </div>
                {m.event_id && !m.isHidden && <span style={{ fontSize: 11, color: "#00D4AA", marginTop: 4, display: "block" }}>📅 Vinculado a evento</span>}
              </div>
            ))}
            {matches.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay partidos sincronizados. Configura tu Riot API key y sincroniza.</p>}
          </div>
        ) : (
          <>
            <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => { setSelected(null); setStats([]); }}>← Volver</button>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700 }}>{selected.map_name}</h3>
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>{formatDate(selected.game_start)} · {formatDuration(selected.game_length_ms)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: selected.team_blue_won ? "#3B82F6" : "var(--text-muted)" }}>{selected.team_blue_score}</span>
                  <span style={{ fontSize: 16, color: "var(--text-muted)" }}>—</span>
                  <span style={{ fontSize: 36, fontWeight: 800, color: !selected.team_blue_won ? "#FF4655" : "var(--text-muted)" }}>{selected.team_red_score}</span>
                </div>
              </div>
            </div>

            {[{ label: "Blue Team", team: blueTeam, color: "#3B82F6" }, { label: "Red Team", team: redTeam, color: "#FF4655" }].map(({ label, team, color }) => (
              <div key={label} className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ color, fontWeight: 700, marginBottom: 12 }}>{label}</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px" }}>Jugador</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>Agente</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>K</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>D</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>A</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>K/D</th>
                        <th style={{ textAlign: "center", padding: "6px 8px" }}>ACS</th>
                      </tr>
                    </thead>
                    <tbody>{team.map(renderPlayerRow)}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
