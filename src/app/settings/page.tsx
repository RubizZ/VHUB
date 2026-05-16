"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Skeleton } from "@/components/Skeleton";

export default function AccountSettingsPage() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });
  const [message, setMessage] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Configuración de cuenta guardada correctamente");
    setTimeout(() => setMessage(""), 3000);
  };

  if (status === "loading") {
    return (
      <div className="page-content animate-in">
        <div className="grid grid-2" style={{ gap: 32 }}>
           <Skeleton width="100%" height={500} style={{ borderRadius: 24 }} />
           <Skeleton width="100%" height={500} style={{ borderRadius: 24 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-wrapper">
      <header className="page-header" style={{ marginBottom: 40 }}>
        <span className="badge" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", marginBottom: 8 }}>CONFIGURACIÓN</span>
        <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Mi Cuenta</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Seguridad, preferencias y privacidad de la plataforma</p>
      </header>

      <div className="grid grid-2" style={{ gap: 32 }}>
        <div className="card glass-card premium-border" style={{ padding: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
             <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--val-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
             <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Perfil Personal</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Datos básicos de tu cuenta</p>
             </div>
          </div>
          
          <form onSubmit={save}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8, display: "block", letterSpacing: 1 }}>NOMBRE DE USUARIO</label>
              <input 
                className="input-field" 
                style={{ width: "100%", height: 52, borderRadius: 12 }} 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="Nombre completo"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8, display: "block", letterSpacing: 1 }}>CORREO ELECTRÓNICO</label>
              <input 
                className="input-field" 
                style={{ width: "100%", height: 52, borderRadius: 12, opacity: 0.6 }} 
                disabled 
                value={form.email} 
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
                 <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--val-red)" }} />
                 <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Email bloqueado para cambios de seguridad</span>
              </div>
            </div>

            {message && (
              <div className="animate-in" style={{ padding: 16, background: "rgba(0,212,170,0.1)", color: "var(--val-cyan)", borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 600, textAlign: "center", border: "1px solid rgba(0,212,170,0.2)" }}>
                {message}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 52, borderRadius: 12, fontWeight: 900 }}>
               Guardar Cambios
            </button>
          </form>
        </div>

        <div className="card glass-card premium-border" style={{ padding: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
             <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--val-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔐</div>
             <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Seguridad</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Control de acceso y protección</p>
             </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 12, display: "block", letterSpacing: 1 }}>CAMBIAR CONTRASEÑA</label>
            <input 
              className="input-field" 
              style={{ width: "100%", height: 52, borderRadius: 12, marginBottom: 16 }} 
              type="password" 
              placeholder="Contraseña actual" 
            />
            <input 
              className="input-field" 
              style={{ width: "100%", height: 52, borderRadius: 12, marginBottom: 24 }} 
              type="password" 
              placeholder="Nueva contraseña" 
            />
            <button className="btn btn-secondary" style={{ width: "100%", height: 52, borderRadius: 12, fontWeight: 800 }}>Actualizar Credenciales</button>
          </div>
          
          <div className="danger-zone" style={{ marginTop: 20, padding: 24, background: "rgba(255, 70, 85, 0.03)", borderRadius: 20, border: "1px solid rgba(255, 70, 85, 0.1)" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "var(--val-red)", fontSize: 15, fontWeight: 800 }}>Zona Crítica</h4>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
              La eliminación de la cuenta es permanente. Se borrarán todos tus datos tácticos, mensajes y estadísticas de equipo.
            </p>
            <button className="btn btn-ghost" style={{ width: "100%", color: "var(--val-red)", borderColor: "rgba(255, 70, 85, 0.2)", height: 48, borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
               ELIMINAR MI CUENTA
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-wrapper {
          max-width: 1100px;
          margin: 0 auto;
        }
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          border-radius: 24px;
        }
      `}</style>
    </div>
  );
}
