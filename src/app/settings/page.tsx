"use client";
import { useEffect, useState } from "react";

interface Player { id: number; name: string; riot_name: string; riot_tag: string; role: string; avatar_color: string; }

export default function SettingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState({ name: "", riot_name: "", riot_tag: "", role: "flex", avatar_color: "#FF4655" });
  const colors = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#E040FB", "#00BCD4"];
  const roles = [
    { value: "duelist", label: "Duelista" }, { value: "initiator", label: "Iniciador" },
    { value: "controller", label: "Controlador" }, { value: "sentinel", label: "Centinela" }, { value: "flex", label: "Flex" }
  ];

  const load = () => fetch("/api/players").then(r => r.json()).then(d => setPlayers(d.players || []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return;
    if (editing) {
      await fetch("/api/players", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) });
    } else {
      await fetch("/api/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setEditing(null);
    setForm({ name: "", riot_name: "", riot_tag: "", role: "flex", avatar_color: "#FF4655" });
    load();
  };

  const edit = (p: Player) => { setEditing(p); setForm({ name: p.name, riot_name: p.riot_name, riot_tag: p.riot_tag, role: p.role, avatar_color: p.avatar_color }); };
  const del = async (id: number) => { await fetch(`/api/players?id=${id}`, { method: "DELETE" }); load(); };
  const cancel = () => { setEditing(null); setForm({ name: "", riot_name: "", riot_tag: "", role: "flex", avatar_color: "#FF4655" }); };

  return (
    <>
      <div className="page-header"><h2>⚙️ Ajustes</h2><p>Configura el equipo y los jugadores</p></div>
      <div className="page-content animate-in">
        <div className="grid grid-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>{editing ? "Editar Jugador" : "Añadir Jugador"}</h3>
            <div className="form-group"><label>Nombre</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre del jugador" /></div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}><label>Riot Name</label><input value={form.riot_name} onChange={e => setForm({ ...form, riot_name: e.target.value })} placeholder="RiotName" /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Tag</label><input value={form.riot_tag} onChange={e => setForm({ ...form, riot_tag: e.target.value })} placeholder="EUW" /></div>
            </div>
            <div className="form-group"><label>Rol</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            <div className="form-group">
              <label>Color</label>
              <div style={{ display: "flex", gap: 6 }}>
                {colors.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.avatar_color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={save}>{editing ? "Guardar" : "Añadir"}</button>
              {editing && <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>}
            </div>
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Equipo ({players.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--bg-glass)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: p.avatar_color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>{p.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.riot_name ? `${p.riot_name}#${p.riot_tag}` : "Sin Riot ID"}</div>
                  </div>
                  <span className="tag" style={{ background: `${colors[0]}22`, color: p.avatar_color, textTransform: "uppercase", fontSize: 10 }}>{p.role}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => del(p.id)}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
