"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; user?: { email: string } }
interface UnlinkedUser { id: string; name: string; email: string; }

export default function TeamRosterPage() {
  const { data: session } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState({ email: "", role: "flex", avatar_color: "#FF4655" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canManage = session?.user?.role === "team_admin" || session?.user?.role === "super_admin";
  
  const colors = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#E040FB", "#00BCD4"];
  const roles = [
    { value: "duelist", label: "Duelista" }, { value: "initiator", label: "Iniciador" },
    { value: "controller", label: "Controlador" }, { value: "sentinel", label: "Centinela" }, { value: "flex", label: "Flex" }
  ];

  const loadData = async () => {
    try {
      const pRes = await fetch("/api/players");
      const pData = await pRes.json();
      setPlayers(pData.players || []);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  useEffect(() => { loadData(); }, [session]);

  const save = async () => {
    if (!form.email && !editing) {
      setError("Debes introducir un email.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/players", { 
        method: editing ? "PUT" : "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(editing ? { id: editing.id, role: form.role, avatar_color: form.avatar_color } : form) 
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al procesar");
      } else {
        setEditing(null);
        setForm({ email: "", role: "flex", avatar_color: "#FF4655" });
        loadData();
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: number) => { 
    if (!confirm("¿Eliminar este jugador?")) return;
    await fetch(`/api/players?id=${id}`, { method: "DELETE" }); 
    loadData(); 
  };

  if (!canManage) {
    return <div className="p-20 text-center">Acceso restringido a administradores.</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>📋 Plantilla del Equipo</h1>
        <p style={{ color: "var(--text-secondary)" }}>Gestiona la lista oficial de jugadores y sus roles</p>
      </header>

      <div className="page-content animate-in">
        <div className="grid grid-2">
          {/* Formulario de registro/edición */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>
              {editing ? "✏️ Editar Jugador" : "➕ Añadir Jugador al Equipo"}
            </h3>
            
            {error && <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {!editing && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Email del Usuario</label>
                <input 
                  type="email"
                  className="input-field"
                  style={{ width: "100%" }}
                  placeholder="usuario@ejemplo.com"
                  value={form.email} 
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  El usuario debe estar registrado. Si no tiene equipo, se le añadirá directamente.
                </p>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Rol en el Juego</label>
              <select className="input-field" style={{ width: "100%" }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Color Distintivo</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {colors.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.avatar_color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer", transition: "all 0.2s" }} />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={loading || (!editing && unlinkedUsers.length === 0)}>
                {loading ? "Validando..." : editing ? "Guardar Cambios" : "Registrar Jugador"}
              </button>
              {editing && <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>}
            </div>
          </div>

          {/* Lista de jugadores */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Roster Oficial ({players.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} className="player-list-item" style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  background: "rgba(255,255,255,0.02)", 
                  border: "1px solid var(--border-color)",
                  transition: "all 0.2s"
                }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: "50%", background: p.avatar_color, 
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
                    boxShadow: `0 0 10px ${p.avatar_color}33`
                  }}>
                    {p.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.riot_name}#{p.riot_tag}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { 
                      setEditing(p); 
                      setForm({ 
                        email: p.user?.email || "", 
                        role: p.role, 
                        avatar_color: p.avatar_color 
                      }); 
                    }}>✏️</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--val-red)" }} onClick={() => del(p.id)}>🗑️</button>
                  </div>
                </div>
              ))}
              {players.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  No hay jugadores registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .player-list-item:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: var(--val-red) !important;
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
}
