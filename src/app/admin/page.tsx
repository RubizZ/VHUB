"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

interface AdminStats {
  teams: number;
  players: number;
  users: number;
  matches: number;
}

interface RecentTeam {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  _count: { players: number };
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team?: { name: string };
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTeams, setRecentTeams] = useState<RecentTeam[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data.stats);
        setRecentTeams(data.recentTeams);
        setRecentUsers(data.recentUsers);
        setLoading(false);
      });
  }, []);

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">Acceso restringido. Solo para administradores globales.</div>;
  }

  return (
    <div className="admin-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <span className="badge" style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", marginBottom: 8 }}>SUPER ADMIN AREA</span>
            <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Control Central</h1>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Monitorización global de la plataforma V-HUB</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
             <Link href="/admin/users" className="btn btn-secondary" style={{ backdropFilter: "blur(10px)" }}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               Usuarios
             </Link>
             <Link href="/admin/teams" className="btn btn-primary">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
               Organizaciones
             </Link>
          </div>
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0 }}>
        {loading ? (
          <>
            <div className="grid grid-4" style={{ marginBottom: 32, gap: 20 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={140} style={{ borderRadius: 20 }} />)}
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
               <Skeleton width="100%" height={500} />
               <Skeleton width="100%" height={500} />
            </div>
          </>
        ) : (
          <>
            {/* KPI Section */}
            <div className="grid grid-4" style={{ marginBottom: 40, gap: 20 }}>
              <AdminMetricCard label="Organizaciones" value={stats?.teams} sub="Equipos registrados" color="var(--val-red)" icon="🏢" />
              <AdminMetricCard label="Jugadores" value={stats?.players} sub="Perfiles activos" color="var(--val-cyan)" icon="👥" />
              <AdminMetricCard label="Usuarios" value={stats?.users} sub="Cuentas totales" color="var(--val-purple)" icon="👤" />
              <AdminMetricCard label="Partidos" value={stats?.matches} sub="Encuentros jugados" color="var(--val-gold)" icon="🎮" />
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* Left Column: Recent Activity */}
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                
                <div className="card glass-card premium-border" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nuevas Organizaciones</h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Últimos equipos incorporados</p>
                    </div>
                    <Link href="/admin/teams" className="btn btn-ghost btn-sm" style={{ fontWeight: 800 }}>VER TODAS</Link>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {recentTeams.map((team, idx) => (
                      <div key={team.id} className="admin-list-item" style={{ 
                        display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", transition: "all 0.3s ease",
                        borderBottom: idx === recentTeams.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)"
                      }}>
                        <div style={{ 
                          width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${idx % 2 === 0 ? 'var(--val-red)' : 'var(--val-cyan)'}22 0%, transparent 100%)`, 
                          color: idx % 2 === 0 ? 'var(--val-red)' : 'var(--val-cyan)',
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, border: "1px solid rgba(255,255,255,0.05)"
                        }}>
                          {team.name[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{team.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                            <span style={{ color: "var(--val-red)", fontWeight: 700 }}>{team._count.players}</span> jugadores registrados
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                           <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                             {new Date(team.created_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                           </div>
                           <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>/{team.slug}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card glass-card premium-border">
                  <h3 style={{ marginBottom: 24, fontSize: 18, fontWeight: 800 }}>Mantenimiento del Sistema</h3>
                  <div className="grid grid-2" style={{ gap: 16 }}>
                    <AdminAction icon="🧹" label="Flush Cache" sub="Limpiar datos volátiles" />
                    <AdminAction icon="🔄" label="Sync Maps" sub="Fetch Riot Data" />
                    <AdminAction icon="🛡️" label="Audit Log" sub="Ver cambios recientes" />
                    <AdminAction icon="📋" label="DB Health" sub="Optimizar índices" />
                  </div>
                </div>

              </div>

              {/* Right Column: Users and Status */}
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                
                <div className="card glass-card premium-border" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Últimos Usuarios</h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Actividad de registro reciente</p>
                    </div>
                    <Link href="/admin/users" className="btn btn-ghost btn-sm" style={{ fontWeight: 800 }}>GESTIONAR</Link>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {recentUsers.map((user, idx) => (
                      <div key={user.id} className="admin-list-item" style={{ 
                        display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", transition: "all 0.3s ease",
                        borderBottom: idx === recentUsers.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)"
                      }}>
                        <div style={{ 
                          width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.03)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid var(--border-color)",
                          boxShadow: "inset 0 0 10px rgba(255,255,255,0.02)"
                        }}>
                          {user.name ? user.name[0] : "👤"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name || "Usuario V-HUB"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{user.email}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                           <span className={`role-badge ${user.role}`}>
                             {user.role === 'super_admin' ? 'SYSTEM' : user.role === 'team_admin' ? 'ORG' : 'USER'}
                           </span>
                           <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{user.team?.name || "Sin Equipo"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card glass-card premium-border" style={{ background: "linear-gradient(135deg, rgba(0, 212, 170, 0.05) 0%, rgba(20, 20, 26, 0.8) 100%)", border: "1px solid rgba(0, 212, 170, 0.2)" }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--val-cyan)" }}>Estado Crítico</h3>
                        <p style={{ fontSize: 12, color: "rgba(0, 212, 170, 0.6)", marginTop: 2 }}>Infraestructura en tiempo real</p>
                      </div>
                      <div className="pulse-indicator" />
                   </div>
                   
                   <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <SystemStatus label="Servicio de Autenticación" status="online" delay="42ms" />
                      <SystemStatus label="Base de Datos Principal" status="online" delay="12ms" />
                      <SystemStatus label="Proxy de Imágenes" status="online" delay="85ms" />
                      <SystemStatus label="API Riot Games" status="online" delay="156ms" />
                   </div>

                   <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                         <span style={{ color: "var(--text-secondary)" }}>Carga del Servidor</span>
                         <span style={{ fontWeight: 800 }}>14%</span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                         <div style={{ width: "14%", height: "100%", background: "var(--val-cyan)", boxShadow: "0 0 10px var(--val-cyan)" }} />
                      </div>
                   </div>
                </div>

              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .admin-wrapper {
          max-width: 1300px;
          margin: 0 auto;
        }
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .admin-list-item:hover {
          background: rgba(255,255,255,0.04) !important;
          cursor: pointer;
        }
        .role-badge {
          font-size: 9px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 1px;
        }
        .role-badge.super_admin { background: var(--val-red); color: #fff; }
        .role-badge.team_admin { background: var(--val-cyan); color: #000; }
        .role-badge.member { background: rgba(255,255,255,0.1); color: var(--text-secondary); }
        
        .pulse-indicator {
          width: 10px;
          height: 10px;
          background: var(--val-cyan);
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(0, 212, 170, 0.4);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 212, 170, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 212, 170, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 212, 170, 0); }
        }
      `}</style>
    </div>
  );
}

function AdminMetricCard({ label, value, sub, color, icon }: any) {
  return (
    <div className="card glass-card hover-lift premium-border" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 60, opacity: 0.05, filter: "grayscale(1)" }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 900, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{value || 0}</div>
      <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>{sub}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${color}, transparent)` }} />
    </div>
  );
}

function AdminAction({ icon, label, sub }: any) {
  return (
    <button className="btn btn-ghost" style={{ 
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 16px", 
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
    </button>
  );
}

function SystemStatus({ label, status, delay }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
         <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-cyan)" }} />
         <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ textAlign: "right" }}>
         <div style={{ fontSize: 11, fontWeight: 800, color: "var(--val-cyan)" }}>ONLINE</div>
         <div style={{ fontSize: 10, color: "rgba(0, 212, 170, 0.4)" }}>{delay}</div>
      </div>
    </div>
  );
}
