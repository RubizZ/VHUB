"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      setEvents(d.events || []);
      setAvail(d.availability || {});
      if (d.seasons) setSeasons(d.seasons);
    } catch (e) {
      setError("Error al cargar eventos");
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Error al crear evento");
      setShowNew(false);
      loadEvents(selectedSeason);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateStatus = async (eventId: number, status: string) => {
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        body: JSON.stringify({ eventId, status })
      });
      if (!res.ok) throw new Error("Error al actualizar");
      loadEvents(selectedSeason);
    } catch (err) {
      setError("Error al actualizar disponibilidad");
    }
  };

  const deleteEvent = async (eventId: number) => {
    if (!confirm("¿Eliminar este evento personalizado?")) return;
    try {
      const res = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Solo puedes eliminar eventos personalizados");
      loadEvents(selectedSeason);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [currentDate]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  return (
    <div className="availability-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Agenda y Disponibilidad</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Planifica tus sesiones y confirma tu asistencia</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="glass-card" style={{ display: "flex", padding: 4, borderRadius: 8 }}>
              <button 
                className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode("calendar")}
              >
                📅 Calendario
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode("list")}
              >
                📋 Lista
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nuevo Evento
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, overflowX: "auto", paddingBottom: 4 }}>
          <SeasonTab active={selectedSeason === null} label="Todas" onClick={() => setSelectedSeason(null)} />
          {seasons.map(s => (
            <SeasonTab key={s} active={selectedSeason === s} label={s} onClick={() => setSelectedSeason(s)} />
          ))}
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0 }}>
        {error && <div className="card" style={{ background: "rgba(255,70,85,0.1)", border: "1px solid var(--val-red)", color: "var(--val-red)", marginBottom: 16 }}>{error}</div>}

        {viewMode === "calendar" ? (
          <div className="card glass-card" style={{ padding: 0, overflow: "hidden" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid var(--border-color)" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>
                  {currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                   <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>←</button>
                   <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                   <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>→</button>
                </div>
             </div>
             <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "rgba(255,255,255,0.01)" }}>
                {["L", "M", "X", "J", "V", "S", "D"].map(d => (
                  <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} style={{ height: 120, borderRight: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }} />;
                  const dateStr = day.toISOString().split('T')[0];
                  const dayEvents = events.filter(e => e.date === dateStr);
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  return (
                    <div key={dateStr} style={{ 
                      height: 120, padding: 10, borderRight: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)",
                      background: isToday ? "rgba(255,70,85,0.02)" : "transparent",
                      position: "relative"
                    }}>
                      <span style={{ 
                        fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "var(--val-red)" : "var(--text-primary)",
                        background: isToday ? "rgba(255,70,85,0.1)" : "transparent",
                        width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {day.getDate()}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {dayEvents.map(e => (
                          <div 
                            key={e.id} 
                            onClick={() => { setViewMode("list"); setScrollToEventId(e.id); }}
                            style={{ 
                              fontSize: 10, padding: "4px 6px", borderRadius: 4, 
                              background: e.type === "match" ? "var(--val-red)" : e.type === "playoffs" ? "var(--val-gold)" : "var(--val-cyan)",
                              color: "white", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer"
                            }}
                          >
                            {e.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {sortedEvents.map(e => {
              const date = new Date(e.date);
              const isPast = date < new Date(new Date().toDateString());
              const isFirstUpcoming = !isPast && !sortedEvents.find(ev => ev.id !== e.id && new Date(ev.date) < date && new Date(ev.date) >= new Date(new Date().toDateString()));
              
              return (
                <div 
                  key={e.id} 
                  ref={el => {
                    eventRefsMap.current[e.id] = el;
                    if (isFirstUpcoming) (firstUpcomingRef as any).current = el;
                  }}
                  className={`card glass-card ${isPast ? 'is-past' : 'hover-lift'}`} 
                  style={{ opacity: isPast ? 0.6 : 1, transition: "var(--transition)", borderLeft: `4px solid ${e.type === "match" ? "var(--val-red)" : e.type === "playoffs" ? "var(--val-gold)" : "var(--val-cyan)"}` }}
                >
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 300px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <span className={`tag ${e.type === "match" ? "tag-red" : e.type === "playoffs" ? "tag-gold" : "tag-cyan"}`}>
                          {e.type.toUpperCase()}
                        </span>
                        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{e.title}</h3>
                        {e.type === "custom" && (
                          <button onClick={() => deleteEvent(e.id)} className="btn-icon" style={{ marginLeft: "auto", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "var(--text-secondary)", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {new Date(e.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          {e.time}
                        </div>
                        {e.map && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {e.map}
                          </div>
                        )}
                      </div>
                      <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{e.description || "Sin descripción."}</p>
                    </div>

                    <div style={{ flex: "1 1 400px", background: "rgba(255,255,255,0.01)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Asistencia</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <div className="progress-bar" style={{ width: 100, height: 6 }}>
                             <div className="progress-fill-cyan" style={{ width: `${(avail[e.id]?.filter(a => a.status === 'yes').length / players.length) * 100}%` }} />
                             <div className="progress-fill-maybe" style={{ width: `${(avail[e.id]?.filter(a => a.status === 'maybe').length / players.length) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 8 }}>
                        {players.map(p => {
                          const status = avail[e.id]?.find(a => a.player_id === p.id)?.status || "none";
                          return (
                            <PlayerStatusIcon 
                              key={p.id} 
                              player={p} 
                              status={status} 
                              isMe={p.id === myPlayerId}
                              onUpdate={(s: string) => updateStatus(e.id, s)}
                            />
                          );
                        })}
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
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass-card modal-content" style={{ maxWidth: 500, width: "90%", position: "relative" }}>
            <div className="card-header">
              <h3 className="card-title">Crear Nuevo Evento</h3>
              <button className="btn-icon" onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={createEvent} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Título</label>
                <input className="input-field" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Fecha</label>
                  <input className="input-field" type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Hora</label>
                  <input className="input-field" type="time" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Mapa (Opcional)</label>
                <select className="input-field" value={form.map} onChange={e => setForm({...form, map: e.target.value})}>
                  <option value="">Seleccionar mapa</option>
                  {maps.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Descripción</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNew(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Evento</button>
              </div>
            </form>
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
      style={{ whiteSpace: "nowrap", padding: "8px 16px" }}
    >
      {label}
    </button>
  );
}

function PlayerStatusIcon({ player, status, isMe, onUpdate }: any) {
  const [showOptions, setShowOptions] = useState(false);
  const statusColors: any = {
    yes: "var(--val-cyan)",
    no: "var(--val-red)",
    maybe: "var(--val-yellow)",
    none: "rgba(255,255,255,0.1)"
  };

  return (
    <div style={{ position: "relative" }}>
      <div 
        onClick={() => isMe && setShowOptions(!showOptions)}
        style={{ 
          width: 32, height: 32, borderRadius: "50%", 
          background: player.avatar_color, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, cursor: isMe ? "pointer" : "default",
          border: `2px solid ${statusColors[status]}`,
          boxShadow: status !== 'none' ? `0 0 10px ${statusColors[status]}44` : "none"
        }}
        title={player.name}
      >
        {player.name.charAt(0)}
      </div>
      {isMe && showOptions && (
        <div className="glass-card" style={{ 
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", 
          zIndex: 10, padding: 8, marginBottom: 8, display: "flex", gap: 8, borderRadius: 12,
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)"
        }}>
          {['yes', 'maybe', 'no'].map(s => (
            <button 
              key={s}
              onClick={() => { onUpdate(s); setShowOptions(false); }}
              style={{ 
                width: 24, height: 24, borderRadius: "50%", 
                background: statusColors[s], border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white"
              }}
            >
              {s === 'yes' ? '✓' : s === 'no' ? '✕' : '?'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
