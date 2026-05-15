"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Team {
  id: string;
  name: string;
  slug: string;
  _count: {
    players: number;
    users: number;
  };
  created_at: string;
}

export default function AdminTeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", slug: "" });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/admin/teams");
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTeam),
      });
      if (res.ok) {
        setShowModal(false);
        setNewTeam({ name: "", slug: "" });
        fetchTeams();
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">No tienes permiso para ver esta página.</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Gestión de Equipos</h1>
          <p style={{ color: "var(--text-secondary)" }}>Administra los equipos y organizaciones de la plataforma</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Crear Equipo
        </button>
      </header>

      {loading ? (
        <div className="loading-state">Cargando equipos...</div>
      ) : (
        <div className="grid grid-3">
          {teams.map((team) => (
            <div key={team.id} className="card team-card" style={{ padding: 24, position: "relative" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  background: "var(--val-red)", 
                  borderRadius: 8, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800
                }}>
                  {team.name[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{team.name}</h3>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>/{team.slug}</span>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="stat-box" style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{team._count.players}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>JUGADORES</div>
                </div>
                <div className="stat-box" style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{team._count.users}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>USUARIOS</div>
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Creado el {new Date(team.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: 400 }}>
            <h2>Nuevo Equipo</h2>
            <form onSubmit={createTeam}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Nombre del Equipo</label>
                <input 
                  className="input-field"
                  placeholder="Ej: KRÜ Esports" 
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Slug (Identificador)</label>
                <input 
                  className="input-field"
                  placeholder="kru-esports" 
                  value={newTeam.slug}
                  onChange={(e) => setNewTeam({ ...newTeam, slug: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .team-card:hover {
          transform: translateY(-4px);
          border-color: var(--val-red);
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}
