"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo, useRef } from "react";


interface Player { id: number; name: string; avatar_color: string; }
interface Ev { id: number; title: string; type: string; date: string; time: string; description: string; map: string; localDate?: string; localTime?: string; }
interface Avail { player_id: number; player_name: string; status: string; avatar_color: string; }

export default function AvailabilityPage() {
  const { data: session } = useSession();
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

  const myPlayerId = (session?.user as any)?.playerId;
  const firstUpcomingRef = useRef<HTMLDivElement>(null);

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
    if (viewMode === "list" && firstUpcomingRef.current && isMounted && !hasInitialScrolled && events.length > 0) {
      // Pequeño timeout para asegurar que el DOM se ha renderizado y posicionado
      setTimeout(() => {
        firstUpcomingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setHasInitialScrolled(true);
      }, 300);
    }
  }, [viewMode, isMounted, events, hasInitialScrolled]);

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
        return {
          ...ev,
          localDate: formatDateLocal(utcDate),
          localTime: utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
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
                        const myStatus = avail[ev.id]?.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
                        return (
                          <div 
                            key={ev.id} 
                            className={`calendar-event-item ${ev.type === "match" ? "calendar-event-match" : ev.type === "playoffs" ? "calendar-event-playoffs" : "calendar-event-practice"} calendar-event-${myStatus}`}
                            title={`${ev.localTime} - ${ev.title} (Tu estado: ${myStatus})`}
                            onClick={() => setViewMode("list")} 
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
              const isPast = (ev as any).localDate < todayStr;
              const isFirstUpcoming = !isPast && (idx === 0 || (events[idx-1] as any).localDate < todayStr);
              
              const ea = avail[ev.id] || [];
              const confirmed = ea.filter(a => a.status === "available").length;
              const myStatus = ea.find(a => Number(a.player_id) === Number(myPlayerId))?.status || "pending";
              
              return (
                <div 
                  key={ev.id} 
                  ref={isFirstUpcoming ? firstUpcomingRef : null}
                  className="card" 
                  style={{ 
                    marginBottom: 12, 
                    opacity: isPast ? 0.5 : 1,
                    borderLeft: isFirstUpcoming ? "4px solid var(--val-cyan)" : undefined,
                    transition: "opacity 0.3s ease",
                    scrollMarginTop: "100px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{ev.title}</h3>
                        <span className={`tag ${ev.type === "match" ? "tag-red" : ev.type === "playoffs" ? "tag-gold" : "tag-green"}`}>{ev.type === "match" ? "Partido" : ev.type === "playoffs" ? "Playoffs" : "Práctica"}</span>
                        {isPast && <span className="tag" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>Pasado</span>}
                        {isFirstUpcoming && <span className="tag tag-cyan" style={{ fontSize: 10 }}>PRÓXIMO</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                        📅 {new Date(`${ev.date}T${ev.time}:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · ⏰ {ev.localTime}
                        {ev.map && <> · 🗺️ {maps.find(m => m.id === ev.map)?.name || ev.map}</>}
                      </div>
                      {ev.description && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{ev.description}</div>}
                    </div>
                    {canManage && ev.type === "custom" && <button className="btn btn-ghost btn-sm" onClick={() => deleteEvent(ev.id)}>🗑️</button>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-fill" style={{ width: `${(confirmed / Math.max(players.length, 1)) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{confirmed}/{players.length}</span>
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
                </div>
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
