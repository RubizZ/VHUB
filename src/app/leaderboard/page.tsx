"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function LeaderboardPage() {
  const { data: session } = useSession();

  const { data, isLoading, error } = useQuery({
    queryKey: ["premier", "team"],
    queryFn: async () => {
      const res = await fetch("/api/team/premier");
      if (!res.ok) throw new Error("Error fetching premier data");
      return res.json();
    }
  });

  const { data: config } = useQuery({
    queryKey: ["team", "config"],
    queryFn: async () => {
      const res = await fetch("/api/team/config");
      if (!res.ok) throw new Error("Error fetching team config");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="page-container" style={{ padding: "40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <div style={{ width: 40, height: 40, border: "4px solid var(--val-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (error || !data || !data.leaderboard) {
    return (
      <div className="page-container" style={{ padding: "40px", maxWidth: 1000, margin: "0 auto" }}>
        <div className="card glass-card" style={{ padding: 40, textAlign: "center" }}>
          <h2 style={{ fontSize: 24, marginBottom: 16 }}>No se pudo cargar la clasificación</h2>
          <p style={{ color: "var(--text-secondary)" }}>Asegúrate de que el equipo tiene configurado su nombre y tag de Premier en Ajustes.</p>
          <Link href="/team/settings" className="btn btn-primary" style={{ marginTop: 24 }}>Ir a Ajustes</Link>
        </div>
      </div>
    );
  }

  const leaderboard = data.leaderboard;
  const myTeamName = config?.name;
  
  return (
    <div className="page-container" style={{ padding: "40px 40px 100px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>🏆</span>
          <h1 style={{ fontSize: 32, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, margin: 0 }}>
            Leaderboard
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 15 }}>
          Clasificación oficial de Premier de {data.details?.placement?.conference} - División {data.details?.placement?.division}
        </p>
      </div>

      <div className="card glass-card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
                <th style={{ padding: "20px 24px", textAlign: "left", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, width: 80 }}>Pos</th>
                <th style={{ padding: "20px 24px", textAlign: "left", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>Equipo</th>
                <th style={{ padding: "20px 24px", textAlign: "center", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>Puntos</th>
                <th style={{ padding: "20px 24px", textAlign: "center", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>Victorias</th>
                <th style={{ padding: "20px 24px", textAlign: "center", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>Derrotas</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((team: any) => {
                const isMyTeam = myTeamName && team.name.toLowerCase() === myTeamName.toLowerCase();
                return (
                  <tr 
                    key={team.id} 
                    style={{ 
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: isMyTeam ? "rgba(212, 175, 55, 0.1)" : "transparent",
                      transition: "background 0.2s",
                    }}
                  >
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ 
                        fontSize: 18, 
                        fontWeight: 900, 
                        color: isMyTeam ? "var(--val-gold)" : (team.ranking === 0 ? "var(--val-cyan)" : "var(--text-secondary)"),
                        textShadow: isMyTeam ? "0 0 10px rgba(212, 175, 55, 0.5)" : "none"
                      }}>
                        #{team.ranking + 1}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: 8, overflow: "hidden", 
                          background: team.customization?.primary || "rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: isMyTeam ? "2px solid var(--val-gold)" : "1px solid rgba(255,255,255,0.1)"
                        }}>
                          {team.customization?.image ? (
                            <img src={team.customization.image} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 800 }}>{team.tag}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: isMyTeam ? "var(--val-gold)" : "#fff" }}>
                            {team.name}
                            {isMyTeam && <span style={{ marginLeft: 8, fontSize: 10, background: "var(--val-gold)", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: 900, verticalAlign: "middle" }}>TÚ</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>#{team.tag}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--val-gold)", textShadow: "0 0 15px rgba(212,175,55,0.3)" }}>
                        {team.score}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--val-cyan)" }}>
                        {team.wins}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--val-red)" }}>
                        {team.losses}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
