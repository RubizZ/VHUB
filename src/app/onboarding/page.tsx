"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function OnboardingPage() {
  const [mode, setMode] = useState<"choice" | "create" | "join" | "pending">("choice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { update } = useSession();
  const router = useRouter();

  // Form states
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [conference, setConference] = useState("EU_IBIT");
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    // If the user already has a pending request, switch to pending mode
    fetch("/api/teams/requests/me")
      .then(res => res.json())
      .then(data => {
        if (data.request) {
          setMode("pending");
        }
      })
      .catch(() => {});
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      if (data.teams) setTeams(data.teams);
    } catch (err) {
      setError("Error al cargar los equipos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, slug: teamSlug, conference })
      });
      const data = await res.json();

      if (res.ok) {
        // Actualizamos la sesión en cliente antes de redirigir
        // Esto refresca el JWT para que el Middleware vea que ya tenemos equipo
        await update({ 
          teamId: data.team.id,
          role: "team_admin" // El creador suele ser admin
        });
        
        router.push("/");
      } else {
        setError(data.error || "Error al crear el equipo");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeamId })
      });
      const data = await res.json();

      if (res.ok) {
        setMode("pending");
      } else {
        setError(data.error || "Error al enviar la solicitud");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in" style={{ maxWidth: 500 }}>
        <div className="logo" style={{ marginBottom: 16 }}>
          <img src="/logo.png" alt="V-HUB Logo" style={{ width: 80, height: 80, borderRadius: 20 }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Bienvenido a V-HUB</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Parece que aún no perteneces a ningún equipo.
        </p>

        {error && (
          <div style={{ marginTop: 16, background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, border: "1px solid rgba(255, 70, 85, 0.2)" }}>
            {error}
          </div>
        )}

        {mode === "choice" && (
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <button 
              className="btn btn-primary" 
              onClick={() => setMode("create")}
              style={{ width: "100%", padding: "16px" }}
            >
              Crear un nuevo Equipo
            </button>
            <button 
              className="btn" 
              onClick={() => { setMode("join"); fetchTeams(); }}
              style={{ width: "100%", padding: "16px", background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
            >
              Unirme a un Equipo existente
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreateTeam} style={{ marginTop: 24 }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>NOMBRE DEL EQUIPO</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)} 
                placeholder="Ej. G2 Esports" 
                required 
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>IDENTIFICADOR CORTO (SLUG)</label>
              <input 
                type="text" 
                value={teamSlug} 
                onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
                placeholder="ej. g2" 
                required 
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>REGIÓN DE COMPETICIÓN (VALORANT PREMIER)</label>
              <select 
                value={conference} 
                onChange={(e) => setConference(e.target.value)} 
                required 
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
              >
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
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn" onClick={() => setMode("choice")} style={{ flex: 1, background: "var(--bg-glass)" }}>Volver</button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>{loading ? "Creando..." : "Crear Equipo"}</button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoinTeam} style={{ marginTop: 24 }}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>SELECCIONA UN EQUIPO</label>
              <select 
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
              >
                <option value="">-- Elige un equipo --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn" onClick={() => setMode("choice")} style={{ flex: 1, background: "var(--bg-glass)" }}>Volver</button>
              <button type="submit" disabled={loading || !selectedTeamId} className="btn btn-primary" style={{ flex: 2 }}>{loading ? "Enviando..." : "Solicitar Unión"}</button>
            </div>
          </form>
        )}

        {mode === "pending" && (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(0, 212, 170, 0.1)", color: "var(--val-green)", marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Solicitud Enviada</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
              Tu solicitud está pendiente de aprobación por el administrador del equipo. Vuelve más tarde o contacta con ellos.
            </p>
            <button className="btn" onClick={() => window.location.reload()} style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
              Recargar página
            </button>
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <button 
            className="btn" 
            onClick={() => signOut({ callbackUrl: "/login" })} 
            style={{ fontSize: 12, padding: "8px 16px", background: "transparent", color: "var(--val-red)", border: "1px solid rgba(255, 70, 85, 0.3)" }}
          >
            Cerrar Sesión
          </button>
        </div>

      </div>
    </div>
  );
}
