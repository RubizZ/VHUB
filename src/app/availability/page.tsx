"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";


interface Player { id: number; name: string; avatar_color: string; }
interface LinkedMatch {
  id: number; riot_match_id: string; map_name: string;
  game_start: string; game_length_ms: number;
  team_blue_score: number; team_red_score: number; team_blue_won: boolean;
  queue_id: string;
  our_team_side?: "Blue" | "Red";
}
interface Ev { 
  id: number; title: string; type: string; date: string; time: string; 
  end_date?: string; end_time?: string;
  description: string; map: string; status: string; 
  localDate?: string; localTime?: string; 
  localEndDate?: string; localEndTime?: string;
  linkedMatches?: LinkedMatch[]; 
}
interface Avail { player_id: number; player_name: string; status: string; avatar_color: string; }

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [avail, setAvail] = useState<Record<number, Avail[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", type: "custom", date: "", time: "19:00", description: "", map: "" });
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const [maps, setMaps] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [scrollToEventId, setScrollToEventId] = useState<number | null>(null);

  const myPlayerId = (session?.user as any)?.playerId;
  const firstUpcomingRef = useRef<HTMLDivElement>(null);
  const eventRefsMap = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch("/api/maps").then(r => r.json()).then(d => setMaps(d.maps || []));
    
    const saved = localStorage.getItem("vhub_avail_view_mode");
    if (saved === "list" || saved === "calendar") setViewMode(saved);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("vhub_avail_view_mode", viewMode);
    }
  }, [viewMode, isMounted]);

  useEffect(() => {
    loadEvents(selectedSeason);
  }, [selectedSeason]);

  useEffect(() => {
    if (viewMode === "list" && isMounted && events.length > 0 && players.length > 0) {
      // Prioridad 1: scroll a evento específico (clic desde calendario)
      if (scrollToEventId !== null) {
        setTimeout(() => {
          const targetEl = eventRefsMap.current[scrollToEventId];
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          setScrollToEventId(null);
        }, 300);
        return;
      }
      // Prioridad 2: scroll inicial al primer evento próximo
      if (firstUpcomingRef.current && !hasInitialScrolled) {
        setTimeout(() => {
          if (!scrollToEventId && firstUpcomingRef.current) {
            firstUpcomingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          setHasInitialScrolled(true);
        }, 300);
      }
    }
  }, [viewMode, isMounted, events, hasInitialScrolled, scrollToEventId, players, avail]);

  const loadEvents = async (seasonId?: string | null) => {
    try {
      setError(null);
      const url = (seasonId !== null && seasonId !== undefined) ? `/api/events?season=${encodeURIComponent(seasonId)}` : "/api/events";
      const res = await fetch(url);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await res.json();
      
      if (d.seasons) setSeasons(d.seasons);
      if (d.activeSeasonId && seasonId === null && selectedSeason === null) {
        setSelectedSeason(d.activeSeasonId);
      }
      if (!res.ok) throw new Error(d.error || `Events API failed: ${res.status}`);
      
      const loadedEvents: Ev[] = (d.events || []).map((ev: any) => {
        // ev.date (YYYY-MM-DD) y ev.time (HH:mm) están en UTC 0
        const utcDate = new Date(`${ev.date}T${ev.time}:00Z`);
        let localEndDate = undefined;
        let localEndTime = undefined;
        if (ev.end_date && ev.end_time) {
          const utcEnd = new Date(`${ev.end_date}T${ev.end_time}:00Z`);
          localEndDate = formatDateLocal(utcEnd);
          localEndTime = utcEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        return {
          ...ev,
          localDate: formatDateLocal(utcDate),
          localTime: utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          localEndDate,
          localEndTime
        };
      });
      
      setEvents(loadedEvents);
      
      const availMap: Record<number, Avail[]> = {};
      loadedEvents.forEach((ev: any) => {
        availMap[ev.id] = (ev.availability || []).map((a: any) => ({
          player_id: a.player_id,
          player_name: a.player?.name || "Desconocido",
          status: a.status,
          avatar_color: a.player?.avatar_color || "#999"
        }));
      });
      setAvail(availMap);
    } catch (err: any) {
      console.error("Error cargando eventos:", err);
      setError(err.message);
    }
  };

  const createEvent = async () => {
    // Cuando creamos manualmente, el input type="date" y "time" son locales.
    // Para guardarlos en UTC 0 como quiere el usuario:
    const localDate = new Date(`${form.date}T${form.time}:00`);
    const utcDateStr = localDate.toISOString().split('T')[0];
    const utcTimeStr = localDate.getUTCHours().toString().padStart(2, '0') + ":" + localDate.getUTCMinutes().toString().padStart(2, '0');

    const res = await fetch("/api/events", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({
        ...form,
        date: utcDateStr,
        time: utcTimeStr
      }) 
    });
    
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear evento");
      return;
    }
    setShowNew(false);
    setForm({ title: "", type: "custom", date: "", time: "19:00", description: "", map: "" });
    loadEvents();
  };

  const setAvailability = async (eventId: number, status: string) => {
    if (!myPlayerId) {
      alert("No estás vinculado a ningún jugador. Contacta con tu administrador.");
      return;
    }
    
    try {
      const res = await fetch("/api/availability", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ event_id: eventId, player_id: myPlayerId, status }) 
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al actualizar disponibilidad");
      }
      
      loadEvents();
    } catch (err: any) {
      console.error("Error al marcar disponibilidad:", err);
      alert(err.message);
    }
  };

  const deleteEvent = async (id: number) => {
    await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    loadEvents();
  };

  const statusIcon = (s: string) => s === "available" ? "✅" : s === "maybe" ? "⚠️" : s === "unavailable" ? "❌" : "⏳";
  
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDateLocal(new Date());
  const upcoming = events.filter(e => (e as any).localDate >= todayStr);
  const past = events.filter(e => (e as any).localDate < todayStr);

  const canManage = (session?.user as any)?.role === "team_admin" || (session?.user as any)?.role === "super_admin";

  const { dayNames, days, monthLabel } = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const monthLabel = currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    
    let startDayOffset = startOfMonth.getDay(); 
    if (startDayOffset === 0) startDayOffset = 7;
    startDayOffset -= 1;
    
    const days: any[] = [];
    const todayStr = formatDateLocal(new Date());

    for (let i = 0; i < startDayOffset; i++) days.push({ empty: true });
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const dateStr = formatDateLocal(d);
      const isToday = isMounted && dateStr === todayStr;
      days.push({ day: i, date: dateStr, isToday, events: events.filter(e => (e as any).localDate === dateStr) });
    }
    return { dayNames, days, monthLabel };
  }, [events, isMounted, currentDate]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h2>📅 Disponibilidad</h2>
            <p>Gestiona eventos y confirma asistencia</p>
          </div>
          <div style={{ display: "flex", background: "var(--bg-secondary)", padding: 4, borderRadius: 10, border: "1px solid var(--border-color)" }}>
            <button 
              className={`btn btn-sm ${viewMode === "calendar" ? "btn-primary" : "btn-ghost"}`} 
              onClick={() => setViewMode("calendar")}
              style={{ borderRadius: 8 }}
            >
              Calendario
            </button>
            <button 
              className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} 
              onClick={() => setViewMode("list")}
              style={{ borderRadius: 8 }}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      <div className="page-content animate-in">
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nuevo Evento</button>
            )}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Temporada:</span>
            <select
              className="card"
              style={{ padding: "6px 12px", background: "var(--card-bg)", color: "white", border: "1px solid var(--border-color)", borderRadius: 4 }}
              value={selectedSeason || ""}
              onChange={(e) => setSelectedSeason(e.target.value || "")}
            >
              <option value="">Todas las temporadas</option>
              {seasons.map(s => (
                <option key={s} value={s}>{s.substring(0, 8)}...</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-4" style={{ background: "rgba(255, 70, 85, 0.1)", border: "1px solid var(--val-red)", color: "var(--val-red)", padding: 12, borderRadius: 8, marginBottom: 20 }}>
             ⚠️ {error}
          </div>
        )}

        {viewMode === "calendar" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>◀</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(1)}>▶</button>
              </div>
            </div>
            <div className="calendar-grid">
            {dayNames.map(name => <div key={name} className="calendar-day-name">{name}</div>)}
            {days.map((d, i) => (
              <div key={i} className={`calendar-day ${d.empty ? "empty" : ""} ${d.isToday ? "today" : ""}`}>
                {!d.empty && (
                  <>
                    <span className="calendar-day-num">{d.day}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                      {d.events.map((ev: any) => {
                        const ea = avail[ev.id] || [];
                        const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
                        const isCancelled = ev.status === 'cancelled';
                        const unavailable = ea.filter(a => a.status === "unavailable").length;
                        const isImpossible = (ev as any).localDate >= todayStr && (players.length - unavailable < 5);
                        
                        return (
                          <div 
                            key={ev.id} 
                            className={`calendar-event-item ${isCancelled ? 'calendar-event-cancelled' : isImpossible ? 'calendar-event-impossible' : ev.type === "match" ? "calendar-event-match" : ev.type === "playoffs" ? "calendar-event-playoffs" : "calendar-event-practice"} calendar-event-${myStatus}`}
                            title={`${ev.localTime} - ${ev.title} (${isCancelled ? 'Cancelado' : isImpossible ? 'Falta de asistencia' : `Tu estado: ${myStatus}`})`}
                            onClick={() => { setScrollToEventId(ev.id); setViewMode("list"); }} 
                            style={(isCancelled || isImpossible) ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
                          >
                            {ev.localTime} {ev.title}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          </>
        ) : (
          <div className="events-list-container">
            {events.length === 0 && <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>No hay eventos.</p>}
            {events.map((ev, idx) => {
              const isPast = isMounted && (ev as any).localDate < todayStr;
              const isCancelled = ev.status === 'cancelled';
              
              const ea = avail[ev.id] || [];
              const confirmed = ea.filter(a => a.status === "available").length;
              const maybeCount = ea.filter(a => a.status === "maybe").length;
              const unavailable = ea.filter(a => a.status === "unavailable").length;
              const isImpossible = isMounted && !isPast && players.length >= 5 && (players.length - unavailable < 5);
              const isConfirmed = confirmed >= 5;

              // Un evento es "válido para ser el próximo" si no es pasado, ni cancelado, ni imposible por falta de gente
              const isViableUpcoming = isMounted && !isPast && !isCancelled && !isImpossible;
              const isFirstUpcoming = isViableUpcoming && (idx === 0 || events.slice(0, idx).every(prev => {
                const prevEA = avail[prev.id] || [];
                const prevUnavail = prevEA.filter(a => a.status === "unavailable").length;
                const prevIsPast = isMounted && (prev as any).localDate < todayStr;
                const prevIsImpossible = isMounted && !prevIsPast && players.length >= 5 && (players.length - prevUnavail < 5);
                return prevIsPast || prev.status === 'cancelled' || prevIsImpossible;
              }));
              
              const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
              const matches = ev.linkedMatches || [];
              
              return (
                <React.Fragment key={ev.id}>
                  {isFirstUpcoming && (
                    <div style={{ 
                      display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px 0", 
                      color: "var(--val-cyan)", fontSize: 12, fontWeight: 800, letterSpacing: 2 
                    }}>
                      <div style={{ flex: 1, height: 1, borderTop: "1px dashed rgba(0, 212, 170, 0.3)" }} />
                      <span>HOY · {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" }).toUpperCase()}</span>
                      <div style={{ flex: 1, height: 1, borderTop: "1px dashed rgba(0, 212, 170, 0.3)" }} />
                    </div>
                  )}
                  <div 
                    ref={(el) => { eventRefsMap.current[ev.id] = el; if (isFirstUpcoming) (firstUpcomingRef as any).current = el; }}
                    className="card" 
                    style={{ 
                      marginBottom: 12, 
                      opacity: isPast || isCancelled || isImpossible ? 0.5 : 1,
                      borderLeft: isFirstUpcoming ? "4px solid var(--val-cyan)" : (isCancelled || isImpossible) ? "4px solid var(--val-red)" : isConfirmed ? "4px solid var(--val-cyan)" : undefined,
                      transition: "opacity 0.3s ease",
                      scrollMarginTop: "100px"
                    }}
                  >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, textDecoration: (isCancelled || isImpossible) ? 'line-through' : undefined, color: (isCancelled || isImpossible) ? 'var(--text-muted)' : undefined }}>{ev.title}</h3>
                        <span className={`tag ${ev.type === "match" ? "tag-red" : ev.type === "playoffs" ? "tag-gold" : "tag-green"}`}>{ev.type === "match" ? "Partido" : ev.type === "playoffs" ? "Playoffs" : "Práctica"}</span>
                        {isCancelled && <span className="tag" style={{ background: "rgba(255, 70, 85, 0.15)", color: "var(--val-red)", fontWeight: 700 }}>Cancelado</span>}
                        {isImpossible && <span className="tag" style={{ background: "rgba(255, 70, 85, 0.15)", color: "var(--val-red)", fontWeight: 700 }}>Sin suficientes jugadores</span>}
                        {isConfirmed && !isPast && <span className="tag tag-cyan" style={{ fontWeight: 700 }}>¡Confirmado para jugar!</span>}
                        {isPast && !isCancelled && !isImpossible && <span className="tag" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>Pasado</span>}
                        {isFirstUpcoming && <span className="tag tag-cyan" style={{ fontSize: 10 }}>PRÓXIMO</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                        📅 {new Date(`${ev.date}T${ev.time}:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · ⏰ {ev.localTime}
                        {ev.localEndTime && <> - {ev.localEndTime}</>}
                        {ev.map && <> · 🗺️ {maps.find(m => m.id === ev.map)?.name || ev.map}</>}
                      </div>
                      {ev.description && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{ev.description}</div>}
                      {isCancelled && <div style={{ fontSize: 12, color: "var(--val-red)", marginTop: 4, fontStyle: 'italic' }}>Ya se jugaron 2 partidos esta semana</div>}
                      {isImpossible && <div style={{ fontSize: 12, color: "var(--val-red)", marginTop: 4, fontStyle: 'italic' }}>No hay suficientes jugadores disponibles para alcanzar el mínimo de 5</div>}
                    </div>
                    {canManage && ev.type === "custom" && <button className="btn btn-ghost btn-sm" onClick={() => deleteEvent(ev.id)}>🗑️</button>}
                  </div>

                  {/* Resumen de partidos vinculados */}
                  {matches.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>🏆 Partidos jugados ({matches.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {matches.map((m: LinkedMatch) => {
                          const duration = Math.floor(m.game_length_ms / 60000);
                          return (
                            <div 
                              key={m.id} 
                              onClick={() => router.push(`/matches?id=${m.id}`)}
                              style={{ 
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)",
                                transition: "all 0.2s ease"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'var(--val-cyan)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>🗺️ {m.map_name}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ 
                                    fontSize: 16, fontWeight: 800, 
                                    color: (m.our_team_side === "Blue" ? m.team_blue_won : !m.team_blue_won) ? "var(--val-cyan)" : "var(--text-muted)" 
                                  }}>
                                    {m.our_team_side === "Blue" ? m.team_blue_score : m.team_red_score}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs</span>
                                  <span style={{ 
                                    fontSize: 16, fontWeight: 800, 
                                    color: (m.our_team_side === "Blue" ? !m.team_blue_won : m.team_blue_won) ? "var(--val-red)" : "var(--text-muted)" 
                                  }}>
                                    {m.our_team_side === "Blue" ? m.team_red_score : m.team_blue_score}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{duration}min</span>
                                <span style={{ fontSize: 11, color: "var(--val-cyan)" }}>Ver detalles →</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isCancelled && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-fill progress-fill-cyan" style={{ width: `${Math.min((confirmed / 5) * 100, 100)}%` }} />
                          <div className="progress-fill-maybe" style={{ width: `${Math.min((maybeCount / 5) * 100, Math.max(0, 100 - (confirmed / 5) * 100))}%` }} />
                        </div>
                        <span style={{ fontSize: 13, color: confirmed >= 5 ? "var(--val-cyan)" : "var(--text-secondary)", fontWeight: 600 }}>{confirmed}/5</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {players.map(p => {
                          const ps = ea.find(a => a.player_id === p.id)?.status || "pending";
                          return (
                            <div key={p.id} className={`avail-cell avail-${ps}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }}>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.name[0]}</div>
                              <span style={{ fontSize: 12 }}>{p.name}</span>
                              <span>{statusIcon(ps)}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {myPlayerId ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4, alignSelf: "center" }}>Tu respuesta:</span>
                          {["available", "maybe", "unavailable"].map(s => (
                            <button key={s} className={`btn btn-sm ${myStatus === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setAvailability(ev.id, s)}>
                              {statusIcon(s)} {s === "available" ? "Disponible" : s === "maybe" ? "Quizás" : "No puedo"}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--val-red)", marginTop: 8 }}>
                          Debes pertenecer a la plantilla (Roster) para poder confirmar asistencia.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          </div>
        )}


        {showNew && (
          <div className="modal-overlay" onClick={() => setShowNew(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Nuevo Evento</h3>
              <div className="form-group"><label>Título</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Premier Semana 3" /></div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}><label>Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="custom">Personalizado (Custom)</option></select></div>
                <div className="form-group" style={{ flex: 1 }}><label>Mapa</label><select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}><option value="">Sin definir</option>{maps.filter(m => m.tacticalDescription).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}><label>Fecha</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Hora</label><input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Opcional..." /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={createEvent}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
