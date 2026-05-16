"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/Skeleton";

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
  map_obj?: any;
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
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "week" | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const [maps, setMaps] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [scrollToEventId, setScrollToEventId] = useState<number | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [userCalendarToken, setUserCalendarToken] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [exportTab, setExportTab] = useState<"team" | "personal">("team");

  const myPlayerId = (session?.user as any)?.playerId;
  const firstUpcomingRef = useRef<HTMLDivElement>(null);
  const eventRefsMap = useRef<Record<number, HTMLDivElement | null>>({});
  const weekScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch("/api/maps").then(r => r.json()).then(d => setMaps(d.maps || []));

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("vhub_avail_view_mode");
    if (saved === "list" || saved === "calendar" || saved === "week") {
      setViewMode(saved as any);
      } else {
        setViewMode("calendar");
      }
      loadToken();
      loadUserToken();
  }, [isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("vhub_avail_view_mode", viewMode || "calendar");
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

  const loadToken = async () => {
    try {
      const res = await fetch("/api/teams/calendar-token");
      const d = await res.json();
      if (d.token) setCalendarToken(d.token);
    } catch (e) {
      console.error("Error loading calendar token", e);
    }
  };

  const loadUserToken = async () => {
    try {
      const res = await fetch("/api/users/calendar-token");
      const d = await res.json();
      if (d.token) setUserCalendarToken(d.token);
    } catch (e) {
      console.error("Error loading user calendar token", e);
    }
  };

  const regenerateToken = async (type: "team" | "personal") => {
    if (!confirm("¿Estás seguro de que quieres regenerar el enlace? El anterior dejará de funcionar en todas las aplicaciones donde lo hayas configurado.")) return;
    try {
      setIsRegenerating(true);
      const url = type === "team" ? "/api/teams/calendar-token" : "/api/users/calendar-token";
      const res = await fetch(url, { method: "POST" });
      const d = await res.json();
      if (type === "team") setCalendarToken(d.token);
      else setUserCalendarToken(d.token);
    } catch (e) {
      console.error("Error regenerating token", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const statusIcon = (s: string) => s === "available" ? "✅" : s === "maybe" ? "⚠️" : s === "unavailable" ? "❌" : "⏳";

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDateLocal(new Date());

  const firstUpcomingId = useMemo(() => {
    if (!isMounted || events.length === 0) return null;
    const idx = events.findIndex((e) => {
      const pIsPast = isMounted && (e as any).localDate < todayStr;
      const pIsCancelled = e.status === 'cancelled';
      const pEA = avail[e.id] || [];
      const pUnavailable = pEA.filter(a => a.status === "unavailable").length;
      const pIsImpossible = isMounted && !pIsPast && players.length >= 5 && (players.length - pUnavailable < 5);
      return isMounted && !pIsPast && !pIsCancelled && !pIsImpossible && e.status === 'scheduled';
    });
    return idx !== -1 ? events[idx].id : null;
  }, [events, avail, isMounted, players, todayStr]);

  const canManage = (session?.user as any)?.role === "team_admin" || (session?.user as any)?.role === "super_admin";

  const { dayNames, days, weekDays, monthLabel } = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const monthLabel = currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    let startDayOffset = startOfMonth.getDay();
    if (startDayOffset === 0) startDayOffset = 7;
    startDayOffset -= 1;

    const days: any[] = [];
    const weekDays: any[] = [];
    const todayStr = formatDateLocal(new Date());

    for (let i = 0; i < startDayOffset; i++) days.push({ empty: true });
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const dateStr = formatDateLocal(d);
      const isToday = isMounted && dateStr === todayStr;
      const isPast = isMounted && dateStr < todayStr;
      days.push({ day: i, date: dateStr, isToday, isPast, events: events.filter(e => (e as any).localDate === dateStr) });
    }

    // Weekly View Logic
    const startOfWeek = new Date(currentDate);
    let day = startOfWeek.getDay();
    let diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = formatDateLocal(d);
      const isToday = isMounted && dateStr === todayStr;
      const isPast = isMounted && dateStr < todayStr;
      weekDays.push({ 
        day: d.getDate(), 
        date: dateStr, 
        isToday, 
        isPast, 
        events: events.filter(e => (e as any).localDate === dateStr),
        month: d.toLocaleDateString("es-ES", { month: 'short' })
      });
    }

    return { dayNames, days, weekDays, monthLabel };
  }, [events, isMounted, currentDate, viewMode]);

  useEffect(() => {
    if (viewMode === "week" && weekScrollRef.current) {
      const allEvents = weekDays.flatMap(d => d.events);
      let targetMinutes = 16 * 60; // Por defecto 4 PM
      
      if (allEvents.length > 0) {
        const totalMinutes = allEvents.reduce((acc: number, ev: any) => {
          const [h, m] = ev.localTime.split(':').map(Number);
          return acc + (h * 60 + m);
        }, 0);
        targetMinutes = totalMinutes / allEvents.length;
      }
      
      const containerHeight = weekScrollRef.current.clientHeight || 600;
      weekScrollRef.current.scrollTop = targetMinutes - (containerHeight / 2);
    }
  }, [viewMode, weekDays]);

  const changeDate = (offset: number) => {
    if (viewMode === "calendar") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    } else if (viewMode === "week") {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (offset * 7));
      setCurrentDate(newDate);
    }
  };

  return (
    <div className="availability-wrapper" style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "0 24px 0" }}>
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Agenda y Disponibilidad</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Planifica tus sesiones y confirma tu asistencia</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="glass-card" style={{ display: "flex", padding: 4, borderRadius: 10 }}>
              <button
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setViewMode("list"); setHasInitialScrolled(false); }}
                style={{ borderRadius: 8 }}
              >
                📋 Lista
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setViewMode("week"); setHasInitialScrolled(false); setCurrentDate(new Date()); }}
                style={{ borderRadius: 8 }}
              >
                📅 Semana
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setViewMode("calendar"); setHasInitialScrolled(false); setCurrentDate(new Date()); }}
                style={{ borderRadius: 8 }}
              >
                📅 Mes
              </button>
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                + Nuevo Evento
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowExport(true)} title="Exportar a Google Calendar, Apple, etc.">
              🔗 Exportar
            </button>
          </div>
        </div>

      </div>

      <div className="page-content animate-in" style={{ padding: 0, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {error && <div className="card" style={{ background: "rgba(255, 70, 85, 0.1)", border: "1px solid var(--val-red)", color: "var(--val-red)", marginBottom: 20, padding: 12, borderRadius: 8, flexShrink: 0 }}>⚠️ {error}</div>}

        {viewMode === null ? (
          <div className="animate-fade-in">
            <div className="card glass-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid var(--border-color)" }}>
                <Skeleton width={150} height={24} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Skeleton width={32} height={32} />
                  <Skeleton width={48} height={32} />
                  <Skeleton width={32} height={32} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} style={{ padding: "12px 0", display: "flex", justifyContent: "center" }}>
                    <Skeleton width={30} height={12} />
                  </div>
                ))}
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} style={{ height: 120, padding: 10, borderRight: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)" }}>
                    <Skeleton width={20} height={20} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {i % 3 === 0 && <Skeleton width="80%" height={16} />}
                      {i % 5 === 0 && <Skeleton width="60%" height={16} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (viewMode === "calendar" || viewMode === "week") ? (() => {
          const weekMap = viewMode === 'week' ? weekDays.flatMap(d => d.events).find(e => e.map_obj)?.map_obj : null;
          
          return (
            <div className="card glass-card" style={{ 
              padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%", maxHeight: "100%", marginBottom: 24,
              position: 'relative',
              background: "#0a0b14"
            }}>
              {weekMap && (
                <div style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                  backgroundImage: `url(${weekMap.premierBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: 0.15,
                  zIndex: 0,
                  pointerEvents: 'none'
                }} />
              )}
              <div style={{ 
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, 
                borderBottom: "1px solid var(--border-color)", flexShrink: 0,
                zIndex: 1, position: 'relative',
                background: "rgba(10, 11, 20, 0.5)",
                backdropFilter: "blur(4px)"
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>
                  {viewMode === 'calendar' ? monthLabel : `Semana del ${weekDays[0]?.day} de ${weekDays[0]?.month}`}
                </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => changeDate(-1)}>◀</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => changeDate(1)}>▶</button>
              </div>
            </div>
            <div className="calendar-grid-container" style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", zIndex: 1 }}>
              {viewMode === "calendar" ? (
                <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "rgba(255,255,255,0.01)", gap: 0, padding: 0, flex: 1 }}>
                  {dayNames.map(name => (
                    <div key={name} style={{ padding: "12px 0", textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{name}</div>
                  ))}
                  {days.map((d, i) => (
                    <div key={i} className={`animate-scale-in`} style={{
                      flex: 1, minHeight: 80, padding: 10, borderRight: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)",
                      background: d.empty ? "rgba(0,0,0,0.1)" : d.isToday ? "rgba(255,70,85,0.06)" : d.isPast ? "rgba(0,0,0,0.4)" : "transparent",
                      position: "relative",
                      opacity: d.isPast ? 0.25 : 1,
                      filter: d.isPast ? "grayscale(0.8) contrast(0.8)" : "none",
                      animationDelay: `${(i % 7) * 0.05}s`,
                      boxShadow: d.isToday ? "inset 0 0 20px rgba(255,70,85,0.1)" : "none",
                      zIndex: d.isToday ? 2 : 1
                    }}>
                      {!d.empty && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: 12, fontWeight: d.isToday ? 800 : 500, color: d.isToday ? "white" : "var(--text-primary)",
                              background: d.isToday ? "var(--val-red)" : "transparent",
                              width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: d.isToday ? "0 0 10px var(--val-red-glow)" : "none"
                            }}>{d.day}</span>
                            {d.isToday && <span style={{ fontSize: 8, fontWeight: 900, color: "var(--val-red)", letterSpacing: 1, textTransform: "uppercase" }}>Hoy</span>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                            {d.events.map((ev: any) => {
                              const ea = avail[ev.id] || [];
                              const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
                              const isCancelled = ev.status === 'cancelled';
                              const isNoPlayers = ev.status === 'no_players';
                              const isNotPlayed = ev.status === 'not_played';
                              
                              const unavailable = ea.filter(a => a.status === "unavailable").length;
                              const isImpossible = isMounted && (ev as any).localDate >= todayStr && players.length >= 5 && (players.length - unavailable < 5);
                              
                              const isRed = isCancelled || isNoPlayers || isNotPlayed || isImpossible;
                              const evColor = ev.type === "playoffs" ? "var(--val-yellow)" : ev.type === "match" ? "var(--val-red)" : "var(--val-cyan)";
                              const evColorDark = ev.type === "playoffs" ? "var(--val-yellow-dark)" : ev.type === "match" ? "var(--val-red-dark)" : "#008a6e";
                              const isFirstUpcoming = ev.id === firstUpcomingId;

                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => setSelectedEventId(ev.id)}
                                  style={{
                                    fontSize: 10, padding: "4px 6px", borderRadius: 4,
                                    background: isRed 
                                      ? 'transparent' 
                                      : myStatus === 'unavailable'
                                        ? 'transparent'
                                        : myStatus === 'pending'
                                          ? 'transparent'
                                          : myStatus === 'maybe'
                                            ? `repeating-linear-gradient(45deg, ${evColor}, ${evColor} 6px, ${evColorDark} 6px, ${evColorDark} 12px)`
                                            : evColor,
                                    color: (isRed || myStatus === 'unavailable' || myStatus === 'pending') ? evColor : "white",
                                    fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer",
                                    textDecoration: (isCancelled || isNoPlayers || isNotPlayed || isImpossible || myStatus === 'unavailable') ? 'line-through' : 'none',
                                    opacity: (isCancelled || isNoPlayers || isNotPlayed || isImpossible || myStatus === 'unavailable') ? 0.4 : 1,
                                    border: (isRed || myStatus === 'unavailable') ? `1px solid ${evColor}` : myStatus === 'pending' ? `1px dashed ${evColor}` : '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: isFirstUpcoming
                                      ? `0 0 10px ${ev.type === "match" ? "rgba(255, 70, 85, 0.4)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.4)" : "rgba(0, 212, 170, 0.4)"}`
                                      : 'none',
                                    zIndex: isFirstUpcoming ? 5 : undefined
                                  }}
                                  title={`${ev.localTime} - ${ev.title} (${myStatus === 'pending' ? 'Pendiente' : ev.status})`}
                                >
                                  {isFirstUpcoming && (
                                    <span style={{
                                      marginRight: 4,
                                      background: ev.type === "match" ? "var(--val-red)" : ev.type === "playoffs" ? "var(--val-yellow)" : "var(--val-cyan)",
                                      color: ev.type === "playoffs" ? "black" : "white",
                                      padding: "1px 3px",
                                      borderRadius: 3,
                                      fontSize: 7,
                                      fontWeight: 900,
                                      boxShadow: "0 0 8px rgba(255,255,255,0.2)"
                                    }}>
                                      PRÓXIMO
                                    </span>
                                  )}
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
              ) : (
                <div className="week-view" style={{ 
                  display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
                  position: 'relative',
                  background: "transparent"
                }}>
                  <div ref={weekScrollRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "scroll", position: "relative" }}>
                  <div style={{ position: "sticky", top: 0, zIndex: 30, display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", borderBottom: "1px solid var(--border-color)", background: "#0a0b14" }}>
                    <div style={{ borderRight: "1px solid var(--border-color)" }} />
                    {weekDays.map((d: any, idx: number) => (
                      <div key={idx} style={{ padding: "12px 8px", textAlign: "center", borderRight: idx < 6 ? "1px solid var(--border-color)" : "none" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{dayNames[idx]}</div>
                        <div style={{ 
                          fontSize: 16, fontWeight: 800, 
                          color: d.isToday ? "var(--val-red)" : "white",
                          display: "inline-block", padding: "2px 8px", borderRadius: 6,
                          background: d.isToday ? "rgba(255,70,85,0.1)" : "transparent"
                        }}>{d.day}</div>
                      </div>
                    ))}
                  </div>
                    <div style={{ display: "flex", flex: 1, position: "relative" }}>
                    {/* Time Column */}
                    <div style={{ width: 60, flexShrink: 0, borderRight: "1px solid var(--border-color)", background: "rgba(0,0,0,0.2)" }}>
                      {Array.from({ length: 24 }).map((_, i) => {
                        const hour = i;
                        return (
                          <div key={hour} style={{ height: 60, padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                        );
                      })}
                    </div>

                    {/* Day Columns */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1, position: "relative" }}>
                      {weekDays.map((d: any, idx: number) => (
                        <div key={idx} className="animate-scale-in" style={{ 
                          position: "relative", borderRight: idx < 6 ? "1px solid var(--border-color)" : "none",
                          background: d.isToday ? "rgba(255,70,85,0.02)" : d.isPast ? "rgba(0,0,0,0.2)" : "transparent",
                          opacity: d.isPast ? 0.6 : 1,
                          animationDelay: `${idx * 0.05}s`
                        }}>
                          {/* Grid Lines */}
                          {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} style={{ height: 60, borderBottom: "1px solid rgba(255,255,255,0.03)" }} />
                          ))}

                          {/* Current Time Indicator */}
                          {d.isToday && (
                            <div style={{
                              position: "absolute",
                              top: now.getHours() * 60 + now.getMinutes(),
                              left: 0,
                              right: 0,
                              height: 2,
                              background: "var(--val-red)",
                              zIndex: 20,
                              pointerEvents: "none",
                              boxShadow: "0 0 10px var(--val-red-glow)"
                            }}>
                              <div style={{
                                position: "absolute",
                                left: -4,
                                top: -3,
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "var(--val-red)",
                                boxShadow: "0 0 15px var(--val-red-glow)"
                              }} />
                            </div>
                          )}

                          {/* Events */}
                          {d.events.map((ev: any) => {
                            const [h, m] = ev.localTime.split(':').map(Number);
                            
                            const top = h * 60 + m;
                            let duration = 1.5;
                            if (ev.localEndTime) {
                              const [eh, em] = ev.localEndTime.split(':').map(Number);
                              duration = (eh - h) + (em - m) / 60;
                            }
                            const height = duration * 60;

                            const ea = avail[ev.id] || [];
                            const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
                            const isCancelled = ev.status === 'cancelled';
                            const isNoPlayers = ev.status === 'no_players';
                            const isNotPlayed = ev.status === 'not_played';
                            const unavailable = ea.filter(a => a.status === "unavailable").length;
                            const isImpossible = isMounted && (ev as any).localDate >= todayStr && players.length >= 5 && (players.length - unavailable < 5);
                            
                            const isRed = isCancelled || isNoPlayers || isNotPlayed || isImpossible;
                            const evColor = ev.type === "playoffs" ? "var(--val-yellow)" : ev.type === "match" ? "var(--val-red)" : "var(--val-cyan)";
                            const evColorDark = ev.type === "playoffs" ? "var(--val-yellow-dark)" : ev.type === "match" ? "var(--val-red-dark)" : "#008a6e";
                            const isFirstUpcoming = ev.id === firstUpcomingId;

                            return (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedEventId(ev.id)}
                                style={{
                                  position: "absolute", top: top, left: 4, right: 4, height: height,
                                  fontSize: 10, padding: "6px", borderRadius: 8, zIndex: isFirstUpcoming ? 25 : 10,
                                  background: isRed 
                                    ? 'transparent' 
                                    : myStatus === 'unavailable'
                                      ? 'transparent'
                                      : myStatus === 'pending'
                                        ? 'transparent'
                                        : myStatus === 'maybe'
                                          ? `repeating-linear-gradient(45deg, ${evColor}, ${evColor} 6px, ${evColorDark} 6px, ${evColorDark} 12px)`
                                          : evColor,
                                  color: (isRed || myStatus === 'unavailable' || myStatus === 'pending') ? evColor : "white",
                                  fontWeight: 700, cursor: "pointer",
                                  boxShadow: isFirstUpcoming 
                                    ? `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${ev.type === "match" ? "rgba(255, 70, 85, 0.4)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.4)" : "rgba(0, 212, 170, 0.4)"}`
                                    : (myStatus === 'pending' || myStatus === 'unavailable' || isRed) ? "none" : "0 4px 12px rgba(0,0,0,0.3)",
                                  border: (isRed || myStatus === 'unavailable') ? `1px solid ${evColor}` : myStatus === 'pending' ? `2px dashed ${evColor}` : '1px solid rgba(255,255,255,0.1)',
                                  display: "flex", flexDirection: height < 40 ? "row" : "column", alignItems: height < 40 ? "center" : "flex-start", justifyContent: height < 40 ? "center" : "flex-start", gap: height < 40 ? 4 : 2, overflow: "hidden",
                                  opacity: (myStatus === 'pending' || myStatus === 'unavailable' || isRed) ? 0.4 : 1,
                                  textDecoration: (myStatus === 'unavailable' || isRed) ? 'line-through' : 'none'
                                }}
                              >
                                {isFirstUpcoming && (
                                  <div style={{
                                    background: "rgba(255,255,255,0.18)",
                                    color: "white",
                                    padding: "1px 4px",
                                    borderRadius: 4,
                                    fontSize: 7,
                                    fontWeight: 900,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    marginBottom: height < 40 ? 0 : 2
                                  }}>
                                    PRÓXIMO
                                  </div>
                                )}
                                <div style={{ whiteSpace: height < 40 ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{ev.title}</div>
                                 <div style={{ fontSize: 8, opacity: 0.7, fontWeight: 600, textTransform: "uppercase" }}>
                                   {ev.map ? (maps.find((m: any) => m.id === ev.map)?.name || ev.map) : (ev.type === "playoffs" ? "Pick & Ban" : "Por decidir")}
                                 </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )})() : (
          <div className="events-list-container" style={{ display: "flex", flexDirection: "column", gap: 40, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
            {events.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>No hay eventos programados.</p>}
            {events.map((ev, idx) => {
              const isPast = isMounted && (ev as any).localDate < todayStr;
              const isCancelled = ev.status === 'cancelled';
              const ea = avail[ev.id] || [];
              const confirmed = ea.filter(a => a.status === "available").length;
              const maybeCount = ea.filter(a => a.status === "maybe").length;
              const unavailable = ea.filter(a => a.status === "unavailable").length;
              const isImpossible = isMounted && !isPast && players.length >= 5 && (players.length - unavailable < 5);
              const isConfirmed = confirmed >= 5;

              // Logic for day grouping (visual only)
              const prevEv = idx > 0 ? events[idx - 1] : null;
              const showDayHeader = !prevEv || prevEv.date !== ev.date;
              const isToday = (ev as any).localDate === todayStr;

              // Logic for "PRÓXIMO" tag and preceding items
              const isFirstUpcoming = ev.id === firstUpcomingId;
              const firstUpcomingIdx = events.findIndex(e => e.id === firstUpcomingId);
              const isBeforeUpcoming = firstUpcomingIdx !== -1 && idx < firstUpcomingIdx;
              const isInactive = isPast || isCancelled || isImpossible || ev.status === 'completed' || ev.status === 'no_players' || ev.status === 'not_played' || isBeforeUpcoming;

              const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
              const matches = ev.linkedMatches || [];

              return (
                <div key={ev.id}>
                  {showDayHeader && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, opacity: isInactive ? 0.45 : 1 }}>
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
                    className={`card glass-card animate-in ${isInactive ? "faded-card" : myStatus === "unavailable" ? "unavailable-card hover-lift" : "hover-lift"}`}
                    style={{
                      marginBottom: 12,
                      borderLeft: `4px solid ${ev.type === "match" ? "var(--val-red)" : ev.type === "playoffs" ? "var(--val-yellow)" : "var(--val-cyan)"}`,
                      scrollMarginTop: "100px",
                      animationDelay: `${Math.min(idx, 5) * 0.1}s`,
                      boxShadow: isFirstUpcoming 
                        ? `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${ev.type === "match" ? "rgba(255, 70, 85, 0.25)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.25)" : "rgba(0, 212, 170, 0.25)"}`
                        : undefined,
                      ["--hover-color" as any]: ev.type === "match" ? "var(--val-red)" : ev.type === "playoffs" ? "var(--val-yellow)" : "var(--val-cyan)",
                      ["--hover-glow-color" as any]: ev.type === "match" ? "rgba(255, 70, 85, 0.3)" : ev.type === "playoffs" ? "rgba(245, 158, 11, 0.3)" : "rgba(0, 212, 170, 0.3)"
                    }}
                  >
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      {/* Columna Izquierda: Información de Evento */}
                      <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className={`tag ${ev.type === "match" ? "tag-red" : ev.type === "playoffs" ? "tag-gold" : "tag-green"}`}>
                              {ev.type === "match" ? "Partido" : ev.type === "playoffs" ? "Playoffs" : "Práctica"}
                            </span>
                            {isFirstUpcoming && <span className="tag" style={{ background: "var(--val-red)", color: "white", fontSize: 10, fontWeight: 900, boxShadow: "0 0 12px var(--val-red-glow)", letterSpacing: 0.5 }}>PRÓXIMO</span>}
                            {ev.status === 'completed' && <span className="tag tag-neutral" style={{ fontSize: 10, fontWeight: 800 }}>JUGADO</span>}
                          </div>
                          <h3 style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: "white",
                            margin: 0,
                            letterSpacing: "-0.5px",
                            textDecoration: (isCancelled || ev.status === 'no_players' || ev.status === 'not_played' || isImpossible) ? 'line-through' : undefined,
                            textShadow: "0 2px 10px rgba(0,0,0,0.3)"
                          }}>
                            {ev.title}
                          </h3>
                        </div>

                        {/* Cybernetic Slot Capsules */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-primary)"
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--val-cyan)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            <span>{ev.localTime} {ev.localEndTime && `— ${ev.localEndTime}`}</span>
                          </div>

                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-primary)"
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--val-red)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            <span>{ev.map ? (maps.find(m => m.id === ev.map)?.name || ev.map) : (ev.type === "playoffs" ? "Pick & Ban" : "Por decidir")}</span>
                          </div>
                        </div>

                        {ev.description && (
                          <p style={{
                            fontSize: 13,
                            color: "var(--text-muted)",
                            lineHeight: 1.6,
                            background: "rgba(255,255,255,0.01)",
                            padding: "10px 14px",
                            borderRadius: 8,
                            borderLeft: "2px solid rgba(255,255,255,0.1)",
                            margin: 0
                          }}>
                            {ev.description}
                          </p>
                        )}

                        {(isCancelled || ev.status === 'no_players' || ev.status === 'not_played' || isImpossible) && (
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: "rgba(255, 70, 85, 0.06)",
                            border: "1px solid rgba(255, 70, 85, 0.2)",
                            color: "var(--val-red)",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: "0 4px 20px rgba(255, 70, 85, 0.05)"
                          }}>
                            <span style={{ fontSize: 14 }}>⚠️</span>
                            <span>
                              {isCancelled && "Cancelado: Ya se jugaron 2 partidos esta semana."}
                              {ev.status === 'no_players' && "Sin asistencia: No hay suficientes jugadores confirmados."}
                              {ev.status === 'not_played' && "No jugado: Evento cancelado/no disputado."}
                              {(isImpossible && ev.status === 'scheduled') && "Imposible: Falta de jugadores (mínimo 5 confirmados)."}
                            </span>
                          </div>
                        )}

                        {/* Linked Matches */}
                        {matches.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Partidos Jugados</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {matches.map((m: LinkedMatch) => {
                                const ourWin = (m.our_team_side === "Blue" ? m.team_blue_won : !m.team_blue_won);
                                const isBlue = m.our_team_side === "Blue";
                                const ourScore = isBlue ? m.team_blue_score : m.team_red_score;
                                const rivalScore = isBlue ? m.team_red_score : m.team_blue_score;
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
                                    <div style={{ flex: 1, fontSize: 12 }}>
                                      <span style={{ fontWeight: 700 }}>{m.map_name}</span> 
                                      <span style={{ marginLeft: 8, fontWeight: 800, color: ourWin ? "var(--val-cyan)" : "var(--val-red)" }}>{ourScore}</span>
                                      <span style={{ margin: "0 4px", opacity: 0.3 }}>-</span>
                                      <span style={{ color: "var(--text-muted)" }}>{rivalScore}</span>
                                    </div>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>ANALÍTICA →</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Columna Derecha: Asistencia, Mapa y Controles */}
                      <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Attendance Card */}
                        <div className="glass-card" style={{ 
                          background: "rgba(255,255,255,0.01)", 
                          borderRadius: 12, 
                          padding: 16, 
                          border: confirmed >= 5 ? "1px solid rgba(0, 212, 170, 0.25)" : "1px solid var(--border-color)",
                          boxShadow: confirmed >= 5 ? "0 4px 20px rgba(0, 212, 170, 0.03)" : "none",
                          transition: "border-color 0.3s, box-shadow 0.3s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Asistencia</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                {confirmed >= 5 ? "¡Escuadra Completa!" : "Buscando jugadores..."}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div className={`progress-bar ${updatingEventId === ev.id ? 'animate-pulse' : ''}`} style={{ width: 100, height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
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
                                      position: "relative",
                                      width: 38,
                                      height: 38,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}
                                  >
                                    {/* Circular Avatar */}
                                    <div
                                      className="transition-smooth"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        borderRadius: "50%",
                                        background: p.avatar_color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 14,
                                        fontWeight: 900,
                                        color: "white",
                                        border: `2px solid ${
                                          ps === 'available' ? 'var(--val-cyan)' : 
                                          ps === 'maybe' ? 'var(--val-yellow)' : 
                                          ps === 'unavailable' ? 'var(--val-red)' : 'rgba(255,255,255,0.1)'
                                        }`,
                                        boxShadow: ps !== 'pending' 
                                          ? `0 0 12px ${ps === 'available' ? 'var(--val-cyan)' : ps === 'maybe' ? 'var(--val-yellow)' : 'var(--val-red)'}44` 
                                          : 'none',
                                        opacity: ps !== 'pending' ? 1 : 0.45
                                      }}
                                    >
                                      {p.name[0]}
                                    </div>
                                    {/* Status Emblem Indicator */}
                                    <div style={{
                                      position: "absolute",
                                      bottom: -2,
                                      right: -2,
                                      width: 14,
                                      height: 14,
                                      borderRadius: "50%",
                                      background: 
                                        ps === 'available' ? 'var(--val-cyan)' : 
                                        ps === 'maybe' ? 'var(--val-yellow)' : 
                                        ps === 'unavailable' ? 'var(--val-red)' : 'rgba(255,255,255,0.15)',
                                      border: "2px solid #11141b",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 8,
                                      fontWeight: 900,
                                      color: ps === 'maybe' ? 'black' : 'white',
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
                                    }}>
                                      {ps === 'available' ? '✓' : ps === 'maybe' ? '?' : ps === 'unavailable' ? '✗' : '•'}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{p.name.split(' ')[0]}</div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Dynamic Detailed Stats Row */}
                          <div style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 14,
                            paddingTop: 12,
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            justifyContent: "space-between",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-cyan)", boxShadow: "0 0 6px var(--val-cyan)" }} />
                              <span>{confirmed} Sí</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-yellow)", boxShadow: "0 0 6px var(--val-yellow)" }} />
                              <span>{maybeCount} Duda</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-red)", boxShadow: "0 0 6px var(--val-red)" }} />
                              <span>{unavailable} No</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />
                              <span>{players.length - confirmed - maybeCount - unavailable} Pendiente</span>
                            </div>
                          </div>
                        </div>

                        {/* Map Preview Card */}
                        {(() => {
                          const mapObj = ev.map ? maps.find((m: any) => m.id === ev.map) : null;
                          if (!mapObj) return null;
                          return (
                            <div className="glass-card" style={{
                              position: "relative",
                              borderRadius: 12,
                              height: 80,
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              background: "rgba(0,0,0,0.4)"
                            }}>
                              <div style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: "60%",
                                backgroundImage: `url(${mapObj.splash})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                maskImage: "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                opacity: 0.5,
                                pointerEvents: "none"
                              }} />
                              <div style={{ padding: "12px 16px", zIndex: 1, position: "relative" }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>Mapa Seleccionado</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{mapObj.name}</div>
                                {mapObj.tacticalDescription && (
                                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{mapObj.tacticalDescription}</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Actions Panel */}
                        {myPlayerId && !isInactive && (
                          <div style={{ 
                            padding: "6px 12px", 
                            borderRadius: 12, 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 16, 
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            backdropFilter: "blur(5px)"
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>Mi Estado:</div>
                            <div style={{ display: "flex", gap: 8, flex: 1 }}>
                              <button
                                onClick={() => setAvailability(ev.id, 'available')}
                                className="transition-smooth"
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  border: myStatus === 'available' ? "1px solid var(--val-cyan)" : "1px solid rgba(0, 212, 170, 0.15)",
                                  background: myStatus === 'available' ? "var(--val-cyan)" : "rgba(0, 212, 170, 0.03)",
                                  color: myStatus === 'available' ? "white" : "rgba(0, 212, 170, 0.85)",
                                  boxShadow: myStatus === 'available' ? "0 0 15px rgba(0, 212, 170, 0.3)" : "none",
                                  transform: "scale(1)"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.background = myStatus === 'available' ? "var(--val-cyan)" : "rgba(0, 212, 170, 0.1)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.background = myStatus === 'available' ? "var(--val-cyan)" : "rgba(0, 212, 170, 0.03)";
                                }}
                              >
                                <span>SÍ</span> <span>✅</span>
                              </button>
                              
                              <button
                                onClick={() => setAvailability(ev.id, 'maybe')}
                                className="transition-smooth"
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  border: myStatus === 'maybe' ? "1px solid var(--val-yellow)" : "1px solid rgba(245, 158, 11, 0.15)",
                                  background: myStatus === 'maybe' ? "var(--val-yellow)" : "rgba(245, 158, 11, 0.03)",
                                  color: myStatus === 'maybe' ? "black" : "rgba(245, 158, 11, 0.85)",
                                  boxShadow: myStatus === 'maybe' ? "0 0 15px rgba(245, 158, 11, 0.3)" : "none",
                                  transform: "scale(1)"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.background = myStatus === 'maybe' ? "var(--val-yellow)" : "rgba(245, 158, 11, 0.1)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.background = myStatus === 'maybe' ? "var(--val-yellow)" : "rgba(245, 158, 11, 0.03)";
                                }}
                              >
                                <span>DUDA</span> <span>⚠️</span>
                              </button>

                              <button
                                onClick={() => setAvailability(ev.id, 'unavailable')}
                                className="transition-smooth"
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  border: myStatus === 'unavailable' ? "1px solid var(--val-red)" : "1px solid rgba(255, 70, 85, 0.15)",
                                  background: myStatus === 'unavailable' ? "var(--val-red)" : "rgba(255, 70, 85, 0.03)",
                                  color: myStatus === 'unavailable' ? "white" : "rgba(255, 70, 85, 0.85)",
                                  boxShadow: myStatus === 'unavailable' ? "0 0 15px rgba(255, 70, 85, 0.3)" : "none",
                                  transform: "scale(1)"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.background = myStatus === 'unavailable' ? "var(--val-red)" : "rgba(255, 70, 85, 0.1)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.background = myStatus === 'unavailable' ? "var(--val-red)" : "rgba(255, 70, 85, 0.03)";
                                }}
                              >
                                <span>NO</span> <span>❌</span>
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

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="card glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="card-header">
              <h3 className="card-title">Sincronizar Calendario</h3>
              <button className="btn-icon" onClick={() => setShowExport(false)} style={{ background: "none", border: "none", color: "white", fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
              <button 
                className={`btn btn-sm ${exportTab === 'team' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExportTab("team")}
              >
                👥 Equipo
              </button>
              <button 
                className={`btn btn-sm ${exportTab === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExportTab("personal")}
              >
                👤 Mi Calendario
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {exportTab === 'team' 
                  ? "Copia este enlace para ver todos los eventos del equipo en tu calendario."
                  : "Este calendario incluye tus estados (✅, ⚠️, ❌) y está personalizado para ti."}
              </p>
              
              <div className="form-group">
                <label>{exportTab === 'team' ? "Enlace del Equipo" : "Mi Enlace Personal"}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    readOnly 
                    value={!isMounted || (exportTab === 'team' ? !calendarToken : !userCalendarToken) 
                      ? "Cargando enlace..." 
                      : `${window.location.origin}/api/calendar/${exportTab === 'team' ? '' : 'user/'}${exportTab === 'team' ? calendarToken : userCalendarToken}`} 
                    style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: (exportTab === 'team' ? calendarToken : userCalendarToken) ? "var(--val-cyan)" : "var(--text-muted)", fontWeight: 600 }}
                  />
                  <button 
                    className="btn btn-primary" 
                    disabled={exportTab === 'team' ? !calendarToken : !userCalendarToken}
                    onClick={() => {
                      const token = exportTab === 'team' ? calendarToken : userCalendarToken;
                      const path = exportTab === 'team' ? '' : 'user/';
                      if (token) {
                        navigator.clipboard.writeText(`${window.location.origin}/api/calendar/${path}${token}`);
                        alert("¡Enlace copiado!");
                      }
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>Instrucciones rápidas:</h4>
                <ul style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 20, lineHeight: 1.8 }}>
                  <li><strong>Google Calendar:</strong> Añadir → "Desde URL".</li>
                  <li><strong>Apple Calendar:</strong> Archivo → "Nueva suscripción a calendario".</li>
                  <li><strong>Outlook:</strong> Añadir calendario → "Desde Internet".</li>
                </ul>
              </div>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                 <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Puedes regenerar tu enlace personal si crees que alguien más lo tiene.
                </p>
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ color: "var(--val-red)", alignSelf: "flex-start" }}
                  onClick={() => regenerateToken(exportTab)}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? "Regenerando..." : "Regenerar Enlace de Seguridad"}
                </button>
              </div>
              
              <button className="btn btn-secondary" onClick={() => setShowExport(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {selectedEventId && (() => {
        const ev = events.find(e => e.id === selectedEventId);
        if (!ev) return null;
        const ea = avail[ev.id] || [];
        const confirmed = ea.filter(a => a.status === "available").length;
        const maybeCount = ea.filter(a => a.status === "maybe").length;
        const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
        const isPast = isMounted && (ev as any).localDate < todayStr;
        const isCancelled = ev.status === 'cancelled';
        const isNoPlayers = ev.status === 'no_players';
        const isNotPlayed = ev.status === 'not_played';
        const unavailable = ea.filter(a => a.status === "unavailable").length;
        const isImpossible = isMounted && !isPast && players.length >= 5 && (players.length - unavailable < 5);
        const isInactiveModal = isPast || isCancelled || isNoPlayers || isNotPlayed || isImpossible || ev.status === 'completed';

        const isRed = isCancelled || isNoPlayers || isNotPlayed || isImpossible;
        const evColorBase = ev.type === "playoffs" ? "var(--val-yellow)" : ev.type === "match" ? "var(--val-red)" : "var(--val-cyan)";
        const evColor = isRed || myStatus === 'unavailable' ? 'rgba(255,255,255,0.05)' : evColorBase;
        const mapObj = ev.map_obj;

        return (
          <div className="modal-overlay" onClick={() => setSelectedEventId(null)}>
            <div className="card glass-card modal-content animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, overflow: 'hidden', border: `1px solid var(--border-color)` }}>
              <div style={{ 
                position: 'relative', 
                height: 160, 
                background: mapObj?.premierBackground ? `url(${mapObj.premierBackground})` : (isRed || myStatus === 'unavailable' ? 'rgba(0,0,0,0.5)' : evColorBase),
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex', 
                alignItems: 'end', 
                padding: 24,
                boxShadow: `inset 0 -60px 80px -20px #0a0b14, inset 0 0 100px ${evColorBase}44`,
                borderBottom: `2px solid ${evColorBase}`
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(to top, #0a0b14 0%, transparent 100%), radial-gradient(circle at center, ${evColor}22 0%, transparent 70%)` }} />
                <button 
                  onClick={() => setSelectedEventId(null)}
                  style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
                >✕</button>
                <div style={{ zIndex: 1, width: '100%' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                     <span className="tag" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                      {ev.type === "match" ? "Partido" : ev.type === "playoffs" ? "Playoffs" : "Práctica"}
                     </span>
                     {ev.status === 'completed' && <span className="tag tag-neutral">Jugado</span>}
                   </div>
                   <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{ev.title}</h2>
                </div>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                {(isCancelled || isNoPlayers || isNotPlayed || isImpossible) && (
                  <div style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: "rgba(255, 70, 85, 0.06)",
                    border: "1px solid rgba(255, 70, 85, 0.2)",
                    color: "var(--val-red)",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: "0 4px 20px rgba(255, 70, 85, 0.05)"
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span>
                      {isCancelled && "Cancelado: Ya se jugaron 2 partidos esta semana."}
                      {isNoPlayers && "Sin asistencia: No hay suficientes jugadores confirmados."}
                      {isNotPlayed && "No jugado: Evento cancelado/no disputado."}
                      {(isImpossible && ev.status === 'scheduled') && "Imposible: Falta de jugadores (mínimo 5 confirmados)."}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: "var(--text-secondary)", fontSize: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--val-red)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{new Date(`${ev.date}T00:00:00`).toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      <div style={{ fontSize: 12 }}>{ev.localTime} {ev.localEndTime && `— ${ev.localEndTime}`}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: "var(--text-secondary)", fontSize: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--val-cyan)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ev.map ? (ev.map_obj?.name || ev.map) : (ev.type === "playoffs" ? "Pick & Ban" : "Por decidir")}</div>
                  </div>
                </div>

                {ev.description && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {ev.description}
                  </div>
                )}

                {ev.linkedMatches && ev.linkedMatches.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Partidas Vinculadas ({ev.linkedMatches.length}):</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ev.linkedMatches.map((m: any) => {
                        const isBlue = m.our_team_side === "Blue";
                        const isWin = isBlue ? m.team_blue_won : !m.team_blue_won;
                        const ourScore = isBlue ? m.team_blue_score : m.team_red_score;
                        const rivalScore = isBlue ? m.team_red_score : m.team_blue_score;
                        return (
                          <div key={m.id} style={{ 
                            padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', 
                            border: `1px solid ${isWin ? 'rgba(0,255,163,0.2)' : 'rgba(255,70,85,0.2)'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isWin ? 'var(--val-cyan)' : 'var(--val-red)' }} />
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{m.map_name}</span>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>
                              <span style={{ color: isWin ? 'var(--val-cyan)' : 'var(--val-red)' }}>{ourScore}</span>
                              <span style={{ margin: '0 4px', opacity: 0.3 }}>—</span>
                              <span style={{ color: 'var(--text-muted)' }}>{rivalScore}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="glass-card" style={{ background: "rgba(255,255,255,0.01)", borderRadius: 16, padding: 20, border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: 'var(--text-muted)' }}>Asistencia ({confirmed}/5)</span>
                    <div className="progress-bar" style={{ width: 80, height: 6 }}>
                      <div className="progress-fill progress-fill-cyan" style={{ width: `${Math.min((confirmed / 5) * 100, 100)}%` }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))", gap: 12 }}>
                    {players.map(p => {
                      const ps = ea.find(a => a.player_id === p.id)?.status || "pending";
                      return (
                        <div key={p.id} title={p.name} style={{ 
                          width: 36, height: 36, borderRadius: "50%", background: p.avatar_color, 
                          display: "flex", alignItems: "center", justifyContent: "center", 
                          fontSize: 14, fontWeight: 800, color: "white", 
                          border: `2px solid ${ps === 'available' ? 'var(--val-cyan)' : ps === 'maybe' ? 'var(--val-yellow)' : ps === 'unavailable' ? 'var(--val-red)' : 'rgba(255,255,255,0.1)'}`, 
                          boxShadow: ps !== 'pending' ? `0 0 10px ${ps === 'available' ? 'var(--val-cyan)' : ps === 'maybe' ? 'var(--val-yellow)' : 'var(--val-red)'}44` : 'none',
                          opacity: ps !== 'pending' ? 1 : 0.4,
                          transition: 'all 0.3s ease'
                        }}>
                          {p.name[0]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {myPlayerId && !isInactiveModal && (
                  <div style={{ display: "flex", flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Tu disponibilidad:</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className={`btn btn-sm ${myStatus === 'available' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setAvailability(ev.id, 'available')}
                        style={{ flex: 1, borderRadius: 10 }}
                      >SÍ ✅</button>
                      <button
                        className={`btn btn-sm ${myStatus === 'maybe' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setAvailability(ev.id, 'maybe')}
                        style={{ flex: 1, borderRadius: 10 }}
                      >DUDA ⚠️</button>
                      <button
                        className={`btn btn-sm ${myStatus === 'unavailable' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setAvailability(ev.id, 'unavailable')}
                        style={{ flex: 1, borderRadius: 10 }}
                      >NO ❌</button>
                    </div>
                  </div>
                )}
                
                {canManage && ev.type === 'custom' && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--val-red)', opacity: 0.6, fontSize: 11 }} onClick={() => { if(confirm('¿Estás seguro de borrar este evento?')) { deleteEvent(ev.id); setSelectedEventId(null); } }}>
                      🗑️ Eliminar Evento
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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
