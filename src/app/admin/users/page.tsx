"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string;
  team?: { name: string };
}

interface Team {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ role: "member", teamId: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(res => res.json()),
      fetch("/api/admin/teams").then(res => res.json())
    ]).then(([userData, teamData]) => {
      setUsers(userData.users || []);
      setTeams(teamData.teams || []);
      setLoading(false);
    });
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ role: user.role, teamId: user.teamId || "" });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingUser.id, ...formData }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData, team: teams.find(t => t.id === formData.teamId) } : u));
        setEditingUser(null);
      }
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario definitivamente?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      if (res.ok) setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (session?.user?.role !== "super_admin") return <div className="p-20 text-center">Acceso restringido.</div>;

  return (
    <div className="admin-wrapper">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
        <div>
          <span className="badge" style={{ background: "rgba(168, 85, 247, 0.1)", color: "var(--val-purple)", marginBottom: 8 }}>USER PERMISSIONS</span>
          <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Gestión de Usuarios</h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Control de accesos, roles y afiliaciones</p>
        </div>
        <div style={{ position: "relative" }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Nombre o email..." 
            style={{ width: 320, paddingLeft: 40, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: "absolute", left: 14, top: 15, color: "var(--text-muted)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </header>

      {loading ? (
        <div className="card glass-card premium-border" style={{ padding: 0 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: 24, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 32 }}>
              <Skeleton width={200} height={20} />
              <Skeleton width={250} height={20} />
              <Skeleton width={120} height={20} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card glass-card premium-border" style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>Nombre Completo</th>
                <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>Email Corporativo</th>
                <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>Rol Asignado</th>
                <th style={{ textAlign: "left", padding: "20px 24px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>Organización</th>
                <th style={{ textAlign: "right", padding: "20px 24px", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="user-table-row">
                  <td style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                       <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                          {u.name ? u.name[0] : "U"}
                       </div>
                       <span style={{ fontWeight: 700, color: "#fff" }}>{u.name || "N/A"}</span>
                    </div>
                  </td>
                  <td style={{ padding: "20px 24px", color: "var(--text-secondary)" }}>{u.email}</td>
                  <td style={{ padding: "20px 24px" }}>
                    <span className={`role-pill ${u.role}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    {u.team?.name ? (
                       <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-red)" }} />
                          {u.team.name}
                       </span>
                    ) : (
                       <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Sin equipo</span>
                    )}
                  </td>
                  <td style={{ padding: "20px 24px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                       <button className="icon-action-btn" onClick={() => handleEdit(u)}>✏️</button>
                       <button className="icon-action-btn" style={{ color: "var(--val-red)" }} onClick={() => handleDelete(u.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
             <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
                No se encontraron usuarios activos.
             </div>
          )}
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content card glass-card premium-modal" style={{ maxWidth: 450, width: "95%" }}>
            <div style={{ marginBottom: 32 }}>
               <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Modificar Perfil</h2>
               <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Ajustando privilegios para {editingUser.name}</p>
            </div>
            
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Rol del Sistema</label>
              <select className="input-field" style={{ height: 48, borderRadius: 12 }} value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                <option value="member">Miembro (User)</option>
                <option value="team_admin">Admin de Organización</option>
                <option value="super_admin">Super Admin (Root)</option>
              </select>
            </div>
            
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Organización Asociada</label>
              <select className="input-field" style={{ height: 48, borderRadius: 12 }} value={formData.teamId} onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}>
                <option value="">Ninguna / Independiente</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1, height: 48, borderRadius: 12, fontWeight: 800 }} onClick={() => setEditingUser(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, height: 48, borderRadius: 12, fontWeight: 800 }} onClick={handleSave}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-wrapper {
          max-width: 1400px;
          margin: 0 auto;
        }
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 40px 80px rgba(0,0,0,0.5);
        }
        .user-table-row {
          transition: all 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .user-table-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
        .role-pill {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .role-pill.super_admin { background: rgba(255,70,85,0.1); color: var(--val-red); border: 1px solid rgba(255,70,85,0.2); }
        .role-pill.team_admin { background: rgba(0,212,170,0.1); color: var(--val-cyan); border: 1px solid rgba(0,212,170,0.2); }
        .role-pill.member { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
        
        .icon-action-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
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
        }
      `}</style>
    </div>
  );
}
