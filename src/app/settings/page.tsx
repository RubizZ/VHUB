"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; user?: { email: string } }
interface UnlinkedUser { id: string; name: string; email: string; }

export default function SettingsPage() {
  const { data: session } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState({ userId: "", riot_name: "", riot_tag: "", role: "flex", avatar_color: "#FF4655" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = session?.user?.role === "admin";
  const colors = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#E040FB", "#00BCD4"];
  const roles = [
    { value: "duelist", label: "Duelista" }, { value: "initiator", label: "Iniciador" },
    { value: "controller", label: "Controlador" }, { value: "sentinel", label: "Centinela" }, { value: "flex", label: "Flex" }
  ];

  const loadData = async () => {
    const [pRes, uRes] = await Promise.all([
      fetch("/api/players"),
      fetch("/api/users/unlinked")
    ]);
    const pData = await pRes.json();
    const uData = await uRes.json();
    setPlayers(pData.players || []);
    setUnlinkedUsers(uData.users || []);
  };

  useEffect(() => { loadData(); }, []);

  const save = async () => {
    if (!form.userId && !editing) {
      setError("Debes seleccionar un usuario de la base de datos.");
      return;
    }
    if (!form.riot_name || !form.riot_tag) {
      setError("El Riot ID es obligatorio para validar la cuenta.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/players", { 
        method: editing ? "PUT" : "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form) 
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al procesar");
      } else {
        setEditing(null);
        setForm({ userId: "", riot_name: "", riot_tag: "", role: "flex", avatar_color: "#FF4655" });
        loadData();
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: number) => { 
    if (!confirm("¿Eliminar este jugador del equipo? El usuario seguirá existiendo pero no tendrá perfil de jugador.")) return;
    await fetch(`/api/players?id=${id}`, { method: "DELETE" }); 
    loadData(); 
  };

  return (
    <>
      <div className="page-header">
        <h2>⚙️ Ajustes de Equipo</h2>
        <p>Gestiona quién pertenece al equipo oficial</p>
      </div>
      <div className="page-content animate-in">
        <div className="grid grid-2">
          {isAdmin ? (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>
                {editing ? "Editar Jugador" : "Vincular Usuario al Equipo"}
              </h3>
              
              {error && <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

              {!editing && (
                <div className="form-group">
                  <label>Seleccionar Usuario Registrado</label>
                  <select 
                    value={form.userId} 
                    onChange={e => setForm({ ...form, userId: e.target.value })}
                  >
                    <option value="">-- Elige un usuario --</option>
                    {unlinkedUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Solo aparecen usuarios que ya se han registrado pero no son parte del equipo aún.
                  </p>
                </div>
              )}

              <div className="form-row" style={{ display: "flex", gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Riot Name</label>
                  <input value={form.riot_name} onChange={e => setForm({ ...form, riot_name: e.target.value })} placeholder="Ej: TenZ" />
                </div>
                <div className="form-group" style={{ width: 100 }}>
                  <label>Tag</label>
                  <input value={form.riot_tag} onChange={e => setForm({ ...form, riot_tag: e.target.value })} placeholder="Ej: NA1" />
                </div>
              </div>

              <div className="form-group">
                <label>Rol Principal</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Color de Identidad</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {colors.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.avatar_color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" onClick={save} disabled={loading || (!editing && unlinkedUsers.length === 0)}>
                  {loading ? "Validando..." : editing ? "Guardar" : "Vincular Usuario"}
                </button>
                {editing && <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>}
              </div>
            </div>
          ) : (
            <div className="card">
              <h3 className="card-title">Acceso Restringido</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Solo administradores pueden gestionar el equipo.</p>
            </div>
          )}

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Jugadores del Equipo ({players.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "var(--bg-glass)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: p.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{p.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.user?.email}</div>
                  </div>
                  {isAdmin && (
                    <button className="btn btn-ghost btn-sm" onClick={() => del(p.id)}>🗑️</button>
                  )}
                </div>
              ))}
              {players.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No hay jugadores vinculados.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
