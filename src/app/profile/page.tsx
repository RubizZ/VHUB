"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

export default function ProfilePage() {
  const { data: session } = useSession();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [riotName, setRiotName] = useState("");
  const [riotTag, setRiotTag] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (session?.user) {
      fetch(`/api/players/me`)
        .then(r => r.json())
        .then(data => {
          if (data.player) {
            setPlayer(data.player);
            setRiotName(data.player.riot_name || "");
            setRiotTag(data.player.riot_tag || "");
          }
          setLoading(false);
        });
    }
  }, [session]);

  const handleSyncRiot = async () => {
    if (!riotName || !riotTag) return;
    setSaving(true);
    setMessage({ text: "Sincronizando con Riot Games...", type: "info" });

    try {
      const res = await fetch("/api/valorant/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotName, riotTag })
      });

      const data = await res.json();
      if (res.ok) {
        setPlayer(prev => prev ? { ...prev, puuid: data.puuid, riot_name: riotName, riot_tag: riotTag } : null);
        setMessage({ text: "¡Cuenta de Riot vinculada correctamente!", type: "success" });
      } else {
        setMessage({ text: data.error || "Error al sincronizar", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Error de conexión", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (updates: Partial<PlayerData>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/players/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setPlayer(prev => prev ? { ...prev, ...updates } : null);
        setMessage({ text: "Perfil actualizado", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Error al actualizar", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content animate-in">
        <Skeleton width="100%" height={300} style={{ borderRadius: 24, marginBottom: 32 }} />
        <div className="grid grid-2" style={{ gap: 32 }}>
           <Skeleton width="100%" height={400} style={{ borderRadius: 24 }} />
           <Skeleton width="100%" height={400} style={{ borderRadius: 24 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-wrapper">
      {/* Hero Section */}
      <div className="profile-hero card glass-card premium-border" style={{ 
        padding: 0, marginBottom: 32, overflow: "hidden", 
        background: `linear-gradient(to right, ${player?.avatar_color}22 0%, rgba(20, 20, 26, 0.8) 100%)`
      }}>
        <div className="hero-glow" style={{ background: `radial-gradient(circle at 10% 50%, ${player?.avatar_color}33 0%, transparent 70%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, padding: 40, position: "relative" }}>
           <div className="avatar-container" style={{ position: "relative" }}>
              <div className="profile-avatar" style={{ 
                width: 140, height: 140, borderRadius: 32, fontSize: 60, fontWeight: 900, color: "#fff",
                background: player?.avatar_color, boxShadow: `0 10px 30px ${player?.avatar_color}44`,
                display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid rgba(255,255,255,0.1)"
              }}>
                {player?.name[0]}
              </div>
              <div className="status-badge-online">En Línea</div>
           </div>
           
           <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                 <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: "-1.5px" }}>{player?.name}</h1>
                 {player?.team && <span className="team-badge">#{player.team.tag}</span>}
              </div>
              <p style={{ fontSize: 18, color: "var(--text-secondary)", margin: 0 }}>{session?.user?.email}</p>
              <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
                 <div className="hero-stat">
                    <span className="label">ROL PRINCIPAL</span>
                    <span className="value">{player?.role.toUpperCase()}</span>
                 </div>
                 <div className="hero-stat">
                    <span className="label">ORGANIZACIÓN</span>
                    <span className="value">{player?.team?.name || "SIN EQUIPO"}</span>
                 </div>
              </div>
           </div>

           <div className="hero-actions">
              <button className="btn btn-primary" style={{ height: 48, padding: "0 24px", borderRadius: 12, fontWeight: 800 }}>
                 Compartir Perfil
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 32 }}>
        {/* Left Column: Personal Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="card glass-card premium-border" style={{ padding: 32 }}>
            <h3 style={{ margin: "0 0 24px 0", fontSize: 20, fontWeight: 800 }}>Configuración de Identidad</h3>
            
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, display: "block" }}>Rol en Partida</label>
              <div className="role-selector-grid">
                {['duelist', 'initiator', 'controller', 'sentinel', 'flex'].map(r => (
                  <button 
                    key={r}
                    className={`role-option ${player?.role === r ? 'active' : ''}`}
                    onClick={() => handleUpdateProfile({ role: r })}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, display: "block" }}>Color de Identidad</label>
              <div style={{ display: "flex", gap: 12 }}>
                {['#FF4655', '#00D4AA', '#A855F7', '#3B82F6', '#F59E0B', '#FFFFFF'].map(c => (
                  <div 
                    key={c}
                    onClick={() => handleUpdateProfile({ avatar_color: c })}
                    className={`color-bubble ${player?.avatar_color === c ? 'active' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {player?.puuid && (
            <div className="card glass-card premium-border" style={{ padding: 32, background: "rgba(255, 70, 85, 0.02)", border: "1px solid rgba(255, 70, 85, 0.1)" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, paddingRight: 24 }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800, color: "var(--val-red)" }}>Privacidad de Analíticas</h3>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      Al activar esta opción, permites que V-HUB guarde tus registros de partidas y los procese para mostrar estadísticas avanzadas al equipo.
                    </p>
                  </div>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={player.dataConsent} 
                      onChange={(e) => handleUpdateProfile({ dataConsent: e.target.checked })} 
                    />
                    <span className="slider round"></span>
                  </label>
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Game Link */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="card glass-card premium-border" style={{ padding: 32 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 800 }}>Vinculación de Juegos</h3>
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

              <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>NOMBRE</label>
                  <input 
                    className="input-field"
                    style={{ height: 48, borderRadius: 12 }}
                    value={riotName} 
                    onChange={e => setRiotName(e.target.value)}
                    placeholder="TenZ" 
                  />
                </div>
                <div style={{ width: 100 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>TAG</label>
                  <input 
                    className="input-field"
                    style={{ height: 48, borderRadius: 12 }}
                    value={riotTag} 
                    onChange={e => setRiotTag(e.target.value)}
                    placeholder="NA1" 
                  />
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: "100%", height: 52, borderRadius: 12, fontWeight: 900, letterSpacing: 0.5 }}
                onClick={handleSyncRiot}
                disabled={saving}
              >
                {saving ? "Sincronizando..." : player?.puuid ? "🔄 Actualizar Vínculo" : "🔗 Conectar Valorant"}
              </button>

              {player?.puuid && (
                <div style={{ marginTop: 24, padding: 16, background: "rgba(0, 212, 170, 0.05)", borderRadius: 12, border: "1px solid rgba(0, 212, 170, 0.1)", fontSize: 12, color: "var(--val-cyan)" }}>
                   ID único detectado: <strong>{player.puuid.substring(0, 20)}...</strong>
                </div>
              )}
            </div>

            {message.text && (
              <div className="animate-in" style={{ 
                marginTop: 20, padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: "center",
                background: message.type === "success" ? "rgba(0,212,170,0.1)" : "rgba(255,70,85,0.1)",
                color: message.type === "success" ? "var(--val-cyan)" : "var(--val-red)",
                border: `1px solid ${message.type === "success" ? "rgba(0,212,170,0.2)" : "rgba(255,70,85,0.2)"}`
              }}>
                {message.text}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }
        .premium-border {
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .hero-glow {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
        }
        .status-badge-online {
          position: absolute;
          bottom: 4px; right: 4px;
          background: var(--val-cyan);
          color: #000;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 8px;
          border: 3px solid rgba(20, 20, 26, 1);
        }
        .team-badge {
          background: rgba(255, 70, 85, 0.1);
          color: var(--val-red);
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 800;
          border: 1px solid rgba(255, 70, 85, 0.2);
        }
        .hero-stat {
           display: flex;
           flex-direction: column;
           padding-right: 24px;
           border-right: 1px solid rgba(255,255,255,0.1);
        }
        .hero-stat:last-child { border: none; }
        .hero-stat .label { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; }
        .hero-stat .value { font-size: 16px; font-weight: 900; color: #fff; }

        .role-selector-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .role-option {
          padding: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-option:hover { background: rgba(255,255,255,0.08); }
        .role-option.active {
          background: var(--val-red);
          color: #fff;
          border-color: var(--val-red);
          box-shadow: 0 4px 15px rgba(255, 70, 85, 0.3);
        }
        .color-bubble {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 3px solid transparent;
        }
        .color-bubble:hover { transform: scale(1.1); }
        .color-bubble.active {
          border-color: #fff;
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}
