"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface AdminStats {
  teams: number;
  players: number;
  users: number;
}

interface RecentTeam {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  _count: { players: number };
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTeams, setRecentTeams] = useState<RecentTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data.stats);
        setRecentTeams(data.recentTeams);
        setLoading(false);
      });
  }, []);

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">Acceso restringido. Solo para administradores globales.</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>📈 Panel de Control Global</h1>
        <p style={{ color: "var(--text-secondary)" }}>Visión general del ecosistema 7R Premier Hub</p>
      </header>

      {loading ? (
        <div className="loading-state">Analizando datos globales...</div>
      ) : (
        <div className="animate-in">
          {/* KPIs */}
          <div className="grid grid-3" style={{ marginBottom: 32 }}>
            <div className="card" style={{ padding: 24, textAlign: "center", borderBottom: "4px solid var(--val-red)" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "1px" }}>EQUIPOS TOTALES</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{stats?.teams}</div>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center", borderBottom: "4px solid var(--val-cyan)" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "1px" }}>JUGADORES ACTIVOS</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{stats?.players}</div>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center", borderBottom: "4px solid #A855F7" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "1px" }}>USUARIOS REGISTRADOS</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>{stats?.users}</div>
            </div>
          </div>

          <div className="grid grid-2">
            {/* Equipos Recientes */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: 20, borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Nuevas Organizaciones</h3>
                <Link href="/admin/teams" style={{ fontSize: "0.8rem", color: "var(--val-red)", fontWeight: 700 }}>VER TODOS</Link>
              </div>
              <div style={{ padding: 10 }}>
                {recentTeams.map(team => (
                  <div key={team.id} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 12, 
                    padding: "12px 16px", 
                    borderRadius: 8,
                    marginBottom: 4,
                    background: "rgba(255,255,255,0.02)"
                  }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 4, background: "var(--val-red)", 
                      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12
                    }}>
                      {team.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{team.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{team._count.players} jugadores</div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(team.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accesos Rápidos */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Acciones Rápidas</h3>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <Link href="/admin/teams" className="btn btn-secondary" style={{ textAlign: "center", padding: "20px 10px" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🏢</div>
                  Registrar Equipo
                </Link>
                <div className="btn btn-secondary" style={{ textAlign: "center", padding: "20px 10px", opacity: 0.5, cursor: "not-allowed" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⚙️</div>
                  Configuración Global
                </div>
              </div>
              <div style={{ marginTop: 24, padding: 16, background: "rgba(0,212,170,0.05)", borderRadius: 12, border: "1px solid rgba(0,212,170,0.1)" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--val-cyan)" }}>Estado del Sistema</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--val-cyan)" }}></div>
                  Todos los servicios operativos
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
