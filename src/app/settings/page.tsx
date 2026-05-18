/* global fetch, console, setTimeout, window */
"use client";
import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/Skeleton";

interface PlayerData {
  id: number;
  name: string;
  riot_name: string;
  riot_tag: string;
  role: string;
  avatar_color: string;
  puuid: string | null;
  dataConsent: boolean;
  team?: { name: string; tag: string };
}

export default function AccountSettingsPage() {
  const { data: session, status } = useSession();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRiot, setSavingRiot] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [riotName, setRiotName] = useState("");
  const [riotTag, setRiotTag] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
  });
  const [profileMessage, setProfileMessage] = useState({ text: "", type: "" });
  const [riotMessage, setRiotMessage] = useState({ text: "", type: "" });
  const [privacyMessage, setPrivacyMessage] = useState({ text: "", type: "" });
  const [localConsent, setLocalConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setForm(prev => ({
        ...prev,
        name: session.user?.name || "",
        email: session.user?.email || "",
      }));

      fetch(`/api/players/me`)
        .then(res => {
          if (res.status === 404) {
            setLoading(false);
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data && data.player) {
            setPlayer(data.player);
            setForm({
              name: data.player.name || session.user?.name || "",
              email: session.user?.email || "",
            });
            setRiotName(data.player.riot_name || "");
            setRiotTag(data.player.riot_tag || "");
            setLocalConsent(data.player.dataConsent || false);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  const renderLocalMessage = (msg: { text: string; type: string }) => {
    if (!msg.text) return null;
    return (
      <div className="animate-in" style={{
        padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "left", marginBottom: 24,
        background: msg.type === "success" ? "rgba(0,212,170,0.06)" : msg.type === "info" ? "rgba(59,130,246,0.06)" : "rgba(255,70,85,0.06)",
        color: msg.type === "success" ? "var(--val-cyan)" : msg.type === "info" ? "#3B82F6" : "var(--val-red)",
        border: `1px solid ${msg.type === "success" ? "rgba(0,212,170,0.15)" : msg.type === "info" ? "rgba(59,130,246,0.15)" : "rgba(255,70,85,0.15)"}`
      }}>
        {msg.text}
      </div>
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage({ text: "Guardando cambios...", type: "info" });
    try {
      const res = await fetch("/api/players/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.player) {
          setPlayer(data.player);
        }
        setProfileMessage({ text: "Configuración de cuenta guardada correctamente", type: "success" });
        setTimeout(() => setProfileMessage({ text: "", type: "" }), 3000);
      } else {
        const d = await res.json();
        setProfileMessage({ text: d.error || "Error al guardar cambios", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setProfileMessage({ text: "Error al guardar cambios", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSyncRiot = async () => {
    if (!riotName || !riotTag) {
      setRiotMessage({ text: "Introduce tu Riot ID y Etiqueta (ej: Nombre#TAG)", type: "error" });
      return;
    }
    setSavingRiot(true);
    setRiotMessage({ text: "Sincronizando con Riot Games...", type: "info" });

    try {
      const res = await fetch("/api/valorant/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotName, riotTag })
      });

      const data = await res.json();
      if (res.ok) {
        setPlayer(prev => prev ? { ...prev, puuid: data.puuid, riot_name: riotName, riot_tag: riotTag } : null);
        setRiotMessage({ text: "¡Cuenta de Riot vinculada correctamente!", type: "success" });
        setTimeout(() => setRiotMessage({ text: "", type: "" }), 3000);
      } else {
        setRiotMessage({ text: data.error || "Error al sincronizar", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setRiotMessage({ text: "Error de conexión", type: "error" });
    } finally {
      setSavingRiot(false);
    }
  };

  const handleSavePrivacy = async (consent: boolean) => {
    setSavingPrivacy(true);
    setPrivacyMessage({ text: "Guardando cambios...", type: "info" });
    try {
      const res = await fetch("/api/players/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataConsent: consent })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.player) {
          setPlayer(data.player);
          setLocalConsent(data.player.dataConsent || false);
        }
        setPrivacyMessage({ text: "Preferencias de privacidad actualizadas", type: "success" });
        setTimeout(() => setPrivacyMessage({ text: "", type: "" }), 3000);
      } else {
        const d = await res.json();
        setPrivacyMessage({ text: d.error || "Error al actualizar privacidad", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setPrivacyMessage({ text: "Error al actualizar privacidad", type: "error" });
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "⚠ ATENCIÓN: ¿Estás completamente seguro de que deseas eliminar tu cuenta de forma permanente?\n\nEsta acción es irreversible: se borrarán todos tus datos, disponibilidades, mensajes y estadísticas de equipo. No podrás recuperar tu cuenta."
    );
    if (!confirmed) return;

    const secondConfirm = window.confirm(
      "CONFIRMACIÓN FINAL:\n\n¿Realmente deseas proceder con la eliminación definitiva de tu cuenta?"
    );
    if (!secondConfirm) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/players/me", {
        method: "DELETE",
      });

      if (res.ok) {
        window.alert("Tu cuenta ha sido eliminada correctamente.");
        await signOut({ callbackUrl: "/" });
      } else {
        const d = await res.json();
        window.alert(d.error || "Hubo un error al eliminar tu cuenta. Por favor, inténtalo de nuevo.");
      }
    } catch (err) {
      console.error(err);
      window.alert("Error de conexión al intentar eliminar la cuenta.");
    } finally {
      setDeleting(false);
    }
  };

  if (status === "loading" || loading) {
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
    <div className="settings-wrapper animate-in">
      <header className="page-header" style={{ marginBottom: 40 }}>
        <span className="badge" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", marginBottom: 8 }}>CONFIGURACIÓN</span>
        <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Mi Cuenta</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Seguridad, preferencias y privacidad de la plataforma</p>
      </header>

      <div className="grid grid-2" style={{ gap: 32 }}>
        {/* Left Column: Personal Identity & Game Link */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="card glass-card premium-border" style={{ padding: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
               <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--val-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
               <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Perfil Personal</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Datos básicos de tu cuenta</p>
               </div>
            </div>
            
            <form onSubmit={save}>
              {renderLocalMessage(profileMessage)}
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

              <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 52, borderRadius: 12, fontWeight: 900 }} disabled={savingProfile}>
                 {savingProfile ? "Guardando..." : "Guardar Cambios"}
              </button>
            </form>
          </div>

          <div className="card glass-card premium-border" style={{ padding: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--val-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎮</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Vinculación de Juegos</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Conecta tus cuentas externas de juego</p>
              </div>
            </div>
            
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32, lineHeight: 1.6 }}>
              Conecta tus cuentas externas para automatizar el seguimiento de tus partidas y MMR.
            </p>

            <div className="game-link-box" style={{
              background: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 32, border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, background: "#FF4655", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎮</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Valorant (Riot Games)</div>
                  <div style={{ fontSize: 12, color: player?.puuid ? "var(--val-cyan)" : "var(--text-muted)", fontWeight: 700 }}>
                    {player?.puuid ? "CONECTADO" : "PENDIENTE DE VINCULAR"}
                  </div>
                </div>
              </div>

              {renderLocalMessage(riotMessage)}

              <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>NOMBRE</label>
                  <input
                    className="input-field"
                    style={{ height: 48, borderRadius: 12, width: "100%" }}
                    value={riotName}
                    onChange={e => setRiotName(e.target.value)}
                    placeholder="TenZ"
                  />
                </div>
                <div style={{ width: 100 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>TAG</label>
                  <input
                    className="input-field"
                    style={{ height: 48, borderRadius: 12, width: "100%" }}
                    value={riotTag}
                    onChange={e => setRiotTag(e.target.value)}
                    placeholder="NA1"
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", height: 52, borderRadius: 12, fontWeight: 900, letterSpacing: 0.5 }}
                onClick={handleSyncRiot}
                disabled={savingRiot}
              >
                {savingRiot ? "Sincronizando..." : player?.puuid ? "🔄 Actualizar Vínculo" : "🔗 Conectar Valorant"}
              </button>

              {player?.puuid && (
                <div style={{ marginTop: 24, padding: 16, background: "rgba(0, 212, 170, 0.05)", borderRadius: 12, border: "1px solid rgba(0, 212, 170, 0.1)", fontSize: 12, color: "var(--val-cyan)" }}>
                  ID único detectado: <strong>{player?.puuid?.substring(0, 20)}...</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security & Privacy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
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
          </div>

          {player?.puuid && (
            <div className="card glass-card premium-border" style={{ padding: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--val-cyan)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🛡️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Privacidad</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Consentimiento y tratamiento de datos</p>
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 800 }}>Privacidad de Analíticas</h4>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    Al activar esta opción, permites que VHUB guarde tus registros de partidas y los procese para mostrar estadísticas avanzadas. Ten en cuenta que vincular tu cuenta hace que tus datos de juego y rendimiento asociados sean visibles para los miembros de tu equipo en esta plataforma.
                  </p>
                </div>
                <label className="switch" style={{ marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={localConsent}
                    disabled={savingPrivacy}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setLocalConsent(nextVal);
                      handleSavePrivacy(nextVal);
                    }}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {renderLocalMessage(privacyMessage)}
            </div>
          )}

          <div className="card glass-card premium-border" style={{ padding: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255, 70, 85, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚠️</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--val-red)" }}>Zona de Peligro</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Acciones irreversibles de la cuenta</p>
              </div>
            </div>
            
            <div className="danger-zone" style={{ padding: 24, background: "rgba(255, 70, 85, 0.03)", borderRadius: 20, border: "1px solid rgba(255, 70, 85, 0.1)" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--val-red)", fontSize: 15, fontWeight: 800 }}>Zona Crítica</h4>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
                La eliminación de la cuenta es permanente. Se borrarán todos tus datos tácticos, mensajes y estadísticas de equipo.
              </p>
              <button 
                className="btn btn-ghost" 
                style={{ width: "100%", color: "var(--val-red)", borderColor: "rgba(255, 70, 85, 0.2)", height: 48, borderRadius: 12, fontSize: 12, fontWeight: 800 }}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                 {deleting ? "ELIMINANDO..." : "ELIMINAR MI CUENTA"}
              </button>
            </div>
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

        /* Switch Toggle */
        .switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 28px;
          flex-shrink: 0;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255,255,255,0.08);
          transition: .4s;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .4s;
        }
        input:checked + .slider {
          background-color: var(--val-red);
        }
        input:focus + .slider {
          box-shadow: 0 0 1px var(--val-red);
        }
        input:checked + .slider:before {
          transform: translateX(22px);
          background-color: white;
        }
        .slider.round {
          border-radius: 28px;
        }
        .slider.round:before {
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
