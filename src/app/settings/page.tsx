"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });
  const [message, setMessage] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí iría la lógica para actualizar el perfil en la DB
    setMessage("Configuración de cuenta guardada (Simulado)");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>🛠️ Mi Cuenta</h1>
        <p style={{ color: "var(--text-secondary)" }}>Gestiona tu perfil personal y seguridad</p>
      </header>

      <div className="page-content animate-in">
        <div className="grid grid-2" style={{ maxWidth: 1000 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Perfil Personal</h3>
            <form onSubmit={save}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Nombre de Usuario</label>
                <input 
                  className="input-field" 
                  style={{ width: "100%" }} 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Correo Electrónico</label>
                <input 
                  className="input-field" 
                  style={{ width: "100%" }} 
                  disabled 
                  value={form.email} 
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  El email no puede ser cambiado por razones de seguridad.
                </p>
              </div>

              {message && (
                <div style={{ padding: 12, background: "rgba(0,212,170,0.1)", color: "var(--val-cyan)", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                  {message}
                </div>
              )}

              <button type="submit" className="btn btn-primary">Actualizar Perfil</button>
            </form>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Seguridad</h3>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Cambiar Contraseña</label>
              <input 
                className="input-field" 
                style={{ width: "100%", marginBottom: 12 }} 
                type="password" 
                placeholder="Contraseña actual" 
              />
              <input 
                className="input-field" 
                style={{ width: "100%", marginBottom: 12 }} 
                type="password" 
                placeholder="Nueva contraseña" 
              />
              <button className="btn btn-secondary">Cambiar Contraseña</button>
            </div>
            
            <div style={{ marginTop: 32, padding: 20, background: "rgba(255, 70, 85, 0.05)", borderRadius: 12, border: "1px solid rgba(255, 70, 85, 0.1)" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--val-red)" }}>Zona de Peligro</h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                Eliminar tu cuenta es irreversible. Perderás todas tus estadísticas y mensajes.
              </p>
              <button className="btn btn-ghost" style={{ color: "var(--val-red)", borderColor: "var(--val-red)" }}>Eliminar mi cuenta</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
