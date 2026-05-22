"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

interface PlayerData {
  id: string;
  name: string;
  riot_name: string;
  riot_tag: string;
  role: string;
  avatar_color: string;
  team?: { name: string; tag: string };
  user?: { email: string; lastActiveAt: string };
}

export default function PlayerProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const playerId = params?.id as string;

  // Si el ID coincide con el del usuario actual, redirigir a /profile
  useEffect(() => {
    if (session?.user && (session.user as any).playerId === playerId) {
      router.replace("/profile");
    }
  }, [session, playerId, router]);

  const {
    data: playerData,
    isLoading,
    error,
  } = useQuery<{ player: PlayerData }>({
    queryKey: ["player", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/players/${playerId}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el perfil");
      }
      return res.json();
    },
    enabled: !!session?.user && !!playerId,
  });

  const player = playerData?.player;
  
  const isOnline = player?.user?.lastActiveAt
    ? (new Date().getTime() - new Date(player.user.lastActiveAt).getTime()) < 3 * 60 * 1000
    : false;

  if (isLoading) {
    return (
      <div className="page-content animate-in">
        <Skeleton width="100%" height={300} style={{ borderRadius: 24, marginBottom: 32 }} />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="page-content animate-in">
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--val-red)", background: "rgba(255, 70, 85, 0.1)" }}>
          <h3>⚠️ Perfil No Accesible</h3>
          <p>{(error as Error)?.message || "No se pudo encontrar el jugador."}</p>
          <button className="btn btn-secondary mt-4" onClick={() => router.back()}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-wrapper animate-in" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
      <button className="btn btn-ghost mb-4" onClick={() => router.back()}>
        ← Volver
      </button>

      <div className="profile-hero card glass-card premium-border" style={{
        padding: 0, marginBottom: 40, overflow: "hidden",
        background: `linear-gradient(to right, ${player.avatar_color}22 0%, rgba(20, 20, 26, 0.8) 100%)`
      }}>
        <div className="hero-glow" style={{ background: `radial-gradient(circle at 10% 50%, ${player.avatar_color}33 0%, transparent 70%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, padding: 40, position: "relative" }}>
          <div className="avatar-container" style={{ position: "relative" }}>
            <div className="profile-avatar" style={{
              width: 140, height: 140, borderRadius: 32, fontSize: 60, fontWeight: 900, color: "#fff",
              background: player.avatar_color, boxShadow: `0 10px 30px ${player.avatar_color}44`,
              display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid rgba(255,255,255,0.1)"
            }}>
              {player.name[0]}
            </div>
            {isOnline ? (
              <div className="status-badge-online" style={{
                position: "absolute", bottom: 4, right: 4, background: "var(--val-cyan)", color: "#000",
                fontSize: 10, fontWeight: 900, padding: "4px 8px", borderRadius: 8, border: "3px solid rgba(20, 20, 26, 1)"
              }}>En Línea</div>
            ) : (
              <div className="status-badge-offline" style={{
                position: "absolute", bottom: 4, right: 4, background: "rgba(255, 255, 255, 0.2)", color: "#fff",
                fontSize: 10, fontWeight: 900, padding: "4px 8px", borderRadius: 8, border: "3px solid rgba(20, 20, 26, 1)"
              }}>Desconectado</div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: "-1.5px" }}>{player.riot_name ? `${player.riot_name}#${player.riot_tag}` : player.name}</h1>
              {player.team && <span className="team-badge" style={{
                background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "4px 12px", borderRadius: 8, fontSize: 14, fontWeight: 800, border: "1px solid rgba(255, 70, 85, 0.2)"
              }}>#{player.team.tag}</span>}
            </div>
            {player.riot_name && <p style={{ fontSize: 18, color: "var(--text-secondary)", margin: 0 }}>{player.name}</p>}
            <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
              <div className="hero-stat" style={{ display: "flex", flexDirection: "column", paddingRight: 24, borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="label" style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>ROL PRINCIPAL</span>
                <span className="value" style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{player.role.toUpperCase()}</span>
              </div>
              <div className="hero-stat" style={{ display: "flex", flexDirection: "column", paddingRight: 24 }}>
                <span className="label" style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>ORGANIZACIÓN</span>
                <span className="value" style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{player.team?.name || "SIN EQUIPO"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .hero-glow {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
