"use client";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { findAgentById, ROLE_COLORS } from "@/lib/agents";
import Link from "next/link";

interface Match {
  id: number; riot_match_id: string; map_name: string; game_mode: string;
  game_start: string; game_length_ms: number; queue_id: string;
  team_blue_score: number; team_red_score: number; team_blue_won: boolean;
  event_id: number | null;
  our_team_side?: "Blue" | "Red";
  isHidden?: boolean;
  reason?: string;
}
interface PlayerStat {
  id: number; puuid: string; player_name: string; avatar_color: string;
  character_id: string; team_id: string; kills: number; deaths: number;
  assists: number; score: number; rounds_played: number;
}

export default function MatchesPage() {
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<{id: string, name: string}[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const fetchMatches = async (season?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = (season !== null && season !== undefined && season !== "") ? `/api/matches?season=${encodeURIComponent(season)}` : "/api/matches";
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar los partidos");
      setMatches(d.matches || []);
      if (d.seasons) setSeasons(d.seasons);
      if (d.activeSeasonId && season === null && selectedSeason === null) {
        setSelectedSeason(d.activeSeasonId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los partidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(selectedSeason || "");
  }, [selectedSeason]);

  useEffect(() => {
    if (deepLinkHandled || loading) return;
    const matchIdParam = searchParams.get("id");
    if (matchIdParam && matches.length > 0) {
      const matchId = Number(matchIdParam);
      const match = matches.find(m => m.id === matchId);
      if (match && !match.isHidden) {
        loadMatch(match);
      } else if (!match) {
        loadMatchById(matchId);
      }
      setDeepLinkHandled(true);
    }
  }, [matches, loading, deepLinkHandled, searchParams]);

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

  const loadMatchById = async (matchId: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/matches?id=${matchId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.match) {
        setSelected(data.match as Match);
        setStats(data.playerStats || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar detalles del partido");
    }
  };

  const syncMatches = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const pRes = await fetch("/api/players");
      const pData = await pRes.json();
      const playerWithPuuid = pData.players?.find((p: { puuid: string }) => p.puuid);
      if (!playerWithPuuid) {
        setError("Ningún jugador tiene un PUUID configurado.");
        setSyncing(false);
        return;
      }
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puuid: playerWithPuuid.puuid, action: "sync" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la sincronización");
      setSuccess(`Sincronización completada: ${data.synced} partidos procesados.`);
      fetchMatches(selectedSeason || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (ms: number) => { const m = Math.floor(ms / 60000); return `${m}min`; };
  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const winRate = useMemo(() => {
    if (matches.length === 0) return 0;
    const wins = matches.filter(m => (m.our_team_side === 'Blue' ? m.team_blue_won : !m.team_blue_won)).length;
    return Math.round((wins / matches.length) * 100);
  }, [matches]);

  const blueTeam = stats.filter(s => s.team_id === "Blue");
  const redTeam = stats.filter(s => s.team_id === "Red");

  const renderPlayerRow = (p: PlayerStat) => {
    const agent = findAgentById(p.character_id);
    const acs = p.rounds_played > 0 ? Math.round(p.score / p.rounds_played) : 0;
    const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString();
    return (
      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <td style={{ padding: "12px 8px", display: "flex", alignItems: "center", gap: 12 }}>
          {agent && (
            <img src={agent.displayIcon} alt={agent.name} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[agent.role] || 'var(--val-red)'}` }} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600 }}>{p.player_name || p.puuid?.substring(0, 8) || "?"}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{agent?.name || "?" }</span>
          </div>
        </td>
        <td style={{ textAlign: "center", fontWeight: 800, fontSize: 16 }}>{p.kills}</td>
        <td style={{ textAlign: "center", color: "rgba(255,70,85,0.6)" }}>{p.deaths}</td>
        <td style={{ textAlign: "center", color: "rgba(0,212,170,0.6)" }}>{p.assists}</td>
        <td style={{ textAlign: "center", fontWeight: 700, color: parseFloat(kd as string) >= 1 ? "var(--val-cyan)" : "var(--val-red)" }}>{kd}</td>
        <td style={{ textAlign: "center", fontWeight: 600 }}>{acs}</td>
      </tr>
    );
  };

  return (
    <div className="matches-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Historial de Partidos</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Análisis detallado de tu rendimiento en Premier</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
             <button className="btn btn-primary" onClick={syncMatches} disabled={syncing}>
                {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar Partidos"}
             </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 16 }}>
           <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              <SeasonTab active={selectedSeason === null} label="Todas" onClick={() => setSelectedSeason(null)} />
              {seasons.map(s => (
                <SeasonTab key={s.id} active={selectedSeason === s.id} label={s.name || s.id} onClick={() => setSelectedSeason(s.id)} />
              ))}
           </div>
           {matches.length > 0 && (
             <div className="glass-card" style={{ padding: "8px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                   <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Win Rate</div>
                   <div style={{ fontSize: 18, fontWeight: 800, color: "var(--val-cyan)" }}>{winRate}%</div>
                </div>
                <div style={{ width: 1, height: 24, background: "var(--border-color)" }} />
                <div style={{ textAlign: "center" }}>
                   <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Jugados</div>
                   <div style={{ fontSize: 18, fontWeight: 800 }}>{matches.length}</div>
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0 }}>
        {error && <div className="card" style={{ background: "rgba(255,70,85,0.1)", border: "1px solid var(--val-red)", color: "var(--val-red)", marginBottom: 16 }}>{error}</div>}
        {success && <div className="card" style={{ background: "rgba(0,212,170,0.1)", border: "1px solid var(--val-cyan)", color: "var(--val-cyan)", marginBottom: 16 }}>{success}</div>}

        {!selected ? (
          <div className="grid grid-2" style={{ gap: 16 }}>
            {loading && matches.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Cargando...</div>
            ) : (
              matches.map(m => (
                <MatchCard key={m.id} match={m} onClick={() => loadMatch(m)} />
              ))
            )}
            {matches.length === 0 && !loading && (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState message="No hay partidos registrados para esta temporada." />
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in">
            <button className="btn btn-ghost" style={{ marginBottom: 20, paddingLeft: 0 }} onClick={() => { setSelected(null); setStats([]); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Volver al historial
            </button>

            <div className="card glass-card" style={{ marginBottom: 24, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: (selected.our_team_side === "Blue" ? selected.team_blue_won : !selected.team_blue_won) ? "var(--val-cyan)" : "var(--val-red)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 32 }}>
                <div>
                  <h2 style={{ fontSize: 28, fontWeight: 800 }}>{selected.map_name}</h2>
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{formatDate(selected.game_start)} • {selected.queue_id || "Premier"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
                   <ScoreBlock label="Tu Equipo" score={selected.our_team_side === "Blue" ? selected.team_blue_score : selected.team_red_score} color="var(--val-cyan)" win={selected.our_team_side === "Blue" ? selected.team_blue_won : !selected.team_blue_won} />
                   <div style={{ fontSize: 24, fontWeight: 200, color: "var(--text-muted)" }}>VS</div>
                   <ScoreBlock label="Rival" score={selected.our_team_side === "Blue" ? selected.team_red_score : selected.team_blue_score} color="var(--val-red)" win={selected.our_team_side === "Blue" ? !selected.team_blue_won : selected.team_blue_won} />
                </div>
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 24, alignItems: "start" }}>
               {[
                 { label: "Estadísticas de tu Equipo", team: selected.our_team_side === "Blue" ? blueTeam : redTeam, color: "var(--val-cyan)" },
                 { label: "Estadísticas del Rival", team: selected.our_team_side === "Blue" ? redTeam : blueTeam, color: "var(--val-red)" }
               ].map(t => (
                 <div key={t.label} className="card glass-card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: t.color }}>{t.label}</h3>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                            <th style={{ textAlign: "left", padding: "0 8px 12px" }}>Jugador</th>
                            <th style={{ textAlign: "center", padding: "0 8px 12px" }}>K</th>
                            <th style={{ textAlign: "center", padding: "0 8px 12px" }}>D</th>
                            <th style={{ textAlign: "center", padding: "0 8px 12px" }}>A</th>
                            <th style={{ textAlign: "center", padding: "0 8px 12px" }}>K/D</th>
                            <th style={{ textAlign: "center", padding: "0 8px 12px" }}>ACS</th>
                          </tr>
                        </thead>
                        <tbody>{t.team.map(renderPlayerRow)}</tbody>
                      </table>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, onClick }: { match: Match, onClick: () => void }) {
  const isWin = match.team_blue_won === (match.our_team_side === 'Blue');
  return (
    <div className="card glass-card hover-lift" onClick={onClick} style={{ cursor: "pointer", padding: 20, borderLeft: `4px solid ${isWin ? 'var(--val-cyan)' : 'var(--val-red)'}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
           <div style={{ fontWeight: 800, fontSize: 18 }}>{match.map_name}</div>
           <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(match.game_start).toLocaleDateString()}</div>
        </div>
        <div className={`tag ${isWin ? 'tag-green' : 'tag-red'}`} style={{ height: "fit-content" }}>
          {isWin ? 'VICTORIA' : 'DERROTA'}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: isWin ? 'var(--val-cyan)' : 'var(--text-primary)' }}>
          {match.our_team_side === 'Blue' ? match.team_blue_score : match.team_red_score}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>—</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: !isWin ? 'var(--val-red)' : 'var(--text-primary)' }}>
          {match.our_team_side === 'Blue' ? match.team_red_score : match.team_blue_score}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
           <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{match.queue_id || "Premier"}</div>
           <div style={{ fontSize: 11, color: "var(--val-red)", fontWeight: 800, marginTop: 2 }}>DETALLES →</div>
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ label, score, color, win }: any) {
  return (
    <div style={{ textAlign: "center" }}>
       <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
       <div style={{ fontSize: 48, fontWeight: 900, color: win ? color : "var(--text-primary)", opacity: win ? 1 : 0.4 }}>{score}</div>
       {win && <div style={{ fontSize: 11, fontWeight: 800, color, marginTop: 4 }}>GANADOR</div>}
    </div>
  );
}

function SeasonTab({ active, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`} style={{ whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🎮</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}
