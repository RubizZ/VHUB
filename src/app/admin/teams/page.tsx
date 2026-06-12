 
 
"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PREMIER_DIVISIONS } from "@/lib/premier-divisions";

interface Team {
  id: string;
  name: string;
  slug: string;
  inviteCode?: string;
  premierTeam?: {
    name: string;
    conference: string;
    tag?: string;
    division?: number;
  };
  logo_url?: string;
  matchHistoryConsent?: boolean;
  calendarToken?: string;
  _count: {
    players: number;
    users: number;
  };
  created_at: string;
}

export default function AdminTeamsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", slug: "", conference: "EMEA", tag: "", logo_url: "", division: "" as string | number });

  // 1. Fetch Teams Query
  const {
    data: teamsData,
    isLoading: teamsLoading
  } = useQuery<{ teams: Team[] }>({
    queryKey: ["adminTeams"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Error loading teams");
      return res.json();
    },
    enabled: session?.user?.role === "super_admin",
  });

  const teams = teamsData?.teams || [];
  const loading = teamsLoading;

  const handleOpenCreate = () => {
    setEditingTeam(null);
    setFormData({ name: "", slug: "", conference: "EMEA", tag: "", logo_url: "", division: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({ 
      name: team.name, 
      slug: team.slug, 
      conference: team.premierTeam?.conference || "EMEA", 
      tag: team.premierTeam?.tag || "",
      logo_url: team.logo_url || "",
      division: team.premierTeam?.division || ""
    });
    setShowModal(true);
  };

  // 2. Save Team Mutation (Create/Edit)
  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      const method = editingTeam ? "PUT" : "POST";
      const url = editingTeam ? `/api/admin/teams/${editingTeam.id}` : "/api/admin/teams";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Error saving team");
      return res.json();
    },
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ["adminTeams"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTeamMutation.mutate();
  };

  // 3. Delete Team Mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error deleting team");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTeams"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    }
  });

  const handleDelete = (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este equipo? Esta acción es irreversible y eliminará todos los datos asociados.")) return;
    deleteTeamMutation.mutate(id);
  };

  const isDeleting = deleteTeamMutation.isPending ? deleteTeamMutation.variables : null;

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">Acceso restringido.</div>;
  }

  return (
    <div className="admin-wrapper">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
        <div>
          <span className="badge" style={{ background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", marginBottom: 8 }}>PLATFORM MANAGEMENT</span>
          <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Organizaciones</h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Control de equipos y entidades competitivas</p>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
           <div style={{ position: "relative" }}>
             <input 
               type="text" 
               className="input-field" 
               placeholder="Buscar por nombre o slug..." 
               style={{ width: 320, paddingLeft: 40, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: "absolute", left: 14, top: 15, color: "var(--text-muted)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
           </div>
           <button className="btn btn-primary" style={{ height: 48, padding: "0 24px", borderRadius: 12, fontWeight: 800 }} onClick={handleOpenCreate}>
             + Nueva Organización
           </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-3" style={{ gap: 24 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} width="100%" height={280} style={{ borderRadius: 24 }} />)}
        </div>
      ) : (
        <div className="grid grid-3" style={{ gap: 32 }}>
          {filteredTeams.map((team) => (
            <div key={team.id} className="team-premium-card card glass-card">
              <div className="card-top-glow" />
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, position: "relative" }}>
                <div style={{ 
                  width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, var(--val-red) 0%, #991b1b 100%)", 
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#fff",
                  boxShadow: "0 10px 20px rgba(255, 70, 85, 0.3)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden"
                }}>
                  {team.logo_url ? <img src={team.logo_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : team.name[0]}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                   <button className="icon-action-btn" onClick={() => handleOpenEdit(team)}>✏️</button>
                </div>
              </div>

              <div style={{ marginBottom: 20, position: "relative" }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>{team.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace" }}>/{team.slug}</span>
                  {team.premierTeam?.tag && <span className="tag-badge">#{team.premierTeam.tag}</span>}
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 12, display: "flex", flexDirection: "column", gap: 8, border: "1px solid rgba(255,255,255,0.03)" }}>
                {team.premierTeam?.name && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>NOMBRE PREMIER</span>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{team.premierTeam.name}</span>
                  </div>
                )}
                {team.inviteCode && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>CÓDIGO INVITACIÓN</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--val-yellow)" }}>{team.inviteCode}</span>
                  </div>
                )}
              </div>

              <div className="team-stats-grid">
                <div className="team-stat-item">
                  <div className="value" style={{ color: "var(--val-cyan)" }}>{team._count.players}</div>
                  <div className="label">JUGADORES</div>
                </div>
                <div className="team-stat-item">
                  <div className="value" style={{ color: "var(--val-purple)" }}>{team._count.users}</div>
                  <div className="label">USUARIOS</div>
                </div>
              </div>

              <div className="team-card-footer">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                   <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-cyan)" }} />
                   <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", letterSpacing: 1 }}>
                     {team.premierTeam?.conference?.toUpperCase() || "NONE"}
                     {team.premierTeam?.division ? ` - DIV ${team.premierTeam.division}` : ""}
                   </span>
                </div>
                <button 
                  className="delete-btn" 
                  onClick={() => handleDelete(team.id)}
                  disabled={isDeleting === team.id}
                >
                  {isDeleting === team.id ? "BORRANDO..." : "ELIMINAR"}
                </button>
              </div>
            </div>
          ))}
          {filteredTeams.length === 0 && (
             <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 100 }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>🔍</div>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>No se encontraron resultados</h3>
                <p style={{ color: "var(--text-muted)" }}>Intenta con otro término de búsqueda</p>
             </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content card glass-card premium-modal" style={{ maxWidth: 500, width: "95%" }}>
            <div style={{ marginBottom: 32 }}>
               <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{editingTeam ? "Editar Equipo" : "Nueva Organización"}</h2>
               <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Completa la información técnica de la entidad</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Nombre Comercial</label>
                <input 
                  className="input-field"
                  placeholder="Ej: KRÜ Esports" 
                  style={{ height: 48, borderRadius: 12 }}
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({ 
                      ...formData, 
                      name, 
                      slug: editingTeam ? formData.slug : name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") 
                    });
                  }}
                  required
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Identificador URL (Slug)</label>
                <input 
                  className="input-field"
                  placeholder="kru-esports" 
                  style={{ height: 48, borderRadius: 12 }}
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Logo URL</label>
                <input 
                  className="input-field"
                  placeholder="https://..." 
                  style={{ height: 48, borderRadius: 12 }}
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
              </div>
              
              <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 32 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Región / Conf.</label>
                  <select className="input-field" style={{ height: 48, borderRadius: 12 }} value={formData.conference} onChange={(e) => setFormData({ ...formData, conference: e.target.value })}>
                    <option value="NONE">Sin Región</option>
                    <option value="EMEA">EMEA</option>
                    <option value="Americas">Americas</option>
                    <option value="Pacific">Pacific</option>
                    <option value="CN">China</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Tag Oficial</label>
                  <input 
                    className="input-field"
                    placeholder="Ej: KRU" 
                    style={{ height: 48, borderRadius: 12 }}
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>División</label>
                  <select 
                    className="input-field" 
                    style={{ height: 48, borderRadius: 12 }} 
                    value={formData.division || ""} 
                    onChange={e => setFormData({ ...formData, division: e.target.value ? Number(e.target.value) : "" })}
                  >
                    <option value="">Ninguna</option>
                    {PREMIER_DIVISIONS.map(div => (
                      <option key={div.id} value={div.id}>{div.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: 16 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, height: 48, borderRadius: 12, fontWeight: 800 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: 48, borderRadius: 12, fontWeight: 800 }} disabled={saveTeamMutation.isPending}>
                   {saveTeamMutation.isPending ? "Procesando..." : editingTeam ? "Actualizar" : "Crear Entidad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-wrapper {
          max-width: 1400px;
          margin: 0 auto;
        }
        .team-premium-card {
          padding: 32px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .team-premium-card:hover {
          transform: translateY(-10px);
          border-color: var(--val-red);
          background: rgba(255, 70, 85, 0.02);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 20px rgba(255, 70, 85, 0.1);
        }
        .card-top-glow {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 100px;
          background: linear-gradient(to bottom, rgba(255, 70, 85, 0.05), transparent);
          pointer-events: none;
        }
        .tag-badge {
          background: rgba(255,255,255,0.05);
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-secondary);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .team-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        .team-stat-item {
          background: rgba(255,255,255,0.02);
          padding: 16px;
          border-radius: 16px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .team-stat-item .value { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
        .team-stat-item .label { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }
        
        .team-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .delete-btn {
          background: transparent;
          border: none;
          color: rgba(255, 70, 85, 0.5);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .delete-btn:hover { color: var(--val-red); }
        
        .icon-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-action-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); }
        
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .premium-modal {
          padding: 40px;
          border-radius: 32px;
          box-shadow: 0 40px 100px rgba(0,0,0,0.8);
        }
      `}</style>
    </div>
  );
}
