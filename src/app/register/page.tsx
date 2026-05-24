"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useSearchParams } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrarse");
        setLoading(false);
        return;
      }

      // Auto login after successful registration
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        if (inviteCode) {
          router.push("/");
        } else {
          router.push("/onboarding");
        }
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

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
        <div className="auth-card">
          <h2 className="auth-title">Crear Cuenta</h2>
          <p className="auth-subtitle">Únete a V-HUB para gestionar tu equipo</p>
          
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", marginBottom: "24px", border: "1px solid rgba(255, 70, 85, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>NOMBRE O ALIAS</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Tu nombre en el juego" 
                required 
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>CORREO ELECTRÓNICO</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="ejemplo@vhub.com" 
                required 
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px" }}>CONTRASEÑA</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", color: "#fff", transition: "all 0.2s" }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="btn btn-primary" 
              style={{ width: "100%", padding: "16px", fontSize: "16px", fontWeight: 700, borderRadius: "12px", letterSpacing: "1px" }}
            >
              {loading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
            </button>
          </form>

          <div style={{ marginTop: "32px", textAlign: "center", fontSize: "14px", color: "var(--text-muted)", paddingTop: "24px", borderTop: "1px solid var(--border-color)" }}>
            ¿Ya tienes cuenta? <Link href="/login" style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid var(--val-red)", paddingBottom: "2px", transition: "all 0.2s" }}>Inicia sesión aquí</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
