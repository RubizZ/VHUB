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
    <div className="login-page">
      <div className="login-card animate-in">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <img src="/logo.png" alt="V-HUB Logo" style={{ width: 80, height: 80, borderRadius: 20 }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: "center" }}>Crear Cuenta</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Únete a V-HUB para gestionar tu equipo</p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          {error && (
            <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 20, border: "1px solid rgba(255, 70, 85, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>NOMBRE O ALIAS</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Tu nombre" 
              required 
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>EMAIL</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="ejemplo@vhub.com" 
              required 
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>CONTRASEÑA</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="btn btn-primary" 
            style={{ width: "100%", padding: "14px", fontSize: 16, fontWeight: 700 }}
          >
            {loading ? "Creando cuenta..." : "CREAR CUENTA"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          ¿Ya tienes cuenta? <Link href="/login" style={{ color: "var(--val-red)", textDecoration: "none" }}>Inicia sesión aquí</Link>
        </div>
      </div>
    </div>
  );
}
