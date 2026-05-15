"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; }
interface Event { id: number; title: string; type: string; date: string; time: string; description: string; }

export default function Dashboard() {
  const { data: session } = useSession();
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
        <h1>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>Resumen de actividad y estado de la plantilla</p>
      </div>
      <div className="page-content animate-in">
        <div className="grid grid-4" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="stat-value">{players.length}</div>
            <div className="stat-label">Integrantes</div>
          </div>
          <div className="card">
            <div className="stat-value">{stratCount}</div>
            <div className="stat-label">Estrategias</div>
          </div>
          <div className="card">
            <div className="stat-value">{upcomingEvents.length}</div>
            <div className="stat-label">Próximos Eventos</div>
          </div>
          <div className="card">
            <div className="stat-value">{msgCount}</div>
            <div className="stat-label">Mensajes</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">👥 Plantilla</h3>
              <a href="/team/roster" className="btn btn-ghost btn-sm">Ver todos</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)" }}>
                  <div style={{ background: p.avatar_color, color: "#fff", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                    {p.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    {p.riot_name && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.riot_name}#{p.riot_tag}</div>}
                  </div>
                  <span className="tag" style={{ background: `${roleColors[p.role]}22`, color: roleColors[p.role], border: `1px solid ${roleColors[p.role]}44` }}>
                    {roleLabels[p.role] || 'FLX'}
                  </span>
                </div>
              ))}
              {players.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 20 }}>No hay jugadores registrados.</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📅 Próximos Eventos</h3>
              <a href="/availability" className="btn btn-ghost btn-sm">Agenda</a>
            </div>
            {upcomingEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                 <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No hay eventos próximos.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcomingEvents.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${e.type === "match" ? "var(--val-red)" : "var(--val-cyan)"}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
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
            <h3 className="card-title">🚀 Acciones de Equipo</h3>
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
