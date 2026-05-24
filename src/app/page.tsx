/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PREMIER_DIVISIONS } from "@/lib/premier-divisions";
import { Skeleton } from "@/components/Skeleton";
import { LandingPage } from "@/components/LandingPage";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; user?: { lastActiveAt?: string }; }
interface Event { id: number; title: string; type: string; date: string; time: string; description: string; availability?: any[]; }

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [msgCount, setMsgCount] = useState(0);
  const [stratCount, setStratCount] = useState(0);
  const [activeStrats, setActiveStrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const fetchData = async () => {
      try {
        const [playersRes, eventsRes, chatRes, stratsRes, matchesRes] = await Promise.all([
          fetch("/api/players").then(async r => { if (!r.ok) return { players: [] }; const text = await r.text(); return text ? JSON.parse(text) : { players: [] }; }),
          fetch("/api/events").then(async r => { if (!r.ok) return { events: [] }; const text = await r.text(); return text ? JSON.parse(text) : { events: [] }; }),
          fetch("/api/chat?channel=general&limit=1").then(async r => { if (!r.ok) return { total: 0 }; const text = await r.text(); return text ? JSON.parse(text) : { total: 0 }; }),
          fetch("/api/strategies").then(async r => { if (!r.ok) return { strategies: [] }; const text = await r.text(); return text ? JSON.parse(text) : { strategies: [] }; }),
          fetch("/api/matches").then(async r => { if (!r.ok) return { matches: [] }; const text = await r.text(); return text ? JSON.parse(text) : { matches: [] }; })
        ]);

        setPlayers(playersRes.players || []);
        setEvents(eventsRes.events || []);
        setMsgCount(chatRes.total || 0);
        setStratCount(stratsRes.strategies?.length || 0);
        setActiveStrats(stratsRes.strategies?.filter((s: any) => s.active_users?.length > 0) || []);
        setMatches(matchesRes.matches || []);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [status, session]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);
  }, [events]);

  const recentMatches = useMemo(() => {
    return matches.slice(0, 4);
  }, [matches]);

  const confirmedEventsCount = useMemo(() => {
    return events.filter(e => {
      const isUpcoming = new Date(e.date) >= new Date(new Date().toDateString());
      if (!isUpcoming) return false;
      const confirmed = e.availability?.filter((a: any) => a.status === 'available').length || 0;
      return confirmed >= 5;
    }).length;
  }, [events]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px", background: "var(--bg-primary)" }}>
        <div className="landing-brand-icon" style={{ animation: "pulseGlow 2s infinite ease-in-out", width: "50px", height: "50px", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--val-red), var(--val-red-dark))", borderRadius: "var(--radius-sm)", fontWeight: "900", color: "#fff" }}>V</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "var(--font-valorant)", letterSpacing: "1.5px" }}>CARGANDO VHUB...</div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user?.id) {
    return <LandingPage />;
  }

  return (
    <div className="dashboard-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Bienvenido de nuevo, {session?.user?.name?.split(' ')[0]}</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Aquí tienes el resumen de tu equipo para hoy.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              Sincronizar
            </button>
          </div>
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0 }}>

        {/* Premier Status Highlight */}
        <PremierStats />

        {activeStrats.length > 0 ? (
          <div key="live-banner" className="card glass-card" style={{ marginBottom: 24, borderLeft: "4px solid var(--val-red)", background: "linear-gradient(90deg, rgba(255, 70, 85, 0.05) 0%, rgba(20, 20, 26, 0.1) 100%)", boxShadow: "0 0 20px rgba(255, 70, 85, 0.1)" }}>
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <h3 className="card-title" style={{ display: "flex", alignItems: "center", color: "var(--val-red)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 800, fontSize: 14 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--val-red)", borderRadius: "50%", marginRight: 10, animation: "pulseGlow 1.5s infinite ease-in-out", boxShadow: "0 0 10px var(--val-red)" }}></span>
                LIVE: Editando Estrategia
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeStrats.map(s => (
                <Link href={`/strategies?strategy=${s.id}`} key={s.id} className="hover-lift" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", textDecoration: "none", color: "inherit", border: "1px solid rgba(255,70,85,0.2)" }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 24, background: "rgba(255, 70, 85, 0.1)", width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>🗺️</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Editándose en directo ahora mismo</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--val-red)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{s.active_users.length} Miembros dentro</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {s.active_users.map((u: any, i: number) => (
                        <div key={u.userId} style={{
                          width: 32, height: 32, borderRadius: "50%", background: u.userColor || "#555",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff",
                          border: "2px solid rgba(20,20,26,1)",
                          marginLeft: i > 0 ? -12 : 0,
                          position: "relative",
                          zIndex: 10 - i,
                          boxShadow: "0 2px 5px rgba(0,0,0,0.5)"
                        }} title={u.userName}>
                          {u.userName.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div style={{ color: "var(--val-red)", fontSize: 18, marginLeft: 8, fontWeight: 700 }}>→</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div key="quick-stats-row" className="grid grid-4" style={{ marginBottom: 32, gap: 16 }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card">
                  <Skeleton width={32} height={32} style={{ marginBottom: 8 }} />
                  <Skeleton width="40%" height={28} style={{ marginBottom: 4 }} />
                  <Skeleton width="60%" height={12} />
                </div>
              ))
            ) : (
              <>
                <QuickStatCard value={players.length} label="Integrantes" icon="👥" color="var(--val-cyan)" href="/team/roster" />
                <QuickStatCard value={stratCount} label="Estrategias" icon="🗺️" color="var(--val-purple)" href="/strategies" />
                <QuickStatCard value={confirmedEventsCount} label="Eventos Confirmados" icon="✅" color="var(--val-yellow)" href="/availability" />
                <QuickStatCard value={msgCount} label="Mensajes" icon="💬" color="var(--val-blue)" href="/chat" />
              </>
            )}
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          {/* Main Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Upcoming Events */}
              <div className="card glass-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Próximos Eventos
                  </h3>
                  <Link href="/availability" className="btn btn-ghost btn-sm">Ver agenda completa</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, padding: "8px 12px" }}>
                        <Skeleton width={36} height={36} style={{ borderRadius: 8 }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <Skeleton width="80%" height={13} />
                          <Skeleton width="50%" height={11} />
                        </div>
                      </div>
                    ))
                  ) : upcomingEvents.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>Sin eventos próximos</p>
                  ) : (
                    <>
                      {upcomingEvents.map(e => (
                        <EventItem key={e.id} event={e} />
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Recent Matches */}
              <div className="card glass-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                    Partidos Recientes
                  </h3>
                  <Link href="/matches" className="btn btn-ghost btn-sm">Ver historial</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}>
                        <Skeleton width={4} height={40} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <Skeleton width="40%" height={14} />
                          <Skeleton width="20%" height={10} />
                        </div>
                        <Skeleton width={60} height={20} />
                      </div>
                    ))
                  ) : recentMatches.length === 0 ? (
                    <EmptyState message="No se han registrado partidos todavía." />
                  ) : (
                    recentMatches.map((m: any) => (
                      <MatchRow key={m.id} match={m} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Roster Preview */}
            <div className="card glass-card">
              <div className="card-header">
                <h3 className="card-title">👥 Plantilla</h3>
                <Link href="/team/roster" className="btn btn-ghost btn-sm">Gestionar</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                      <Skeleton width={28} height={28} circle />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                        <Skeleton width="60%" height={13} />
                        <Skeleton width="40%" height={10} />
                      </div>
                    </div>
                  ))
                ) : [...players].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                  <Link href={`/player/${p.id}`} key={p.id} className="hover-lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", textDecoration: "none", color: "inherit" }}>
                    <div style={{ background: p.avatar_color, color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {p.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{p.role}</div>
                    </div>
                    {p.user?.lastActiveAt && (new Date().getTime() - new Date(p.user.lastActiveAt).getTime()) < 3 * 60 * 1000 ? (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--val-cyan)", boxShadow: "0 0 10px var(--val-cyan)" }} title="En Línea" />
                    ) : (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255, 255, 255, 0.2)" }} title="Desconectado" />
                    )}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function QuickStatCard({ value, label, icon, color, href }: any) {
  return (
    <Link href={href} className="card hover-lift stat-card" style={{ '--glow-color': color, textDecoration: "none", color: "inherit" } as any}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
    </Link>
  );
}

function MatchRow({ match }: { match: any }) {
  const isWin = match.team_blue_won === (match.our_team_side === 'Blue');
  return (
    <Link href={`/matches?id=${match.id}`} className="hover-lift" style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "12px 16px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--border-color)",
      position: "relative",
      overflow: "hidden",
      textDecoration: "none",
      color: "inherit"
    }}>
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: isWin ? "var(--val-cyan)" : "var(--val-red)"
      }} />

      <div style={{ flexShrink: 0, textAlign: "center", width: 40 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: isWin ? "var(--val-cyan)" : "var(--val-red)" }}>{isWin ? "V" : "D"}</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{match.team_blue_score} - {match.team_red_score}</div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{match.map_name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{match.game_mode} • {new Date(match.game_start).toLocaleDateString()}</div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{match.queue_id === 'Competitive' ? 'Premier' : match.queue_id}</div>
        <div style={{ fontSize: 11, color: "var(--val-red)", fontWeight: 700 }}>DETALLES →</div>
      </div>
    </Link>
  );
}

function EventItem({ event }: { event: any }) {
  const isMatch = event.type === 'match' || event.type === 'playoffs';
  const attendees = (event.availability?.filter((a: any) => a.status === 'available' || a.status === 'maybe') || [])
    .sort((a: any, b: any) => a.status === 'available' ? -1 : 1);

  return (
    <Link href="/availability" className="hover-lift" style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", textDecoration: "none", color: "inherit", marginBottom: 4 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: isMatch ? "rgba(133, 107, 77, 0.2)" : "rgba(184, 184, 184, 0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0
      }}>
        <span style={{ fontSize: 16 }}>{isMatch ? "🔥" : "🎯"}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {event.title || (event.type === 'match' ? 'Partido Premier' : event.type === 'practice' ? 'Práctica Premier' : event.type === 'playoffs' ? 'Playoffs Premier' : 'Evento')}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {new Date(`${event.date}T${event.time}:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} • {new Date(`${event.date}T${event.time}:00Z`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
      </div>
      
      {attendees.length > 0 && (
        <div style={{ display: "flex", gap: -4, alignItems: "center", flexShrink: 0 }}>
          {attendees.map((a: any) => (
            <div key={a.player?.id || a.player_id} style={{
              width: 22, height: 22, borderRadius: "50%", background: a.player?.avatar_color || "#555",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff",
              border: a.status === 'available' ? "2px solid var(--val-cyan)" : "2px solid var(--val-yellow)",
              boxSizing: "border-box",
              marginLeft: -6,
              position: "relative"
            }} title={`${a.player?.name || 'User'} (${a.status})`}>
              {a.player?.name?.charAt(0) || "?"}
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function ActionCard({ title, desc, href, icon, color }: any) {
  return (
    <Link href={href} className="card hover-lift" style={{
      background: `linear-gradient(135deg, ${color}11 0%, rgba(20, 20, 26, 0.5) 100%)`,
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: 16
    }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{desc}</div>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
      <p style={{ fontSize: 13 }}>{message}</p>
    </div>
  );
}

function PremierStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team/premier")
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching premier stats:", err);
        setError("Error de conexión con el servidor");
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div key="premier-loading" className="grid grid-3" style={{ marginBottom: 32, gap: 20 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`psk-${i}`} className="card" style={{ height: 140 }}>
          <Skeleton width="40%" height={11} style={{ marginBottom: 12 }} />
          <Skeleton width="30%" height={32} style={{ marginBottom: 16 }} />
          <Skeleton width="80%" height={12} />
        </div>
      ))}
    </div>
  );

  if (error) {
    return (
      <div key="premier-error" className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--val-yellow)", background: "rgba(245, 158, 11, 0.05)", animation: "none", transition: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--val-yellow)" }}>Estado de Premier</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{error}</div>
          </div>
          <a href="/team/settings" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>Configurar</a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { details, leaderboard, config } = data;
  const winRate = details?.stats?.matches > 0 ? Math.round((details.stats.wins / details.stats.matches) * 100) : 0;
  const myRank = leaderboard?.find((e: any) => e.name === config.name);

  return (
    <div key="premier-data" className="grid grid-3" style={{ marginBottom: 32, gap: 20 }}>
      <Link href="/team/settings" className="card stat-card hover-lift" style={{ background: "linear-gradient(135deg, rgba(255, 70, 85, 0.08) 0%, rgba(20, 20, 20, 0) 100%)", borderLeft: "4px solid var(--val-red)", '--glow-color': 'var(--val-red)', textDecoration: "none", color: "inherit" } as any}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Puntos de Temporada</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--val-red)", marginTop: 4 }}>{details?.placement?.points || 0}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
            {PREMIER_DIVISIONS.find(d => d.id === (details?.placement?.division || config.division))?.name || `DIV ${details?.placement?.division || config.division}`}
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
          {details?.placement?.points >= 600 ? "🏆 Clasificados para Playoffs" : `${600 - (details?.placement?.points || 0)} pts para clasificar`}
        </div>
      </Link>

      <Link href="/matches" className="card stat-card hover-lift" style={{ background: "linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(20, 20, 20, 0) 100%)", borderLeft: "4px solid var(--val-cyan)", '--glow-color': 'var(--val-cyan)', textDecoration: "none", color: "inherit" } as any}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Rendimiento</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--val-cyan)" }}>{winRate}%</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Victoria / Derrota</div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <div style={{ fontSize: 12 }}><span style={{ color: "var(--val-cyan)" }}>{details?.stats?.wins || 0}</span> W</div>
          <div style={{ fontSize: 12 }}><span style={{ color: "var(--val-red)" }}>{details?.stats?.losses || 0}</span> L</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{details?.stats?.matches || 0} Jugados</div>
        </div>
      </Link>

      <Link href="/team/settings" className="card stat-card hover-lift" style={{ background: "linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(20, 20, 20, 0) 100%)", borderLeft: "4px solid var(--val-gold)", '--glow-color': 'var(--val-gold)', textDecoration: "none", color: "inherit" } as any}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Clasificación División</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--val-gold)" }}>#{details?.placement?.place || myRank?.ranking || "---"}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Ranking actual</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
          En <span style={{ color: "white" }}>{details?.placement?.conference || config.conference}</span>
        </div>
      </Link>
    </div>
  );
}
