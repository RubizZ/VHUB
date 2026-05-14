"use client";
import { useEffect, useState } from "react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; }
interface Event { id: number; title: string; type: string; date: string; time: string; description: string; }

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [msgCount, setMsgCount] = useState(0);
  const [stratCount, setStratCount] = useState(0);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || []));
    fetch("/api/events").then(r => r.json()).then(d => setEvents(d.events || []));
    fetch("/api/chat?channel=general&limit=1").then(r => r.json()).then(d => setMsgCount(d.total || 0));
    fetch("/api/strategies").then(r => r.json()).then(d => setStratCount(d.strategies?.length || 0));
  }, []);

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const roleColors: Record<string, string> = { duelist: '#FF4655', initiator: '#00D4AA', controller: '#A855F7', sentinel: '#3B82F6', flex: '#F59E0B' };
  const roleLabels: Record<string, string> = { duelist: 'DUE', initiator: 'INI', controller: 'CON', sentinel: 'SEN', flex: 'FLX' };

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Panel de control del equipo 7R</p>
      </div>
      <div className="page-content animate-in">
        <div className="grid grid-4" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="stat-value">{players.length}</div>
            <div className="stat-label">Jugadores</div>
          </div>
          <div className="card">
            <div className="stat-value">{stratCount}</div>
            <div className="stat-label">Estrategias</div>
          </div>
          <div className="card">
            <div className="stat-value">{upcomingEvents.length}</div>
            <div className="stat-label">Próximos eventos</div>
          </div>
          <div className="card">
            <div className="stat-value">{msgCount}</div>
            <div className="stat-label">Mensajes</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">👥 Equipo</h3>
              <a href="/settings" className="btn btn-ghost btn-sm">Gestionar</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: "var(--bg-glass)" }}>
                  <div className="chat-avatar" style={{ background: p.avatar_color, color: "#fff", width: 32, height: 32, fontSize: 12 }}>
                    {p.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    {p.riot_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.riot_name}#{p.riot_tag}</div>}
                  </div>
                  <span className="tag" style={{ background: `${roleColors[p.role]}22`, color: roleColors[p.role] }}>
                    {roleLabels[p.role] || 'FLX'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📅 Próximos Eventos</h3>
              <a href="/availability" className="btn btn-ghost btn-sm">Ver todos</a>
            </div>
            {upcomingEvents.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No hay eventos próximos. Crea uno desde Disponibilidad.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcomingEvents.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--bg-glass)", borderLeft: `3px solid ${e.type === "match" ? "var(--val-red)" : "var(--val-cyan)"}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(e.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} · {e.time}
                      </div>
                    </div>
                    <span className={`tag ${e.type === "match" ? "tag-red" : "tag-green"}`} style={{ marginLeft: "auto" }}>
                      {e.type === "match" ? "Partido" : "Práctica"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">🚀 Acceso Rápido</h3>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/strategies" className="btn btn-primary">🗺️ Nueva Estrategia</a>
            <a href="/availability" className="btn btn-secondary">📅 Marcar Disponibilidad</a>
            <a href="/chat" className="btn btn-secondary">💬 Abrir Chat</a>
            <a href="/stats" className="btn btn-secondary">📊 Ver Estadísticas</a>
          </div>
        </div>
      </div>
    </>
  );
}
