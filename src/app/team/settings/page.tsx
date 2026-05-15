"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState({ name: "", slug: "", logo_url: "", tag: "", division: "" as string | number, inviteCode: "" as string | null });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canManage = session?.user?.role === "team_admin" || session?.user?.role === "super_admin";

  useEffect(() => {
    fetch("/api/team/current")
      .then(res => res.json())
      .then(data => {
        if (data.team) {
          setTeam(data.team);
        }
        setLoading(false);
      });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    
    try {
      const res = await fetch("/api/team/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: team.name, 
          logo_url: team.logo_url,
          tag: team.tag,
          division: team.division
        })
      });

      if (res.ok) {
        setMessage("✅ Configuración guardada correctamente");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("❌ Error al guardar los cambios");
      }
    } catch (err) {
      setMessage("❌ Error de conexión");
    }
  };

  if (!canManage) {
    return <div className="p-20 text-center">Acceso restringido a administradores de equipo.</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>⚙️ Ajustes de Equipo</h1>
        <p style={{ color: "var(--text-secondary)" }}>Configura la identidad y preferencias de tu organización</p>
      </header>

      <div className="page-content animate-in">
        <div className="grid grid-2" style={{ maxWidth: 1000 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Identidad del Equipo</h3>
            {loading ? <p>Cargando datos...</p> : (
              <form onSubmit={save}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Nombre del Equipo</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    value={team.name} 
                    onChange={e => setTeam({ ...team, name: e.target.value })} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Slug (Identificador en URL)</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    disabled 
                    value={team.slug} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>URL del Logo</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    placeholder="https://ejemplo.com/logo.png"
                    value={team.logo_url} 
                    onChange={e => setTeam({ ...team, logo_url: e.target.value })} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                    <label>Tag de Premier (#TAG)</label>
                    <input 
                      className="input-field" 
                      style={{ width: "100%" }} 
                      placeholder="Ej: ABC"
                      value={team.tag || ""} 
                      onChange={e => setTeam({ ...team, tag: e.target.value.toUpperCase().replace("#", "") })} 
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                    <label>División (Número)</label>
                    <input 
                      type="number"
                      className="input-field" 
                      style={{ width: "100%" }} 
                      placeholder="Ej: 15"
                      value={team.division || ""} 
                      onChange={e => setTeam({ ...team, division: e.target.value })} 
                    />
                  </div>
                </div>

                {message && (
                  <div style={{ padding: 12, background: "rgba(0,212,170,0.1)", color: "var(--val-cyan)", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                    {message}
                  </div>
                )}

                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </form>
            )}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Enlace de Invitación</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Comparte este enlace para que nuevos usuarios se unan directamente al equipo.</p>
            {loading ? <p>Cargando enlace...</p> : (
              <InviteLinkSection inviteCode={team.inviteCode} setTeam={setTeam} team={team} />
            )}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Solicitudes de Unión</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Gestiona quién puede unirse a tu equipo.</p>
            <JoinRequests />
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = () => {
    fetch("/api/teams/requests")
      .then(res => res.json())
      .then(data => {
        if (data.requests) setRequests(data.requests);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRequest = async (id: string, action: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/teams/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Cargando solicitudes...</p>;
  if (requests.length === 0) return <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No hay solicitudes pendientes.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {requests.map(req => (
        <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bg-glass)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{req.user.name || "Usuario"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.user.email}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              className="btn" 
              style={{ padding: "6px 12px", fontSize: 12, background: "var(--val-red)", color: "#fff", border: "none" }}
              onClick={() => handleRequest(req.id, "reject")}
            >
              Rechazar
            </button>
            <button 
              className="btn btn-primary" 
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => handleRequest(req.id, "approve")}
            >
              Aprobar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InviteLinkSection({ inviteCode, setTeam, team }: { inviteCode: string | null, setTeam: any, team: any }) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const inviteUrl = inviteCode ? `${window.location.origin}/register?invite=${inviteCode}` : "";

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateNewCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/team/invite", { method: "POST" });
      const data = await res.json();
      if (data.inviteCode) {
        setTeam({ ...team, inviteCode: data.inviteCode });
      }
    } catch (err) {
      console.error("Error al generar código", err);
    } finally {
      setGenerating(false);
    }
  };

  if (!inviteCode) {
    return (
      <button className="btn" onClick={generateNewCode} disabled={generating}>
        {generating ? "Generando..." : "Generar Enlace de Invitación"}
      </button>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input 
          className="input-field" 
          style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }} 
          value={inviteUrl} 
          readOnly 
        />
        <button className="btn btn-primary" onClick={handleCopy} style={{ minWidth: 100 }}>
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <button 
        className="btn" 
        onClick={generateNewCode} 
        disabled={generating}
        style={{ fontSize: 12, padding: "6px 12px", background: "transparent", color: "var(--val-red)", border: "1px solid rgba(255, 70, 85, 0.3)" }}
      >
        {generating ? "Generando..." : "Generar Nuevo Enlace (Invalida el actual)"}
      </button>
    </div>
  );
}
