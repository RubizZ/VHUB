"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function LeaderboardPage() {
  const { data: session } = useSession();

  const { data, isLoading, error } = useQuery({
    queryKey: ["premier", "leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/team/premier/leaderboard");
      if (!res.ok) throw new Error("Error fetching premier leaderboard data");
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
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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
  const myTeamId = data?.details?.id;
  
  return (
    <div className="page-container" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
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
          <table className="leaderboard-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
                <th className="col-pos">Pos</th>
                <th className="col-team">Equipo</th>
                <th className="col-pts">Puntos</th>
                <th className="col-w hide-mobile">Victorias</th>
                <th className="col-l hide-mobile">Derrotas</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((team: any) => {
                const isMyTeam = myTeamId && team.id === myTeamId;
                return (
                  <tr 
                    key={team.id} 
                    style={{ 
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: isMyTeam ? "rgba(212, 175, 55, 0.1)" : "transparent",
                      transition: "background 0.2s",
                    }}
                  >
                    <td className="col-pos">
                      <div style={{ 
                        fontSize: 18, 
                        fontWeight: 900, 
                        color: isMyTeam ? "var(--val-gold)" : (team.ranking === 0 ? "var(--val-cyan)" : "var(--text-secondary)"),
                        textShadow: isMyTeam ? "0 0 10px rgba(212, 175, 55, 0.5)" : "none"
                      }}>
                        #{team.ranking + 1}
                      </div>
                    </td>
                    <td className="col-team">
                      <div className="team-cell">
                        <div className="team-logo" style={{ 
                          background: team.customization?.primary || "rgba(255,255,255,0.1)",
                          border: isMyTeam ? "2px solid var(--val-gold)" : "1px solid rgba(255,255,255,0.1)"
                        }}>
                          {team.customization?.image ? (
                            <img src={team.customization.image} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 800 }}>{team.tag}</span>
                          )}
                        </div>
                        <div>
                          <div className="team-name" style={{ color: isMyTeam ? "var(--val-gold)" : "#fff" }}>
                            {team.name}
                            {isMyTeam && <span style={{ marginLeft: 8, fontSize: 10, background: "var(--val-gold)", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: 900, verticalAlign: "middle" }}>TÚ</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>#{team.tag}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-pts">
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--val-gold)", textShadow: "0 0 15px rgba(212,175,55,0.3)" }}>
                        {team.score}
                      </div>
                    </td>
                    <td className="col-w hide-mobile">
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--val-cyan)" }}>
                        {team.wins}
                      </div>
                    </td>
                    <td className="col-l hide-mobile">
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
        
        /* Table Base Styles */
        .leaderboard-table th, .leaderboard-table td {
          padding: 16px 24px;
        }
        .leaderboard-table th {
          font-size: 13px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 700;
          letter-spacing: 1px;
        }
        
        .col-pos { text-align: left; width: 80px; }
        .col-team { text-align: left; }
        .col-pts { text-align: center; }
        .col-w { text-align: center; }
        .col-l { text-align: center; }
        
        .team-cell {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .team-logo {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .team-name {
          font-size: 16px;
          font-weight: 800;
        }
        
        /* Responsive Styles */
        @media (max-width: 640px) {
          .leaderboard-table th, .leaderboard-table td {
            padding: 12px 12px;
          }
          .team-cell {
            gap: 12px;
          }
          .team-logo {
            width: 32px;
            height: 32px;
          }
          .team-name {
            font-size: 14px;
          }
          .hide-mobile {
            display: none !important;
          }
          .leaderboard-table {
            min-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
