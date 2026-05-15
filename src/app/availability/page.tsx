"use client";
import { useEffect, useState } from "react";
import { MAPS, getCompetitiveMaps, findMapById } from "@/lib/maps";

interface Player { id: number; name: string; avatar_color: string; }
interface Ev { id: number; title: string; type: string; date: string; time: string; description: string; map: string; }
interface Avail { player_id: number; player_name: string; status: string; avatar_color: string; }

export default function AvailabilityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [avail, setAvail] = useState<Record<number, Avail[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", type: "match", date: "", time: "21:00", description: "", map: "" });
  const [activePlayer, setActivePlayer] = useState<number>(1);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(d => { setPlayers(d.players || []); if (d.players?.[0]) setActivePlayer(d.players[0].id); });
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error(`Events API failed: ${res.status}`);
      const d = await res.json();
      const loadedEvents: Ev[] = d.events || [];
      setEvents(loadedEvents);
      
      const availMap: Record<number, Avail[]> = {};
      
      // Cargamos disponibilidades de forma secuencial pero segura
      for (const ev of loadedEvents) {
        try {
          const r2 = await fetch(`/api/availability?event_id=${ev.id}`);
          if (r2.ok) {
            const d2 = await r2.json();
            availMap[ev.id] = d2.availability || [];
          } else {
            console.warn(`Disponibilidad no encontrada para evento ${ev.id}`);
            availMap[ev.id] = [];
          }
        } catch (err) {
          console.error(`Error al parsear disponibilidad de evento ${ev.id}:`, err);
          availMap[ev.id] = [];
        }
      }
      setAvail(availMap);
    } catch (err) {
      console.error("Error cargando eventos:", err);
    }
  };

  const createEvent = async () => {
    if (!form.title || !form.date) return;
    await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowNew(false);
    setForm({ title: "", type: "match", date: "", time: "21:00", description: "", map: "" });
    loadEvents();
  };

  const setAvailability = async (eventId: number, status: string) => {
    await fetch("/api/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: eventId, player_id: activePlayer, status }) });
    loadEvents();
  };

  const deleteEvent = async (id: number) => {
    await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    loadEvents();
  };

  const statusIcon = (s: string) => s === "available" ? "✅" : s === "maybe" ? "⚠️" : s === "unavailable" ? "❌" : "⏳";
  const upcoming = events.filter(e => new Date(e.date) >= new Date(new Date().toDateString()));
  const past = events.filter(e => new Date(e.date) < new Date(new Date().toDateString()));

  return (
    <>
      <div className="page-header">
        <h2>📅 Disponibilidad</h2>
        <p>Gestiona eventos y confirma asistencia</p>
      </div>
      <div className="page-content animate-in">
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nuevo Evento</button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Jugando como:</span>
          <select value={activePlayer} onChange={e => setActivePlayer(Number(e.target.value))} style={{ width: "auto" }}>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {upcoming.length === 0 && <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>No hay eventos próximos.</p>}

        {upcoming.map(ev => {
          const ea = avail[ev.id] || [];
          const confirmed = ea.filter(a => a.status === "available").length;
          const myStatus = ea.find(a => a.player_id === activePlayer)?.status || "pending";
          return (
            <div key={ev.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{ev.title}</h3>
                    <span className={`tag ${ev.type === "match" ? "tag-red" : "tag-green"}`}>{ev.type === "match" ? "Partido" : "Práctica"}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    📅 {new Date(ev.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · ⏰ {ev.time}
                    {ev.map && <> · 🗺️ {MAPS.find(m => m.id === ev.map)?.name || ev.map}</>}
                  </div>
                  {ev.description && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{ev.description}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteEvent(ev.id)}>🗑️</button>
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
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4, alignSelf: "center" }}>Tu respuesta:</span>
                {["available", "maybe", "unavailable"].map(s => (
                  <button key={s} className={`btn btn-sm ${myStatus === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setAvailability(ev.id, s)}>
                    {statusIcon(s)} {s === "available" ? "Disponible" : s === "maybe" ? "Quizás" : "No puedo"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {past.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12, color: "var(--text-muted)" }}>Eventos pasados</h3>
            {past.slice(0, 5).map(ev => (
              <div key={ev.id} className="card" style={{ marginBottom: 8, opacity: 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14 }}>{ev.title}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(ev.date).toLocaleDateString("es-ES")}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {showNew && (
          <div className="modal-overlay" onClick={() => setShowNew(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Nuevo Evento</h3>
              <div className="form-group"><label>Título</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Premier Semana 3" /></div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}><label>Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="match">Partido</option><option value="practice">Práctica</option></select></div>
                <div className="form-group" style={{ flex: 1 }}><label>Mapa</label><select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}><option value="">Sin definir</option>{MAPS.filter(m => m.competitive).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
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
