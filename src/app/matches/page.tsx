 
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useMemo, CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { ROLE_COLORS, type AgentRole } from "@/lib/agents";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Match {
  id: number; riot_match_id: string; map_name: string; game_mode: string;
  game_start: string; game_length_ms: number; queue_id: string;
  team_blue_score: number; team_red_score: number; team_blue_won: boolean;
  team_blue_name?: string | null; team_red_name?: string | null;
  team_blue_tag?: string | null; team_red_tag?: string | null;
  team_blue_icon?: string | null; team_red_icon?: string | null;
  event_id: number | null;
  our_team_side?: "Blue" | "Red";
  isHidden?: boolean;
  reason?: string;
  event?: {
    id: number;
    title: string;
    type: string;
    date: string;
    time: string;
  } | null;
}
interface PlayerStat {
  id: number; puuid: string; player_name: string; avatar_color: string;
  character_id: string; team_id: string; kills: number; deaths: number;
  assists: number; score: number; rounds_played: number;
}

export default function MatchesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  // 1. Fetch matches & seasons
  const {
    data: matchesData,
    isLoading: matchesLoading,
    error: matchesError,
  } = useQuery<{ matches: Match[]; seasons: { id: string; name: string }[]; activeSeasonId: string }>({
    queryKey: ["matches", selectedSeason],
    queryFn: async () => {
      const url = selectedSeason ? `/api/matches/premier?season=${encodeURIComponent(selectedSeason)}` : "/api/matches/premier";
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar los partidos");
      return d;
    },
  });

  const matches = matchesData?.matches || [];
  const seasons = matchesData?.seasons || [];

  // 1.5 Fetch premier history for the points timeline
  const { data: historyData } = useQuery<{ history: any[] }>({
    queryKey: ["premier", "history"],
    queryFn: async () => {
      const r = await fetch("/api/team/premier/history");
      if (!r.ok) return { history: [] };
      return r.json();
    }
  });
  const premierHistory = historyData?.history || [];

  // 1.7 Fetch current premier points
  const { data: premierDetailsData } = useQuery<{ details: any }>({
    queryKey: ["premier", "details"],
    queryFn: async () => {
      const r = await fetch("/api/team/premier/details");
      if (!r.ok) return { details: null };
      return r.json();
    }
  });
  const currentPremierPoints = premierDetailsData?.details?.placement?.points || 0;



  // 2. Fetch selected match details
  const {
    data: matchDetailsData,
    error: matchDetailsError,
  } = useQuery<{ playerStats: PlayerStat[] }>({
    queryKey: ["matchDetails", selected?.id],
    queryFn: async () => {
      if (!selected) return null;
      const res = await fetch(`/api/matches?id=${selected.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!selected,
  });

  const stats = matchDetailsData?.playerStats || [];

  // 2.5 Fetch agents
  const {
    data: agentsData
  } = useQuery<{ agents: any[] }>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Error al cargar agentes");
      return res.json();
    }
  });

  const agents = agentsData?.agents || [];

  const findAgent = (id: string) => agents.find(a => a.id === id);

  // 3. Sync matches mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en la sincronización");
      return data;
    },
    onSuccess: (data) => {
      setSuccess(`Sincronización completada: ${data.synced} partidos procesados.`);
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      if (data.synced > 0) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    },
    onError: (err: any) => {
      setError(err.message || "Error al sincronizar");
    }
  });

  const syncMatches = () => {
    syncMutation.mutate();
  };

  const syncing = syncMutation.isPending;
  const loading = matchesLoading;

  // Timed dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (matchesError) {
      setError((matchesError as Error).message || "Error al cargar partidos");
    }
  }, [matchesError]);

  useEffect(() => {
    if (matchDetailsError) {
      setError((matchDetailsError as Error).message || "Error al cargar detalles");
    }
  }, [matchDetailsError]);

  // Deep Link Handling
  useEffect(() => {
    if (deepLinkHandled || loading) return;
    const matchIdParam = searchParams.get("id");
    if (matchIdParam) {
      const matchId = Number(matchIdParam);
      const match = matches.find(m => m.id === matchId);
      if (match && !match.isHidden) {
        setSelected(match);
      } else if (!match) {
        // Fetch details and set active match
        fetch(`/api/matches?id=${matchId}`)
          .then(r => r.json())
          .then(data => {
            if (data.match) {
              setSelected(data.match as Match);
            }
          })
          .catch(err => {
            console.error("Error loading deep link match details", err);
          });
      }
      setDeepLinkHandled(true);
    }
  }, [matches, loading, deepLinkHandled, searchParams]);

  const loadMatch = (m: Match) => {
    if (m.isHidden) return;
    setSelected(m);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const winRate = useMemo(() => {
    if (matches.length === 0) return 0;
    const wins = matches.filter(m => (m.our_team_side === 'Blue' ? m.team_blue_won : !m.team_blue_won)).length;
    return Math.round((wins / matches.length) * 100);
  }, [matches]);

  const groupedEvents = useMemo(() => {
    interface EventGroup {
      id: string;
      event_id: number | null;
      title: string;
      type: string;
      date: string;
      time: string;
      dateObj: Date;
      matches: Match[];
    }

    const groups: EventGroup[] = [];
    const eventMap = new Map<number, EventGroup>();
    const independentMatches: Match[] = [];

    matches.forEach(m => {
      if (m.event) {
        if (!eventMap.has(m.event.id)) {
          const eventDate = new Date(`${m.event.date.replace(/-/g, "/")}T${m.event.time || "00:00"}`);
          const newGroup: EventGroup = {
            id: `event-${m.event.id}`,
            event_id: m.event.id,
            title: m.event.title,
            type: m.event.type,
            date: m.event.date,
            time: m.event.time,
            dateObj: eventDate,
            matches: []
          };
          groups.push(newGroup);
          eventMap.set(m.event.id, newGroup);
        }
        eventMap.get(m.event.id)!.matches.push(m);
      } else {
        independentMatches.push(m);
      }
    });

    // Ordenar los eventos reales por fecha descendente (más nuevos primero)
    groups.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Ordenar partidos dentro de cada evento por hora/comienzo de juego descendente
    groups.forEach(g => {
      g.matches.sort((a, b) => new Date(b.game_start).getTime() - new Date(a.game_start).getTime());
    });

    // Agrupar los partidos independientes por fecha (YYYY-MM-DD)
    const independentGroupsByDate = new Map<string, Match[]>();
    independentMatches.forEach(m => {
      const matchDateStr = m.game_start.split("T")[0];
      if (!independentGroupsByDate.has(matchDateStr)) {
        independentGroupsByDate.set(matchDateStr, []);
      }
      independentGroupsByDate.get(matchDateStr)!.push(m);
    });

    independentGroupsByDate.forEach((mList, dateStr) => {
      const dateObj = new Date(dateStr.replace(/-/g, "/"));
      groups.push({
        id: `independent-${dateStr}`,
        event_id: null,
        title: "Partidos Individuales",
        type: "individual",
        date: dateStr,
        time: "",
        dateObj,
        matches: mList.sort((a, b) => new Date(b.game_start).getTime() - new Date(a.game_start).getTime())
      });
    });

    // Ordenar la lista final de grupos (tanto eventos reales como grupos de fechas independientes) por fecha descendente
    groups.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    return groups;
  }, [matches]);

  const matchPoints = useMemo(() => {
    const pointsMap = new Map<number, { diff: number, total: number }>();
    if (!premierHistory.length || !matches.length) return pointsMap;
    
    matches.forEach(m => {
      const matchTime = new Date(m.game_start).getTime();
      let closest: any = null;
      let minDiff = Infinity;
      premierHistory.forEach(h => {
        const historyTime = new Date(h.started_at).getTime();
        const diff = Math.abs(historyTime - matchTime);
        if (diff < 5 * 60 * 60 * 1000 && diff < minDiff) {
           minDiff = diff;
           closest = h;
        }
      });
      if (closest) {
         pointsMap.set(m.id, { diff: closest.points_after - closest.points_before, total: closest.points_after });
      }
    });
    return pointsMap;
  }, [matches, premierHistory]);

  const isActiveSeason = !selectedSeason || selectedSeason === matchesData?.activeSeasonId;

  const displayPremierPoints = useMemo(() => {
    if (isActiveSeason) return currentPremierPoints;
    if (matches.length > 0) {
      const latestMatch = matches[0]; // matches are sorted newest first
      const points = matchPoints.get(latestMatch.id);
      if (points) return points.total;
    }
    return 0;
  }, [isActiveSeason, currentPremierPoints, matches, matchPoints]);

  const qualificationMatchId = useMemo(() => {
    let id: number | null = null;
    if (!matches || matches.length === 0) return null;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const pts = matchPoints.get(m.id);
      if (pts && pts.total >= 600) {
        id = m.id;
        break;
      }
    }
    return id;
  }, [matches, matchPoints]);

  const blueTeam = stats.filter(s => s.team_id === "Blue");
  const redTeam = stats.filter(s => s.team_id === "Red");

  const renderPlayerRow = (p: PlayerStat) => {
    const agent = findAgent(p.character_id);
    const acs = p.rounds_played > 0 ? Math.round(p.score / p.rounds_played) : 0;
    const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString();
    return (
      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <td style={{ padding: "12px 8px", display: "flex", alignItems: "center", gap: 12 }}>
          {agent && (
            <img src={agent.displayIcon} alt={agent.name} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[agent.role as AgentRole] || 'var(--val-red)'}` }} />
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
              <SeasonTab active={selectedSeason === "all"} label="Todas" onClick={() => setSelectedSeason("all")} />
              {seasons.map(s => (
                <SeasonTab 
                  key={s.id} 
                  active={selectedSeason === s.id || (selectedSeason === null && s.id === matchesData?.activeSeasonId)} 
                  label={s.name || s.id} 
                  onClick={() => setSelectedSeason(s.id)} 
                />
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
        {error && (
          <div 
            className="card animate-in" 
            style={{ 
              background: "rgba(255, 70, 85, 0.05)", 
              border: "1px solid rgba(255, 70, 85, 0.25)", 
              boxShadow: "0 8px 32px rgba(255, 70, 85, 0.05)",
              color: "var(--val-red)", 
              marginBottom: 20,
              padding: "16px 20px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              animation: "fadeIn 0.3s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              style={{ 
                background: "transparent", 
                border: "none", 
                color: "var(--val-red)", 
                cursor: "pointer", 
                padding: 4, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                opacity: 0.7,
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div 
            className="card animate-in" 
            style={{ 
              background: "rgba(0, 212, 170, 0.05)", 
              border: "1px solid rgba(0, 212, 170, 0.25)", 
              boxShadow: "0 8px 32px rgba(0, 212, 170, 0.05)",
              color: "var(--val-cyan)", 
              marginBottom: 20,
              padding: "16px 20px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              animation: "fadeIn 0.3s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{success}</span>
            </div>
            <button 
              onClick={() => setSuccess(null)}
              style={{ 
                background: "transparent", 
                border: "none", 
                color: "var(--val-cyan)", 
                cursor: "pointer", 
                padding: 4, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                opacity: 0.7,
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {!selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {loading && matches.length === 0 ? (
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 29, top: 20, bottom: 0, width: 2, background: "linear-gradient(to bottom, rgba(212,175,55,0.5), rgba(212,175,55,0.1))", zIndex: 0 }} />

                {/* Node: Playoffs (top) */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", opacity: 0.4 }}>
                  <div style={{ position: "absolute", left: 20, width: 20, height: 20, borderRadius: "50%", background: "var(--val-cyan)", border: "4px solid rgba(15,15,20,1)", zIndex: 10 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <Skeleton width={140} height={14} />
                    <Skeleton width={200} height={11} />
                  </div>
                </div>

                {/* Node: 600 PTS */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", opacity: 0.4 }}>
                  <div style={{ position: "absolute", left: 22, width: 16, height: 16, borderRadius: "50%", background: "rgba(15,15,20,1)", border: "4px solid var(--val-gold)", zIndex: 10 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Skeleton width={60} height={13} />
                    <Skeleton width={120} height={11} />
                  </div>
                </div>

                {/* Current points pill */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 20, width: 20, height: 20, borderRadius: "50%", background: "var(--val-gold)", border: "4px solid rgba(15,15,20,1)", zIndex: 10 }} />
                  <Skeleton width={140} height={36} style={{ borderRadius: 8 }} />
                </div>

                {/* Event group skeletons */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ position: "relative", paddingLeft: 80 }}>
                    {/* Match node on the line */}
                    <div style={{ position: "absolute", left: 23, top: 22, width: 13, height: 13, borderRadius: "50%", background: "rgba(133,107,77,0.8)", border: "3px solid rgba(15,15,20,1)", zIndex: 10 }} />
                    <div className="card glass-card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                      {/* Header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Skeleton width={90} height={18} style={{ borderRadius: 6 }} />
                            <Skeleton width={60} height={18} style={{ borderRadius: 6 }} />
                          </div>
                          <Skeleton width={160} height={13} />
                        </div>
                        <Skeleton width={100} height={13} />
                      </div>
                      {/* Match sub-cards */}
                      {Array.from({ length: 2 }).map((_, j) => (
                        <div key={j} className="card glass-card" style={{ padding: 16, borderLeft: "4px solid rgba(133,107,77,0.4)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <Skeleton width={110} height={18} />
                            <Skeleton width={75} height={11} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Skeleton width={36} height={36} style={{ borderRadius: 6 }} />
                            <Skeleton width={14} height={14} />
                            <Skeleton width={36} height={36} style={{ borderRadius: 6 }} />
                          </div>
                          <Skeleton width={70} height={22} style={{ borderRadius: 6 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Node: 0 PTS (bottom) */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", marginTop: 4 }}>
                  <div style={{ position: "absolute", left: 24, width: 12, height: 12, borderRadius: "50%", background: "rgba(15,15,20,1)", border: "3px solid rgba(255,255,255,0.2)", zIndex: 10 }} />
                  <Skeleton width={90} height={13} />
                </div>
              </div>
            ) : (
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ position: "absolute", left: 29, top: 20, bottom: 0, width: 2, zIndex: 0 }}>
                  <>
                    <div style={{ height: displayPremierPoints < 600 ? 100 : 60, borderLeft: "2px dashed rgba(255,255,255,0.2)" }} />
                    <div style={{ height: `calc(100% - ${displayPremierPoints < 600 ? 100 : 60}px)`, background: "linear-gradient(to bottom, var(--val-gold), rgba(212,175,55,0.2))", opacity: 0.5 }} />
                  </>
                </div>
                
                {/* Node: Playoffs Tournament */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", opacity: displayPremierPoints >= 600 ? 0.6 : 0.4 }}>
                  <div style={{ position: "absolute", left: 20, width: 20, height: 20, borderRadius: "50%", background: "var(--val-cyan)", border: "4px solid rgba(15,15,20,1)", boxShadow: displayPremierPoints >= 600 ? "0 0 10px rgba(0,212,170,0.5)" : "none", zIndex: 10 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ color: "var(--val-cyan)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>
                      Playoffs Premier
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                      Torneo de eliminación directa (8 equipos)
                    </div>
                  </div>
                </div>

                {/* Node: 600 PTS Qualification (only if not yet reached) */}
                {displayPremierPoints < 600 && (
                  <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", opacity: 0.4 }}>
                    <div style={{ position: "absolute", left: 22, width: 16, height: 16, borderRadius: "50%", background: "var(--bg-primary, rgba(15,15,20,1))", border: "4px solid var(--val-gold)", zIndex: 10 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ color: "var(--val-gold)", fontWeight: 800, fontSize: 13 }}>
                        600 PTS
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                        Clasificación a Playoffs
                      </div>
                    </div>
                  </div>
                )}

                {/* Premium Node with current premier points */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", zIndex: 5, margin: "12px 0" }}>
                  <div style={{ position: "absolute", left: 16, width: 28, height: 28, borderRadius: "50%", background: "rgba(212,175,55,0.15)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--val-gold)", border: "4px solid rgba(15,15,20,1)", boxShadow: "0 0 15px rgba(212,175,55,0.8)" }} />
                  </div>
                  
                  <div className="card glass-card hover-lift" style={{ width: "100%", padding: "20px 24px", border: "1px solid rgba(212,175,55,0.3)", background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 100%)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(212,175,55,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(212,175,55,0.3)", boxShadow: "inset 0 0 10px rgba(212,175,55,0.1)" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--val-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--val-gold)", textTransform: "uppercase", letterSpacing: 1 }}>Puntuación Actual</h3>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>{isActiveSeason ? "Temporada en curso" : "Temporada finalizada"}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 36, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-1px", textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>{displayPremierPoints}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--val-gold)" }}>PTS</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>0</span>
                        <span style={{ color: displayPremierPoints >= 600 ? "var(--val-cyan)" : "var(--text-muted)", fontWeight: 700 }}>
                          {displayPremierPoints >= 600 ? "¡Clasificados para Playoffs!" : `Faltan ${600 - displayPremierPoints} PTS para Playoffs`}
                        </span>
                        <span style={{ color: "var(--val-gold)" }}>600</span>
                      </div>
                      <div style={{ height: 10, background: "rgba(0,0,0,0.4)", borderRadius: 5, overflow: "hidden", position: "relative", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" }}>
                        <div style={{ 
                          position: "absolute", 
                          left: 0, top: 0, bottom: 0, 
                          width: `${Math.min(100, (displayPremierPoints / 600) * 100)}%`, 
                          background: displayPremierPoints >= 600 ? "var(--val-cyan)" : "linear-gradient(90deg, rgba(212,175,55,0.4), var(--val-gold))", 
                          borderRadius: 5,
                          boxShadow: "0 0 10px rgba(212,175,55,0.5)",
                          transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)"
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

                {groupedEvents.map(group => (
                  <div key={group.id} style={{ position: "relative", paddingLeft: 80 }}>
                    <EventGroupCard 
                      group={group} 
                      onMatchClick={(m: Match) => loadMatch(m)} 
                      matchPoints={matchPoints}
                      qualificationMatchId={qualificationMatchId}
                    />
                  </div>
                ))}

                {/* Node for starting season at 0 points */}
                <div style={{ position: "relative", paddingLeft: 80, display: "flex", alignItems: "center", marginTop: 8 }}>
                  <div style={{ position: "absolute", left: 24, width: 12, height: 12, borderRadius: "50%", background: "var(--bg-primary, rgba(15,15,20,1))", border: "3px solid rgba(255,255,255,0.2)", zIndex: 10 }} />
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                    0 PTS PREMIER
                  </div>
                </div>
              </div>
            )}
            {matches.length === 0 && !loading && (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState message="No hay partidos registrados para esta temporada." />
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in">
            <button className="btn btn-ghost" style={{ marginBottom: 20, paddingLeft: 0 }} onClick={() => setSelected(null)}>
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
                   <ScoreBlock 
                     label={selected.our_team_side === "Blue" ? (selected.team_blue_name || "Tu Equipo") : (selected.team_red_name || "Tu Equipo")} 
                     score={selected.our_team_side === "Blue" ? selected.team_blue_score : selected.team_red_score} 
                     color="var(--val-cyan)" 
                     win={selected.our_team_side === "Blue" ? selected.team_blue_won : !selected.team_blue_won} 
                   />
                   <div style={{ fontSize: 24, fontWeight: 200, color: "var(--text-muted)" }}>VS</div>
                   <ScoreBlock 
                     label={selected.our_team_side === "Blue" ? (selected.team_red_name || "Rival") : (selected.team_blue_name || "Rival")} 
                     score={selected.our_team_side === "Blue" ? selected.team_red_score : selected.team_blue_score} 
                     color="var(--val-red)" 
                     win={selected.our_team_side === "Blue" ? !selected.team_blue_won : selected.team_blue_won} 
                   />
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

interface EventGroup {
  id: string;
  event_id: number | null;
  title: string;
  type: string;
  date: string;
  time: string;
  matches: Match[];
}

function EventGroupCard({ group, onMatchClick, matchPoints, qualificationMatchId }: { group: EventGroup, onMatchClick: (m: Match) => void, matchPoints: Map<number, { diff: number, total: number }>, qualificationMatchId?: number | null }) {
  const getEventBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "match":
        return {
          label: "PARTIDO PREMIER",
          color: "var(--val-match)",
          bg: "rgba(133, 107, 77, 0.15)",
          border: "rgba(133, 107, 77, 0.3)",
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          )
        };
      case "practice":
        return {
          label: "ENTRENAMIENTO",
          color: "var(--val-practice)",
          bg: "rgba(184, 184, 184, 0.15)",
          border: "rgba(184, 184, 184, 0.3)",
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 10v6M2 10v6M4 10h16M12 4v16" />
            </svg>
          )
        };
      case "playoffs":
        return {
          label: "PLAYOFFS",
          color: "rgba(168, 85, 247, 0.95)",
          bg: "rgba(168, 85, 247, 0.08)",
          border: "rgba(168, 85, 247, 0.25)",
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )
        };
      default:
        return {
          label: "PARTIDO INDIVIDUAL",
          color: "rgba(255, 255, 255, 0.6)",
          bg: "rgba(255, 255, 255, 0.03)",
          border: "rgba(255, 255, 255, 0.1)",
          icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )
        };
    }
  };

  const badge = getEventBadge(group.type);
  
  // Parse event date and time as a UTC timestamp to show them in browser local time
  const eventDateObj = new Date(`${group.date}T${group.time || "00:00"}:00Z`);

  const formattedEventDate = eventDateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const formattedEventTime = group.time ? eventDateObj.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }) : "";

  // Check if this is a standard system event (redundant default title)
  const isDefaultTitle = 
    group.type === "match" || 
    group.type === "practice" || 
    group.type === "playoffs" || 
    group.type === "individual";

  return (
    <div 
      className="card glass-card animate-in" 
      style={{ 
        padding: "24px", 
        border: "1px solid rgba(255, 255, 255, 0.05)",
        background: "rgba(15, 15, 20, 0.35)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        display: "flex", 
        flexDirection: "column", 
        gap: 16,
        borderRadius: "16px",
        position: "relative",
        // overflow: "hidden" // Removed to allow absolute dots to escape
      }}
    >
      <div 
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          background: badge.color,
          filter: "blur(60px)",
          opacity: 0.08,
          pointerEvents: "none"
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span 
              style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: 6, 
                fontSize: 10, 
                fontWeight: 900, 
                color: badge.color, 
                background: badge.bg, 
                border: `1px solid ${badge.border}`,
                padding: "4px 10px", 
                borderRadius: "9999px",
                letterSpacing: 1
              }}
            >
              {badge.icon}
              {badge.label}
            </span>
            {formattedEventTime && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                {formattedEventTime} HS
              </span>
            )}
          </div>
          {!isDefaultTitle && (
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginTop: 4 }}>
              {group.title}
            </h3>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, textTransform: "capitalize" }}>
          {formattedEventDate}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {group.matches.map(m => (
          <React.Fragment key={m.id}>
            {m.id === qualificationMatchId && (
              <div style={{ position: "relative", margin: "8px 0" }}>
                <div style={{ position: "absolute", left: -82, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", zIndex: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--bg-primary, rgba(15,15,20,1))", border: "4px solid var(--val-gold)" }} />
                </div>
                <div className="card glass-card hover-lift" style={{ cursor: "default", padding: "12px 16px", borderLeft: "4px solid var(--val-gold)", background: "rgba(212,175,55,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "var(--val-gold)", fontWeight: 900, fontSize: 14 }}>600 PTS</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>¡Clasificación a Playoffs lograda!</div>
                </div>
              </div>
            )}
            <MatchCard match={m} onClick={() => onMatchClick(m)} points={matchPoints?.get(m.id)} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, onClick, points }: { match: Match, onClick: () => void, points?: { diff: number, total: number } }) {
  if (match.isHidden) {
    return (
      <div 
        className="card glass-card" 
        style={{ 
          padding: "20px 24px", 
          borderLeft: "4px solid rgba(255, 255, 255, 0.15)", 
          background: "rgba(20, 20, 26, 0.4)",
          opacity: 0.85,
          cursor: "default"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 12, 
              background: "rgba(255, 255, 255, 0.03)", 
              border: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center" 
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 70, 85, 0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                Partido Oculto
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {new Date(match.game_start).toLocaleDateString("es-ES", { 
                  day: "2-digit", 
                  month: "short", 
                  year: "numeric", 
                  hour: "2-digit", 
                  minute: "2-digit" 
                })}
              </div>
            </div>
          </div>
          <div className="tag" style={{ height: "fit-content", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 10, fontWeight: 800 }}>
            PRIVADO
          </div>
        </div>

        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginTop: 20, 
          paddingTop: 16, 
          borderTop: "1px solid rgba(255, 255, 255, 0.03)" 
        }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>Motivo: </span>
            <span style={{ color: "rgba(255, 255, 255, 0.7)", fontWeight: 600 }}>{match.reason || "Falta de consentimiento de datos"}</span>
          </div>
          <Link 
            href="/profile" 
            style={{ 
              fontSize: 12, 
              color: "var(--val-cyan)", 
              fontWeight: 800, 
              textDecoration: "none", 
              display: "flex", 
              alignItems: "center", 
              gap: 4,
              transition: "color 0.2s" 
            }}
            className="hover-cyan"
          >
            Configurar Perfil
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  const isWin = match.team_blue_won === (match.our_team_side === 'Blue');
  const enemyTeamName = match.our_team_side === 'Blue' ? (match.team_red_name || "Rival") : (match.team_blue_name || "Rival");

  return (
    <div style={{ position: "relative" }}>
      {/* Timeline Node - precisely aligned with the vertical line at left: 29 */}
      <div style={{ 
        position: "absolute", 
        left: -80, 
        top: "50%", 
        transform: "translateY(-50%)", 
        display: "flex", 
        alignItems: "center",
        zIndex: 10
      }}>
        <div style={{ 
          width: 12, height: 12, borderRadius: "50%", 
          background: "var(--bg-primary, rgba(15,15,20,1))", 
          border: `3px solid ${isWin ? 'var(--val-cyan)' : 'var(--val-red)'}`,
          boxShadow: `0 0 10px ${isWin ? 'rgba(0, 212, 170, 0.4)' : 'rgba(255, 70, 85, 0.4)'}`
        }} />
        {points && (
           <div style={{ 
             position: "absolute",
             left: "100%",
             marginLeft: 8,
             fontSize: 10, 
             fontWeight: 800, 
             color: "var(--text-primary)", 
             display: "flex", 
             flexDirection: "column", 
             gap: 2,
             whiteSpace: "nowrap"
           }}>
              <span style={{ color: "var(--val-gold)" }}>{points.total} PTS</span>
              <span style={{ color: points.diff > 0 ? "var(--val-cyan)" : "var(--val-red)", fontSize: 9 }}>
                {points.diff > 0 ? `+${points.diff}` : points.diff}
              </span>
           </div>
        )}
      </div>

      <div 
        className="card glass-card hover-lift" 
        onClick={onClick} 
        style={{ 
          cursor: "pointer", 
          padding: 20, 
          borderLeft: `4px solid ${isWin ? 'var(--val-cyan)' : 'var(--val-red)'}`,
          '--hover-color': isWin ? 'var(--val-cyan)' : 'var(--val-red)',
          '--hover-glow-color': isWin ? 'rgba(0, 212, 170, 0.15)' : 'rgba(255, 70, 85, 0.15)'
        } as CSSProperties}
      >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
           <div style={{ fontWeight: 800, fontSize: 18 }}>{match.map_name}</div>
           <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
             <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>VS</span> {enemyTeamName}
           </div>
           <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
             {new Date(match.game_start).toLocaleDateString("es-ES", {
               day: "2-digit",
               month: "short",
               year: "numeric"
             })}
             {" • "}
             {new Date(match.game_start).toLocaleTimeString("es-ES", {
               hour: "2-digit",
               minute: "2-digit"
             })}
           </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={`tag ${isWin ? 'tag-green' : 'tag-red'}`} style={{ height: "fit-content" }}>
            {isWin ? 'VICTORIA' : 'DERROTA'}
          </div>
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
