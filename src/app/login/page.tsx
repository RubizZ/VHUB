"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Credenciales incorrectas");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-in">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="logo" style={{ fontSize: 48, marginBottom: 16 }}>7R</div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Premier Hub</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Inicia sesión para acceder al panel del equipo</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 20, border: "1px solid rgba(255, 70, 85, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>EMAIL</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="ejemplo@7r.com" 
              required 
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "#fff" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 32 }}>
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
            {loading ? "Iniciando sesión..." : "INICIAR SESIÓN"}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          ¿No tienes cuenta? Contacta con el administrador de 7R.
        </div>
      </div>

      <style jsx>{`
        .login-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: radial-gradient(circle at center, #1f2326 0%, #0f1113 100%);
          padding: 20px;
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 48px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .logo {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 900;
          color: var(--val-red);
          text-shadow: 0 0 20px rgba(255, 70, 85, 0.4);
        }
      `}</style>
    </div>
  );
}
