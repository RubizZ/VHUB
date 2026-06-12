 
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const { update } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<"choice" | "create_name" | "create_premier" | "create_confirm" | "join" | "pending">("choice");
  const [error, setError] = useState("");

  // Form states
  const [teamName, setTeamName] = useState("");
  const [conference, setConference] = useState("NONE");
  const [joinSlug, setJoinSlug] = useState("");
  const [premierName, setPremierName] = useState("");
  const [teamTag, setTeamTag] = useState("");

  // 1. Query for pending request
  const { data: requestData } = useQuery({
    queryKey: ["myTeamRequest"],
    queryFn: async () => {
      const res = await fetch("/api/teams/requests/me");
      if (!res.ok) throw new Error("Error loading pending requests");
      return res.json();
    },
  });

  useEffect(() => {
    if (requestData?.request) {
      setMode("pending");
    }
  }, [requestData]);

  // 2. Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, conference, team_tag: teamTag, premier_name: premierName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el equipo");
      return data;
    },
    onSuccess: async (data) => {
      await update({ 
        teamId: data.team.id,
        role: "team_admin"
      });
      router.push("/");
    },
    onError: (err: any) => {
      setError(err.message || "Error de conexión");
    }
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createTeamMutation.mutate();
  };

  // 3. Join team mutation
  const joinTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: joinSlug.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar la solicitud");
      return data;
    },
    onSuccess: () => {
      setMode("pending");
      queryClient.invalidateQueries({ queryKey: ["myTeamRequest"] });
    },
    onError: (err: any) => {
      setError(err.message || "Error de conexión");
    }
  });

  const handleJoinTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim()) return;
    setError("");
    joinTeamMutation.mutate();
  };

  const loading = createTeamMutation.isPending || joinTeamMutation.isPending;

  return (
    <div className="auth-layout">
      <div className="auth-brand-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <img src="/logo.png" alt="V-HUB Logo" style={{ width: '64px', height: '64px', borderRadius: '16px', boxShadow: '0 0 20px rgba(255, 70, 85, 0.4)' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '2px', color: 'var(--text-primary)' }}>V-HUB</h1>
        </div>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '400px' }}>
          La plataforma definitiva para gestionar tu equipo de Valorant. 
          Estrategias, calendario, estadísticas y mucho más en un solo lugar.
        </p>
      </div>

      <div className="auth-form-section">
        <div className="auth-card" style={{ maxWidth: 540 }}>
          <h2 className="auth-title">Bienvenido a V-HUB</h2>
          <p className="auth-subtitle">Parece que aún no perteneces a ningún equipo.</p>

          {error && (
            <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", marginBottom: "24px", border: "1px solid rgba(255, 70, 85, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}

          {mode === "choice" && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <button 
                className="onboard-choice-card" 
                onClick={() => setMode("create_name")}
                style={{ border: "none" }}
              >
                <div className="onboard-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                </div>
                <div>
                  <h3>Crear un nuevo Equipo</h3>
                  <p>Sé el capitán, invita a tus amigos y gestiona estrategias y partidas desde cero.</p>
                </div>
              </button>
              
              <button 
                className="onboard-choice-card" 
                onClick={() => setMode("join")}
                style={{ border: "none" }}
              >
                <div className="onboard-icon-box" style={{ color: "var(--val-cyan)", background: "rgba(0, 212, 170, 0.1)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                </div>
                <div>
                  <h3>Unirme a un Equipo</h3>
                  <p>¿Ya tienes un equipo en V-HUB? Introduce el identificador para unirte a ellos.</p>
                </div>
              </button>
            </div>
          )}

          {mode === "create_name" && (
            <form onSubmit={(e) => { e.preventDefault(); setMode("create_premier"); }} style={{ marginTop: 24 }}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>NOMBRE DEL EQUIPO</label>
                <input 
                  type="text" 
                  value={teamName} 
                  onChange={(e) => setTeamName(e.target.value)} 
                  placeholder="Ej. G2 Esports" 
                  required 
                  style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>IDENTIFICADOR CORTO (SLUG)</label>
                <div 
                  style={{ 
                    width: "100%", 
                    padding: "14px 16px", 
                    borderRadius: "12px", 
                    background: "rgba(255, 255, 255, 0.02)", 
                    border: "1px dashed var(--border-color)", 
                    color: "var(--val-red)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "14px",
                    minHeight: "50px",
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 600
                  }}
                >
                  {teamName ? (
                    teamName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
                  ) : (
                    <span style={{ fontStyle: "italic", opacity: 0.5, color: "var(--text-muted)", fontWeight: 400 }}>Se generará a partir del nombre...</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMode("choice")} style={{ flex: 1, padding: "16px", borderRadius: "12px", fontWeight: 600 }}>Volver</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: "16px", borderRadius: "12px", fontWeight: 700 }}>CONTINUAR</button>
              </div>
            </form>
          )}

          {mode === "create_premier" && (
            <form onSubmit={(e) => { e.preventDefault(); setMode("create_confirm"); }} style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>Datos del Premier (Opcional)</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "14px", lineHeight: "1.5" }}>
                Si tu equipo participa en Valorant Premier, selecciona tu región. Esto ayudará a sincronizar los eventos y calendarios. Puedes saltar este paso si no juegas Premier.
              </p>
              <div className="form-group" style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>REGIÓN (VALORANT PREMIER)</label>
                <select 
                  value={conference} 
                  onChange={(e) => setConference(e.target.value)} 
                  style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
                >
                  <option value="NONE">No participamos en Premier</option>
                  <option value="EU_IBIT">Europa (Iberia, Italia, Balcanes)</option>
                  <option value="EU_FRANCE">Europa (Francia)</option>
                  <option value="EU_DACH">Europa (DACH - DE/AT/CH)</option>
                  <option value="EU_NORTH">Europa (Norte)</option>
                  <option value="EU_EAST">Europa (Este)</option>
                  <option value="EU_TURKEY">Europa (Turquía)</option>
                  <option value="EU_MIDDLE_EAST">Europa (Oriente Medio)</option>
                  <option value="NA_EAST">Norteamérica Este</option>
                  <option value="NA_WEST">Norteamérica Oeste</option>
                  <option value="LATAM_NORTH">LATAM Norte</option>
                  <option value="LATAM_SOUTH">LATAM Sur</option>
                  <option value="BR">Brasil</option>
                  <option value="AP">Asia Pacífico</option>
                  <option value="KR">Corea</option>
                </select>
              </div>

              {conference !== "NONE" && (
                <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>NOMBRE EN PREMIER</label>
                    <input 
                      type="text" 
                      value={premierName} 
                      onChange={(e) => setPremierName(e.target.value)} 
                      placeholder="Ej. G2 Esports" 
                      required 
                      style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
                    />
                    <span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                      El nombre oficial que usáis dentro del juego.
                    </span>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>TAG (#)</label>
                    <input 
                      type="text" 
                      value={teamTag} 
                      onChange={(e) => setTeamTag(e.target.value.toUpperCase().replace('#', '').slice(0, 4))} 
                      placeholder="Ej. G2" 
                      required 
                      style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
                    />
                    <span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                      Máx. 4 letras.
                    </span>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMode("create_name")} style={{ flex: 1, padding: "16px", borderRadius: "12px", fontWeight: 600 }}>Atrás</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: "16px", borderRadius: "12px", fontWeight: 700 }}>CONTINUAR</button>
              </div>
            </form>
          )}

          {mode === "create_confirm" && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: "24px", fontSize: "20px", fontWeight: "700", textAlign: "center" }}>Confirmar creación de equipo</h3>
              
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "16px", padding: "20px", border: "1px solid var(--border-color)", marginBottom: "32px" }}>
                <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Nombre del equipo:</span>
                  <span style={{ fontWeight: "600", fontSize: "16px" }}>{teamName}</span>
                </div>
                <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Identificador:</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--val-red)", fontSize: "14px" }}>
                    {teamName.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Región Premier:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px", textAlign: "right" }}>
                    {conference === "NONE" ? "No participa" : conference}
                  </span>
                </div>
                {conference !== "NONE" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Equipo Premier:</span>
                    <span style={{ fontWeight: "600", fontSize: "14px", textAlign: "right", color: "var(--val-cyan)" }}>
                      {premierName} #{teamTag}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMode("create_premier")} style={{ flex: 1, padding: "16px", borderRadius: "12px", fontWeight: 600 }} disabled={loading}>Atrás</button>
                <button type="button" onClick={handleCreateTeam} disabled={loading} className="btn btn-primary" style={{ flex: 2, padding: "16px", borderRadius: "12px", fontWeight: 700 }}>
                  {loading ? "CREANDO..." : "CONFIRMAR Y CREAR"}
                </button>
              </div>
            </div>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoinTeam} style={{ marginTop: 24 }}>
              <div className="form-group" style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>IDENTIFICADOR DEL EQUIPO (SLUG)</label>
                <input 
                  type="text" 
                  value={joinSlug} 
                  onChange={(e) => setJoinSlug(e.target.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))} 
                  placeholder="ej. g2-esports" 
                  required 
                  style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s", fontFamily: "JetBrains Mono, monospace" }}
                />
                <span style={{ display: "block", marginTop: "12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                  Pídele el identificador corto (slug) al administrador de tu equipo para poder unirte.
                </span>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMode("choice")} style={{ flex: 1, padding: "16px", borderRadius: "12px", fontWeight: 600 }}>Volver</button>
                <button type="submit" disabled={loading || !joinSlug.trim()} className="btn btn-primary" style={{ flex: 2, padding: "16px", borderRadius: "12px", fontWeight: 700 }}>{loading ? "ENVIANDO..." : "SOLICITAR UNIÓN"}</button>
              </div>
            </form>
          )}

          {mode === "pending" && (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "24px", background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", marginBottom: 24, boxShadow: "0 0 30px rgba(0, 212, 170, 0.2)" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h2 style={{ fontSize: 24, marginBottom: 12, fontWeight: 800 }}>Solicitud Enviada</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
                Tu solicitud está pendiente de aprobación por el administrador del equipo. Vuelve más tarde o contacta con ellos.
              </p>
              <button className="btn btn-secondary" onClick={() => window.location.reload()} style={{ padding: "14px 24px", borderRadius: "12px" }}>
                Recargar página
              </button>
            </div>
          )}

          <div style={{ marginTop: "32px", textAlign: "center", paddingTop: "24px", borderTop: "1px solid var(--border-color)" }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => signOut({ callbackUrl: "/login" })} 
              style={{ fontSize: 13, padding: "10px 20px", borderRadius: "8px", color: "var(--text-muted)" }}
            >
              Cerrar Sesión
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
