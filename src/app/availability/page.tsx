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
  const [viewMode, setViewMode] = useState<"list" | "calendar" | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const [maps, setMaps] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [scrollToEventId, setScrollToEventId] = useState<number | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<number | null>(null);

  const myPlayerId = (session?.user as any)?.playerId;
  const firstUpcomingRef = useRef<HTMLDivElement>(null);
  const eventRefsMap = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch("/api/maps").then(r => r.json()).then(d => setMaps(d.maps || []));

    const saved = localStorage.getItem("vhub_avail_view_mode");
    if (saved === "list" || saved === "calendar") {
      setViewMode(saved as "list" | "calendar");
    } else {
      setViewMode("calendar");
    }
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
      setUpdatingEventId(eventId);
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, player_id: myPlayerId, status })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al actualizar disponibilidad");
      }

      await loadEvents();
      setTimeout(() => setUpdatingEventId(null), 1000);
    } catch (err: any) {
      console.error("Error al marcar disponibilidad:", err);
      alert(err.message);
      setUpdatingEventId(null);
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
    <div className="availability-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Agenda y Disponibilidad</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Planifica tus sesiones y confirma tu asistencia</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="glass-card" style={{ display: "flex", padding: 4, borderRadius: 10 }}>
              <button
                className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setViewMode("calendar"); setHasInitialScrolled(false); }}
                style={{ borderRadius: 8 }}
              >
                📅 Calendario
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setViewMode("list"); setHasInitialScrolled(false); }}
                style={{ borderRadius: 8 }}
              >
                📋 Lista
              </button>
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                + Nuevo Evento
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, overflowX: "auto", paddingBottom: 4 }}>
          <SeasonTab active={selectedSeason === null} label="Todas las Temporadas" onClick={() => setSelectedSeason(null)} />
          {seasons.map(s => (
            <SeasonTab key={s} active={selectedSeason === s} label={`Temporada ${s.substring(0, 8)}...`} onClick={() => setSelectedSeason(s)} />
          ))}
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0, minHeight: '60vh' }}>
        {error && <div className="card" style={{ background: "rgba(255, 70, 85, 0.1)", border: "1px solid var(--val-red)", color: "var(--val-red)", marginBottom: 20, padding: 12, borderRadius: 8 }}>⚠️ {error}</div>}

        {viewMode === null ? (
          <div className="animate-fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "40vh", color: "var(--text-muted)" }}>
            <div className="animate-pulse">Cargando agenda...</div>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="card glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>{monthLabel}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>◀</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(1)}>▶</button>
              </div>
            </div>
            <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "rgba(255,255,255,0.01)" }}>
              {dayNames.map(name => (
                <div key={name} style={{ padding: "12px 0", textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{name}</div>
              ))}
              {days.map((d, i) => (
                <div key={i} className={`animate-scale-in`} style={{
                  height: 120, padding: 10, borderRight: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)",
                  background: d.empty ? "rgba(0,0,0,0.1)" : d.isToday ? "rgba(255,70,85,0.02)" : "transparent",
                  position: "relative",
                  animationDelay: `${(i % 7) * 0.05}s`
                }}>
                  {!d.empty && (
                    <>
                      <span style={{
                        fontSize: 12, fontWeight: d.isToday ? 800 : 500, color: d.isToday ? "var(--val-red)" : "var(--text-primary)",
                        background: d.isToday ? "rgba(255,70,85,0.1)" : "transparent",
                        width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center"
                      }}>{d.day}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {d.events.map((ev: any) => {
                          const ea = avail[ev.id] || [];
                          const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
                          const isCancelled = ev.status === 'cancelled';
                          const unavailable = ea.filter(a => a.status === "unavailable").length;
                          const isImpossible = isMounted && (ev as any).localDate >= todayStr && (unavailable > 2);
                          const evColor = isCancelled ? 'rgba(255,255,255,0.1)' : isImpossible ? "var(--val-red)" : ev.type === "playoffs" ? "var(--val-yellow)" : ev.type === "match" ? "var(--val-red)" : "var(--val-cyan)";
                          const evColorDark = isCancelled ? 'rgba(0,0,0,0.2)' : isImpossible ? "var(--val-red-dark)" : ev.type === "playoffs" ? "var(--val-yellow-dark)" : ev.type === "match" ? "var(--val-red-dark)" : "#008a6e";

                          return (
                            <div
                              key={ev.id}
                              onClick={() => { setScrollToEventId(ev.id); setViewMode("list"); }}
                              style={{
                                fontSize: 10, padding: "4px 6px", borderRadius: 4,
                                background: myStatus === 'maybe'
                                  ? `repeating-linear-gradient(45deg, ${evColor}, ${evColor} 6px, ${evColorDark} 6px, ${evColorDark} 12px)`
                                  : evColor,
                                color: isCancelled ? 'var(--text-muted)' : "white",
                                fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer",
                                textDecoration: (isCancelled || isImpossible || myStatus === 'unavailable') ? 'line-through' : 'none',
                                opacity: (isCancelled || isImpossible || myStatus === 'unavailable') ? 0.5 : myStatus === 'pending' ? 0.8 : 1,
                                border: myStatus === 'pending' ? '1px dashed rgba(255,255,255,0.3)' : '1px solid transparent'
                              }}
                              title={`${ev.localTime} - ${ev.title}`}
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
          </div>
        ) : (
          <div className="events-list-container" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {events.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>No hay eventos programados.</p>}
            {events.map((ev, idx) => {
              const isPast = isMounted && (ev as any).localDate < todayStr;
              const isCancelled = ev.status === 'cancelled';
              const ea = avail[ev.id] || [];
              const confirmed = ea.filter(a => a.status === "available").length;
              const maybeCount = ea.filter(a => a.status === "maybe").length;
              const unavailable = ea.filter(a => a.status === "unavailable").length;
              const isImpossible = isMounted && !isPast && (unavailable > 2);
              const isConfirmed = confirmed >= 5;

              // Logic for day grouping (visual only)
              const prevEv = idx > 0 ? events[idx - 1] : null;
              const showDayHeader = !prevEv || prevEv.date !== ev.date;
              const isToday = (ev as any).localDate === todayStr;

              // Original logic for "PRÓXIMO" tag
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
                <div key={ev.id}>
                  {showDayHeader && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{
                        padding: "8px 16px", borderRadius: 12, background: isToday ? "var(--val-red)" : "rgba(255,255,255,0.05)",
                        color: isToday ? "white" : "var(--text-primary)", fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: 1,
                        boxShadow: isToday ? "0 0 15px var(--val-red-glow)" : "none"
                      }}>
                        {new Date(`${ev.date}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                        {isToday && <span style={{ marginLeft: 8, opacity: 0.8 }}>(HOY)</span>}
                      </div>
                      <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
                    </div>
                  )}

                  <div
                    ref={(el) => { eventRefsMap.current[ev.id] = el; if (isFirstUpcoming) (firstUpcomingRef as any).current = el; }}
                    className={`card glass-card animate-in ${isPast || isCancelled || isImpossible ? '' : 'hover-lift'}`}
                    style={{
                      marginBottom: 12,
                      opacity: isPast || isCancelled || isImpossible ? 0.6 : 1,
                      borderLeft: `4px solid ${isCancelled || isImpossible ? 'var(--val-red)' : isFirstUpcoming ? 'var(--val-cyan)' : isConfirmed ? 'var(--val-cyan)' : 'var(--border-color)'}`,
                      scrollMarginTop: "100px",
                      animationDelay: `${Math.min(idx, 5) * 0.1}s`
                    }}
                  >
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 300px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <span className={`tag ${ev.type === "match" ? "tag-red" : ev.type === "playoffs" ? "tag-gold" : "tag-green"}`}>
                            {ev.type === "match" ? "Partido" : ev.type === "playoffs" ? "Playoffs" : "Práctica"}
                          </span>
                          <h3 style={{ fontSize: 18, fontWeight: 700, textDecoration: (isCancelled || isImpossible) ? 'line-through' : undefined }}>{ev.title}</h3>
                          {isFirstUpcoming && <span className="tag tag-cyan" style={{ fontSize: 10, fontWeight: 800 }}>PRÓXIMO</span>}
                          {isCancelled && <span className="tag tag-red">Cancelado</span>}
                          {isImpossible && <span className="tag tag-red">Sin asistencia</span>}
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "var(--text-secondary)", fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            {ev.localTime} {ev.localEndTime && `— ${ev.localEndTime}`}
                          </div>
                          {ev.map && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                              {maps.find(m => m.id === ev.map)?.name || ev.map}
                            </div>
                          )}
                        </div>

                        {ev.description && <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{ev.description}</p>}
                        {isCancelled && <div style={{ fontSize: 12, color: "var(--val-red)", marginTop: 8 }}>⚠️ Ya se jugaron 2 partidos esta semana.</div>}
                        {isImpossible && <div style={{ fontSize: 12, color: "var(--val-red)", marginTop: 8 }}>⚠️ No hay suficientes jugadores (mínimo 5).</div>}

                        {/* Linked Matches */}
                        {matches.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Partidos Jugados</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {matches.map((m: LinkedMatch) => {
                                const ourWin = (m.our_team_side === "Blue" ? m.team_blue_won : !m.team_blue_won);
                                return (
                                  <div
                                    key={m.id}
                                    onClick={() => router.push(`/matches?id=${m.id}`)}
                                    className="glass-card"
                                    style={{
                                      display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8,
                                      background: "rgba(255,255,255,0.02)", cursor: "pointer", border: `1px solid ${ourWin ? 'rgba(0,212,170,0.2)' : 'rgba(255,70,85,0.2)'}`
                                    }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 4, background: ourWin ? "var(--val-cyan)" : "var(--val-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "white" }}>{ourWin ? "W" : "L"}</div>
                                    <div style={{ flex: 1, fontSize: 12 }}><span style={{ fontWeight: 700 }}>{m.map_name}</span> <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{m.team_blue_score} - {m.team_red_score}</span></div>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>ANALÍTICA →</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", gap: 16 }}>
                        <div className="glass-card" style={{ background: "rgba(255,255,255,0.01)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Asistencia</span>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div className={`progress-bar ${updatingEventId === ev.id ? 'animate-pulse' : ''}`} style={{ width: 120, height: 10 }}>
                                <div className="progress-fill progress-fill-cyan transition-smooth" style={{ width: `${Math.min((confirmed / 5) * 100, 100)}%` }} />
                                <div className="progress-fill progress-fill-maybe transition-smooth" style={{ width: `${Math.min((maybeCount / 5) * 100, Math.max(0, 100 - (confirmed / 5) * 100))}%` }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: confirmed >= 5 ? "var(--val-cyan)" : "var(--text-secondary)" }}>{confirmed}/5</span>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 12 }}>
                            {players.map(p => {
                              const ps = ea.find(a => a.player_id === p.id)?.status || "pending";
                              return (
                                <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                  <div
                                    className={`transition-smooth ${updatingEventId === ev.id && Number(p.id) === Number(myPlayerId) ? 'animate-status-update' : ''}`}
                                    style={{
                                      width: 36, height: 36, borderRadius: "50%", background: p.avatar_color,
                                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "white",
                                      border: `2px solid ${ps === 'available' ? 'var(--val-cyan)' : ps === 'maybe' ? 'var(--val-yellow)' : ps === 'unavailable' ? 'var(--val-red)' : 'rgba(255,255,255,0.1)'}`,
                                      boxShadow: ps !== 'pending' ? `0 0 10px ${ps === 'available' ? 'var(--val-cyan)' : ps === 'maybe' ? 'var(--val-yellow)' : 'var(--val-red)'}44` : 'none',
                                      transform: ps !== 'pending' ? 'scale(1)' : 'scale(0.9)',
                                      opacity: ps !== 'pending' ? 1 : 0.6
                                    }}>
                                    {p.name[0]}
                                  </div>
                                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{p.name.split(' ')[0]}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {myPlayerId && !isPast && (
                          <div className="glass-card" style={{ padding: 12, borderRadius: 12, display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>Confirmar:</div>
                            <div style={{ display: "flex", gap: 8, flex: 1 }}>
                              <button
                                className={`btn btn-sm ${myStatus === 'available' ? 'btn-primary' : 'btn-secondary'} transition-smooth`}
                                onClick={() => setAvailability(ev.id, 'available')}
                                style={{ flex: 1, fontSize: 10 }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                SÍ ✅
                              </button>
                              <button
                                className={`btn btn-sm ${myStatus === 'maybe' ? 'btn-primary' : 'btn-secondary'} transition-smooth`}
                                onClick={() => setAvailability(ev.id, 'maybe')}
                                style={{ flex: 1, fontSize: 10 }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                DUDA ⚠️
                              </button>
                              <button
                                className={`btn btn-sm ${myStatus === 'unavailable' ? 'btn-primary' : 'btn-secondary'} transition-smooth`}
                                onClick={() => setAvailability(ev.id, 'unavailable')}
                                style={{ flex: 1, fontSize: 10 }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                NO ❌
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="card glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="card-header">
              <h3 className="card-title">Nuevo Evento</h3>
              <button className="btn-icon" onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "white", fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group">
                <label>Título</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Premier Semana 3" />
              </div>
              <div className="form-row" style={{ display: "flex", gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}><label>Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="custom">Personalizado (Custom)</option></select></div>
                <div className="form-group" style={{ flex: 1 }}><label>Mapa</label><select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}><option value="">Sin definir</option>{maps.filter(m => m.tacticalDescription).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              </div>
              <div className="form-row" style={{ display: "flex", gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}><label>Fecha</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Hora</label><input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Opcional..." /></div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNew(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={createEvent}>Crear Evento</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonTab({ active, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
      style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 8 }}
    >
      {label}
    </button>
  );
}
