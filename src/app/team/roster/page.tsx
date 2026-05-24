/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Player { 
  id: number; 
  name: string; 
  riot_name: string; 
  riot_tag: string; 
  role: string; 
  avatar_color: string; 
  image?: string | null;
  user?: { email: string };
}

export default function TeamRosterPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState({ email: "", role: "flex", avatar_color: "#E11D48" });
  const [error, setError] = useState("");

  const canManage = session?.user?.role === "team_admin" || session?.user?.role === "super_admin";
  
  const colors = ["#E11D48", "#10B981", "#A855F7", "#3B82F6", "#EAB308", "#FF6B35", "#E040FB", "#00BCD4"];
  const roles = [
    { value: "duelist", label: "Duelista" }, { value: "initiator", label: "Iniciador" },
    { value: "controller", label: "Controlador" }, { value: "sentinel", label: "Centinela" }, { value: "flex", label: "Flex" }
  ];

  // 1. Fetch Players
  const { 
    data: playersData, 
    isLoading: playersLoading, 
    error: playersError 
  } = useQuery<{ players: Player[] }>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players");
      if (!res.ok) throw new Error("Error al cargar plantilla");
      return res.json();
    },
    enabled: !!session,
  });

  const players = playersData?.players || [];
  const dataLoading = playersLoading;

  useEffect(() => {
    if (playersError) {
      setError((playersError as Error).message || "Error al cargar plantilla");
    }
  }, [playersError]);

  // 2. Save/Edit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.email && !editing) {
        throw new Error("Debes introducir un email.");
      }
      const res = await fetch("/api/players", { 
        method: editing ? "PUT" : "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(editing ? { id: editing.id, role: form.role, avatar_color: form.avatar_color } : form) 
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al procesar");
      }
      return data;
    },
    onSuccess: () => {
      setEditing(null);
      setForm({ email: "", role: "flex", avatar_color: "#E11D48" });
      setError("");
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (err: any) => {
      setError(err.message || "Error de conexión");
    }
  });

  const save = () => {
    saveMutation.mutate();
  };

  const loading = saveMutation.isPending;

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/players?id=${id}`, { method: "DELETE" }); 
      if (!res.ok) throw new Error("Error al eliminar jugador");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (err: any) => {
      setError(err.message || "Error al eliminar jugador");
    }
  });

  const del = async (id: number) => { 
    if (!confirm("¿Eliminar este jugador?")) return;
    deleteMutation.mutate(id);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Formulario de registro/edición */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>
              {editing ? "✏️ Editar Jugador" : "➕ Añadir Jugador al Equipo"}
            </h3>
            
            {error && <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              {!editing && (
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>Email del Usuario</label>
                  <input 
                    type="email"
                    className="input-field"
                    style={{ width: "100%" }}
                    placeholder="usuario@ejemplo.com"
                    value={form.email} 
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group" style={{ flex: "1 1 150px" }}>
                <label>Rol en el Juego</label>
                <select className="input-field" style={{ width: "100%" }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <label>Color Distintivo</label>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {colors.slice(0, 4).map(c => (
                    <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.avatar_color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer", transition: "all 0.2s" }} />
                  ))}
                </div>
              </div>
              
              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  {colors.slice(4).map(c => (
                    <button key={c} onClick={() => setForm({ ...form, avatar_color: c })} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.avatar_color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer", transition: "all 0.2s" }} />
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flex: "1 1 200px", height: 42, marginBottom: 2 }}>
                <button className="btn btn-primary" style={{ flex: 1, height: "100%" }} onClick={save} disabled={loading}>
                  {loading ? "Validando..." : editing ? "Guardar" : "Registrar"}
                </button>
                {editing && <button className="btn btn-secondary" style={{ height: "100%" }} onClick={() => setEditing(null)}>Cancelar</button>}
              </div>
            </div>
            
            {!editing && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
                El usuario debe estar registrado. Si no tiene equipo, se le añadirá directamente.
              </p>
            )}
          </div>

          {/* Lista de jugadores */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Roster Oficial ({players.length})</h3>
            <div className="roster-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {dataLoading ? (
                <>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)" }}>
                      <Skeleton width={40} height={40} circle />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                        <Skeleton width={120} height={14} />
                        <Skeleton width={80} height={10} />
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Skeleton width={32} height={32} />
                        <Skeleton width={32} height={32} />
                      </div>
                    </div>
                  ))}
                </>
              ) : players.map(p => (
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
                  <Link href={`/player/${p.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ 
                      width: 40, height: 40, borderRadius: "50%", background: p.avatar_color, 
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
                      boxShadow: `0 0 10px ${p.avatar_color}33`, cursor: "pointer", overflow: "hidden"
                    }}>
                      {p.image ? (
                        <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        p.name[0]
                      )}
                    </div>
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.riot_name ? `${p.riot_name}#${p.riot_tag}` : p.name}</div>
                    {p.riot_name && <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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
              {!dataLoading && players.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
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
        .roster-list::-webkit-scrollbar {
          width: 6px;
        }
        .roster-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .roster-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .roster-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
