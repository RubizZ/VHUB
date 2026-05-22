/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PlayerData {
  id: number;
  name: string;
  riot_name: string;
  riot_tag: string;
  role: string;
  avatar_color: string;
  puuid: string | null;
  dataConsent: boolean;
  team?: { name: string; tag: string };
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState({ text: "", type: "" });

  // 1. Fetch Profile
  const {
    data: playerData,
    isLoading: playerLoading,
    error: playerError,
  } = useQuery<{ player: PlayerData }>({
    queryKey: ["player", "me"],
    queryFn: async () => {
      const res = await fetch("/api/players/me");
      if (!res.ok) throw new Error("Error al cargar perfil");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const player = playerData?.player || null;
  const loading = playerLoading;

  useEffect(() => {
    if (playerError) {
      setMessage({ text: (playerError as Error).message || "Error al cargar perfil", type: "error" });
    }
  }, [playerError]);

  // 2. Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<PlayerData>) => {
      const res = await fetch("/api/players/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar perfil");
      return { updates, data };
    },
    onSuccess: (result) => {
      // Optimistically update the player details inside the cache
      queryClient.setQueryData(["player", "me"], (old: any) => {
        if (!old?.player) return old;
        return {
          ...old,
          player: {
            ...old.player,
            ...result.updates
          }
        };
      });
      setMessage({ text: "Perfil actualizado correctamente", type: "success" });
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    },
    onError: (err: any) => {
      setMessage({ text: err.message || "Error al actualizar perfil", type: "error" });
    }
  });

  const handleUpdateProfile = (updates: Partial<PlayerData>) => {
    updateProfileMutation.mutate(updates);
  };

  const saving = updateProfileMutation.isPending;

  if (loading) {
    return (
      <div className="page-content animate-in">
        <Skeleton width="100%" height={300} style={{ borderRadius: 24, marginBottom: 32 }} />
        <Skeleton width="100%" height={400} style={{ borderRadius: 24, maxWidth: 800, margin: "0 auto" }} />
      </div>
    );
  }

  return (
    <div className="profile-wrapper animate-in">
      {/* Hero Section */}
      <div className="profile-hero card glass-card premium-border" style={{
        padding: 0, marginBottom: 40, overflow: "hidden",
        background: `linear-gradient(to right, ${player?.avatar_color}22 0%, rgba(20, 20, 26, 0.8) 100%)`
      }}>
        <div className="hero-glow" style={{ background: `radial-gradient(circle at 10% 50%, ${player?.avatar_color}33 0%, transparent 70%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, padding: 40, position: "relative" }}>
          <div className="avatar-container" style={{ position: "relative" }}>
            <div className="profile-avatar" style={{
              width: 140, height: 140, borderRadius: 32, fontSize: 60, fontWeight: 900, color: "#fff",
              background: player?.avatar_color, boxShadow: `0 10px 30px ${player?.avatar_color}44`,
              display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid rgba(255,255,255,0.1)"
            }}>
              {player?.name[0]}
            </div>
            <div className="status-badge-online">En Línea</div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: "-1.5px" }}>{player?.name}</h1>
              {player?.team && <span className="team-badge">#{player.team.tag}</span>}
            </div>
            <p style={{ fontSize: 18, color: "var(--text-secondary)", margin: 0 }}>{session?.user?.email}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
              <div className="hero-stat">
                <span className="label">ROL PRINCIPAL</span>
                <span className="value">{player?.role.toUpperCase()}</span>
              </div>
              <div className="hero-stat">
                <span className="label">ORGANIZACIÓN</span>
                <span className="value">{player?.team?.name || "SIN EQUIPO"}</span>
              </div>
            </div>
          </div>

          <div className="hero-actions">
            <button className="btn btn-primary" style={{ height: 48, padding: "0 24px", borderRadius: 12, fontWeight: 800 }}>
              Compartir Perfil
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Simplified Identity Setup */}
      <div className="profile-content-container" style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card glass-card premium-border" style={{ padding: 40 }}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 22, fontWeight: 900, textAlign: "center" }}>Configuración de Identidad</h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginBottom: 32, lineHeight: 1.6 }}>
            Elige tu rol favorito en partida y tu color de identidad para destacar dentro de la plataforma y en el roster de tu equipo.
          </p>

          <div className="form-group" style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, display: "block", textAlign: "center" }}>Rol en Partida</label>
            <div className="role-selector-grid" style={{ maxWidth: 600, margin: "0 auto" }}>
              {['duelist', 'initiator', 'controller', 'sentinel', 'flex'].map(r => (
                <button
                  key={r}
                  className={`role-option ${player?.role === r ? 'active' : ''}`}
                  onClick={() => handleUpdateProfile({ role: r })}
                  disabled={saving}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, display: "block", textAlign: "center" }}>Color de Identidad</label>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {['#E11D48', '#10B981', '#A855F7', '#3B82F6', '#EAB308', '#FFFFFF'].map(c => (
                <div
                  key={c}
                  onClick={() => !saving && handleUpdateProfile({ avatar_color: c })}
                  className={`color-bubble ${player?.avatar_color === c ? 'active' : ''}`}
                  style={{ background: c, width: 44, height: 44 }}
                />
              ))}
            </div>
          </div>
        </div>

        {message.text && (
          <div className="animate-in" style={{
            marginTop: 32, padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: "center",
            background: message.type === "success" ? "rgba(0,212,170,0.1)" : "rgba(255,70,85,0.1)",
            color: message.type === "success" ? "var(--val-cyan)" : "var(--val-red)",
            border: `1px solid ${message.type === "success" ? "rgba(0,212,170,0.2)" : "rgba(255,70,85,0.2)"}`
          }}>
            {message.text}
          </div>
        )}
      </div>

      <style jsx>{`
        .profile-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .hero-glow {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
        }
        .status-badge-online {
          position: absolute;
          bottom: 4px; right: 4px;
          background: var(--val-cyan);
          color: #000;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 8px;
          border: 3px solid rgba(20, 20, 26, 1);
        }
        .team-badge {
          background: rgba(255, 70, 85, 0.1);
          color: var(--val-red);
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 800;
          border: 1px solid rgba(255, 70, 85, 0.2);
        }
        .hero-stat {
           display: flex;
           flex-direction: column;
           padding-right: 24px;
           border-right: 1px solid rgba(255,255,255,0.1);
        }
        .hero-stat:last-child { border: none; }
        .hero-stat .label { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; }
        .hero-stat .value { font-size: 16px; font-weight: 900; color: #fff; }

        .role-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
        }
        .role-option {
          padding: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-option:hover { background: rgba(255,255,255,0.08); }
        .role-option.active {
          background: var(--val-red);
          color: #fff;
          border-color: var(--val-red);
          box-shadow: 0 4px 15px rgba(255, 70, 85, 0.3);
        }
        .color-bubble {
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 3px solid transparent;
        }
        .color-bubble:hover { transform: scale(1.1); }
        .color-bubble.active {
          border-color: #fff;
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}
