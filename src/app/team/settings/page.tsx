"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState({ name: "", slug: "", logo_url: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canManage = session?.user?.role === "team_admin" || session?.user?.role === "super_admin";

  useEffect(() => {
    // Aquí cargaríamos los datos del equipo actual desde una API
    setTeam({ 
      name: "7R Premier", 
      slug: "7r-premier", 
      logo_url: "" 
    });
    setLoading(false);
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Configuración del equipo guardada (Simulado)");
    setTimeout(() => setMessage(""), 3000);
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

                {message && (
                  <div style={{ padding: 12, background: "rgba(0,212,170,0.1)", color: "var(--val-cyan)", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                    {message}
                  </div>
                )}

                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </form>
            )}
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
            <div style={{ 
              width: 120, height: 120, borderRadius: 20, background: "var(--val-red)", 
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 800, marginBottom: 20
            }}>
              {team.name[0]}
            </div>
            <h3>Vista Previa del Equipo</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Así es como otros equipos verán a 7R Premier en la plataforma.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
