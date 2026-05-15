"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface PlayerData {
  id: number;
  name: string;
  riot_name: string;
  riot_tag: string;
  role: string;
  avatar_color: string;
  puuid: string | null;
  dataConsent: boolean;
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
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Error al actualizar", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-32">Cargando perfil...</div>;

  return (
    <div className="page-content animate-in">
      <div className="page-header">
        <h2>👤 Mi Perfil</h2>
        <p>Gestiona tu identidad en el equipo y vincula tus juegos</p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Información del Equipo</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div className="chat-avatar" style={{ width: 80, height: 80, fontSize: 32, background: player?.avatar_color }}>
              {player?.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{player?.name}</div>
              <div style={{ color: "var(--text-muted)" }}>{session?.user?.email}</div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Rol Preferido</label>
            <select 
              value={player?.role} 
              onChange={(e) => handleUpdateProfile({ role: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="duelist">Duelista</option>
              <option value="initiator">Iniciador</option>
              <option value="controller">Controlador</option>
              <option value="sentinel">Centinela</option>
              <option value="flex">Flex</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Color de Avatar</label>
            <div style={{ display: "flex", gap: 8 }}>
              {['#FF4655', '#00D4AA', '#A855F7', '#3B82F6', '#F59E0B'].map(c => (
                <div 
                  key={c}
                  onClick={() => handleUpdateProfile({ avatar_color: c })}
                  style={{ 
                    width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer",
                    border: player?.avatar_color === c ? "3px solid #fff" : "none"
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Vinculación con Riot Games</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Vincula tu cuenta para que el equipo pueda ver tus estadísticas y analizar tus partidas automáticamente.
          </p>

          <div style={{ background: "rgba(0,0,0,0.2)", padding: 16, borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, marginBottom: 4 }}>RIOT ID</label>
                <input 
                  value={riotName} 
                  onChange={e => setRiotName(e.target.value)}
                  placeholder="Nombre" 
                />
              </div>
              <div style={{ width: 80 }}>
                <label style={{ display: "block", fontSize: 11, marginBottom: 4 }}>TAG</label>
                <input 
                  value={riotTag} 
                  onChange={e => setRiotTag(e.target.value)}
                  placeholder="7R" 
                />
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: "100%" }}
              onClick={handleSyncRiot}
              disabled={saving}
            >
              {player?.puuid ? "🔄 Actualizar Vínculo" : "🔗 Vincular Cuenta"}
            </button>
          </div>

          {player?.puuid && (
            <div style={{ marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--val-cyan)", fontSize: 13, marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <strong>Cuenta Vinculada:</strong><br/>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>{player.puuid}</span>
                </div>
              </div>

              <div className="card" style={{ background: "rgba(255, 70, 85, 0.05)", border: "1px solid rgba(255, 70, 85, 0.1)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--val-red)", marginBottom: 4 }}>Consentimiento de Datos</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Permito que V-HUB procese mis estadísticas de partidas para el análisis del equipo. Si lo desactivas, no aparecerás en las analíticas ni se guardarán tus registros de partidas.
                    </div>
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
            </div>
          )}

          {message.text && (
            <div style={{ 
              marginTop: 16, padding: 10, borderRadius: 8, fontSize: 13,
              background: message.type === "success" ? "rgba(0,212,170,0.1)" : "rgba(255,70,85,0.1)",
              color: message.type === "success" ? "var(--val-cyan)" : "var(--val-red)"
            }}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
