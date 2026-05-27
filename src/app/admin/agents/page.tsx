"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AgentSkill, ValorantAgent, SkillGeometry, SkillBehavior } from "@/lib/agents";

interface SkillFormData {
  name: string;
  description: string;
  color: string;
  charges: number;
  castTime: number;
  geometryType: "circle" | "rectangle" | "cone";
  geometryRadius: number;
  geometryWidth: number;
  geometryLength: number;
  geometryAngle: number;
  behaviorSpawn: "player" | "ground" | "wall" | "projectile";
  behaviorGroundRange: number;
  flagThroughWall: boolean;
  flagProjectile: boolean;
  projectileBounces: number;
  flagChargeable: boolean;
  chargeMinLength: number;
  chargeMaxLength: number;
  chargeTimePerMeter: number;
  flagRolling: boolean;
  rollWaveCount: number;
  rollTimeBetweenWaves: number;
}

export default function AdminAgentsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  const [editingSkillKey, setEditingSkillKey] = useState<string>("q");
  const [formData, setFormData] = useState<SkillFormData>({
    name: "",
    description: "",
    color: "",
    charges: 1,
    castTime: 0,
    geometryType: "circle",
    geometryRadius: 5,
    geometryWidth: 5,
    geometryLength: 5,
    geometryAngle: 90,
    behaviorSpawn: "player",
    behaviorGroundRange: 10,
    flagThroughWall: false,
    flagProjectile: false,
    projectileBounces: 1,
    flagChargeable: false,
    chargeMinLength: 10,
    chargeMaxLength: 35,
    chargeTimePerMeter: 0.1,
    flagRolling: false,
    rollWaveCount: 5,
    rollTimeBetweenWaves: 0.2,
  });

  const {
    data: agentsData,
    isLoading,
  } = useQuery<{ agents: ValorantAgent[] }>({
    queryKey: ["adminAgents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/skills");
      if (!res.ok) throw new Error("Error loading agents");
      return res.json();
    },
    enabled: session?.user?.role === "super_admin",
  });

  const agents = agentsData?.agents || [];
  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const handleOpenAgent = (agent: ValorantAgent) => {
    setSelectedAgent(agent);
    loadSkillForm(agent, "q");
  };

  const loadSkillForm = (agent: ValorantAgent, key: string) => {
    setEditingSkillKey(key);
    const skill = agent.skills.find(s => s.key === key);
    if (skill) {
      setFormData({
        name: skill.name,
        description: skill.description || "",
        color: skill.color || "",
        charges: skill.behavior?.charges || 1,
        castTime: skill.behavior?.castTime || 0,
        geometryType: skill.geometry?.type || "circle",
        geometryRadius: skill.geometry?.radius || 5,
        geometryWidth: skill.geometry?.width || 5,
        geometryLength: skill.geometry?.length || 5,
        geometryAngle: skill.geometry?.angle || 90,
        behaviorSpawn: skill.behavior?.spawn || "player",
        behaviorGroundRange: skill.behavior?.maxCastRange || skill.behavior?.groundRange || 10,
        flagThroughWall: skill.behavior?.flags?.throughWall || false,
        flagProjectile: skill.behavior?.flags?.projectile || false,
        projectileBounces: skill.behavior?.projectileBounces || 1,
        flagChargeable: skill.behavior?.flags?.chargeable || false,
        chargeMinLength: skill.behavior?.chargeMinLength || 10,
        chargeMaxLength: skill.behavior?.chargeMaxLength || 35,
        chargeTimePerMeter: skill.behavior?.chargeTimePerMeter || 0.1,
        flagRolling: skill.behavior?.flags?.rolling || false,
        rollWaveCount: skill.behavior?.rollWaveCount || 5,
        rollTimeBetweenWaves: skill.behavior?.rollTimeBetweenWaves || 0.2,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "",
        charges: 1,
        castTime: 0,
        geometryType: "circle",
        geometryRadius: 5,
        geometryWidth: 5,
        geometryLength: 5,
        geometryAngle: 90,
        behaviorSpawn: "player",
        behaviorGroundRange: 10,
        flagThroughWall: false,
        flagProjectile: false,
        projectileBounces: 1,
        flagChargeable: false,
        chargeMinLength: 10,
        chargeMaxLength: 35,
        chargeTimePerMeter: 0.1,
        flagRolling: false,
        rollWaveCount: 5,
        rollTimeBetweenWaves: 0.2,
      });
    }
  };

  const saveSkillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) return;
      const payload: Omit<AgentSkill, "id"> = {
        agentId: selectedAgent.id,
        key: editingSkillKey,
        name: formData.name,
        description: formData.description,
        color: formData.color,
        geometry: {
          type: formData.geometryType,
          radius: formData.geometryType === "circle" ? Number(formData.geometryRadius) : undefined,
          width: formData.geometryType !== "circle" ? Number(formData.geometryWidth) : undefined,
          length: formData.geometryType !== "circle" ? Number(formData.geometryLength) : undefined,
          angle: formData.geometryType === "cone" ? Number(formData.geometryAngle) : undefined,
        },
        behavior: {
          charges: Number(formData.charges),
          castTime: Number(formData.castTime),
          spawn: formData.behaviorSpawn,
          maxCastRange: Number(formData.behaviorGroundRange) || undefined,
          projectileBounces: formData.flagProjectile ? Number(formData.projectileBounces) : undefined,
          chargeMinLength: formData.flagChargeable ? Number(formData.chargeMinLength) : undefined,
          chargeMaxLength: formData.flagChargeable ? Number(formData.chargeMaxLength) : undefined,
          chargeTimePerMeter: formData.flagChargeable ? Number(formData.chargeTimePerMeter) : undefined,
          rollWaveCount: formData.flagRolling ? Number(formData.rollWaveCount) : undefined,
          rollTimeBetweenWaves: formData.flagRolling ? Number(formData.rollTimeBetweenWaves) : undefined,
          flags: {
            throughWall: formData.flagThroughWall,
            projectile: formData.flagProjectile,
            chargeable: formData.flagChargeable,
            rolling: formData.flagRolling
          }
        }
      };
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Error saving skill");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAgents"] });
      alert("Habilidad guardada correctamente");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSkillMutation.mutate();
  };

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">Acceso restringido.</div>;
  }

  return (
    <div className="admin-wrapper">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
        <div>
          <span className="badge" style={{ background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", marginBottom: 8 }}>PLATFORM MANAGEMENT</span>
          <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Agentes y Habilidades</h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Configuración de geometría e interacción para el editor de estrategias</p>
        </div>
        <div>
           <div style={{ position: "relative" }}>
             <input 
               type="text" 
               className="input-field" 
               placeholder="Buscar agente..." 
               style={{ width: 320, paddingLeft: 40, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: "absolute", left: 14, top: 15, color: "var(--text-muted)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
           </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-4" style={{ gap: 24 }}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} width="100%" height={200} style={{ borderRadius: 24 }} />)}
        </div>
      ) : (
        <div className="grid grid-4" style={{ gap: 24 }}>
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="agent-card card glass-card" onClick={() => handleOpenAgent(agent)}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <img src={agent.displayIcon} style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} alt={agent.name} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{agent.name}</h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{agent.role}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                 {["q", "e", "c", "x"].map(key => {
                   const hasSkill = agent.skills.some(s => s.key === key);
                   return (
                     <div key={key} style={{ 
                       flex: 1, textAlign: "center", padding: "4px", borderRadius: 4, 
                       background: hasSkill ? "rgba(0, 212, 170, 0.2)" : "rgba(255, 70, 85, 0.2)",
                       color: hasSkill ? "var(--val-cyan)" : "var(--val-red)",
                       fontSize: 10, fontWeight: 800, textTransform: "uppercase"
                     }}>
                       {key}
                     </div>
                   );
                 })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAgent && (
        <div className="modal-overlay">
          <div className="modal-content card glass-card premium-modal" style={{ maxWidth: 700, width: "95%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
               <div>
                 <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Habilidades de {selectedAgent.name}</h2>
                 <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Configura cómo interactúan en el editor 2D</p>
               </div>
               <button className="icon-action-btn" onClick={() => setSelectedAgent(null)}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ width: 120, display: "flex", flexDirection: "column", gap: 8 }}>
                {["q", "e", "c", "x"].map(key => (
                  <button 
                    key={key} 
                    className={`btn ${editingSkillKey === key ? "btn-primary" : "btn-secondary"}`}
                    style={{ textTransform: "uppercase", fontWeight: 800, height: 48 }}
                    onClick={() => loadSkillForm(selectedAgent, key)}
                  >
                    Habilidad {key}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }}>
                <form onSubmit={handleSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: 24, borderRadius: 16 }}>
                  <h3 style={{ marginTop: 0, textTransform: "uppercase", color: "var(--val-yellow)" }}>Configurando {editingSkillKey}</h3>
                  
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nombre Habilidad</label>
                    <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  
                  <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Color Base (Hex) - opcional</label>
                      <input className="input-field" placeholder="#FF4655" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ width: 120 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cargas</label>
                      <input type="number" min="1" max="10" className="input-field" value={formData.charges} onChange={e => setFormData({...formData, charges: Number(e.target.value)})} />
                    </div>
                    <div className="form-group" style={{ width: 120 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Casteo (s)</label>
                      <input type="number" step="0.1" min="0" className="input-field" value={formData.castTime} onChange={e => setFormData({...formData, castTime: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                    <div className="form-group" style={{ flex: "1 1 100%" }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Forma Geométrica</label>
                      <select className="input-field" value={formData.geometryType} onChange={e => setFormData({...formData, geometryType: e.target.value})}>
                        <option value="circle">Círculo / Área</option>
                        <option value="rectangle">Rectángulo / Línea</option>
                        <option value="cone">Cono</option>
                      </select>
                    </div>
                    {formData.geometryType === "circle" && (
                      <div className="form-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Radio (m)</label>
                        <input type="number" className="input-field" value={formData.geometryRadius} onChange={e => setFormData({...formData, geometryRadius: Number(e.target.value)})} />
                      </div>
                    )}
                    {formData.geometryType !== "circle" && (
                      <>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Ancho (m)</label>
                          <input type="number" className="input-field" value={formData.geometryWidth} onChange={e => setFormData({...formData, geometryWidth: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo/Alcance (m)</label>
                          <input type="number" className="input-field" value={formData.geometryLength} onChange={e => setFormData({...formData, geometryLength: Number(e.target.value)})} />
                        </div>
                      </>
                    )}
                    {formData.geometryType === "cone" && (
                      <div className="form-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Ángulo (grados)</label>
                        <input type="number" className="input-field" value={formData.geometryAngle} onChange={e => setFormData({...formData, geometryAngle: Number(e.target.value)})} />
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Comportamiento de Spawn base</label>
                    <select className="input-field" value={formData.behaviorSpawn} onChange={e => setFormData({...formData, behaviorSpawn: e.target.value})}>
                      <option value="player">Sale de la posición del jugador</option>
                      <option value="ground">Se coloca en el suelo libremente (ej. Humos)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rango máx. de casteo/colocación (m, 0 = infinito)</label>
                    <input type="number" className="input-field" value={formData.behaviorGroundRange} onChange={e => setFormData({...formData, behaviorGroundRange: Number(e.target.value)})} />
                  </div>

                  <h4 style={{ color: "var(--val-cyan)", textTransform: "uppercase", fontSize: 14, fontWeight: 900, marginBottom: 12 }}>Flags de Comportamiento</h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", gap: 12, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 12 }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, textAlign: "left", margin: 0 }}>
                        <input type="checkbox" checked={formData.flagThroughWall} onChange={e => setFormData({...formData, flagThroughWall: e.target.checked})} style={{ margin: 0, marginTop: 3, flex: "0 0 auto", width: "auto" }} />
                        <span>Atraviesa paredes (se tira contra un muro y sale por el otro lado)</span>
                      </label>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, textAlign: "left", margin: 0 }}>
                        <input type="checkbox" checked={formData.flagProjectile} onChange={e => setFormData({...formData, flagProjectile: e.target.checked})} style={{ margin: 0, marginTop: 3, flex: "0 0 auto", width: "auto" }} />
                        <span>Es un proyectil (se puede lanzar con rebotes o parábola)</span>
                      </label>
                    </div>
                    
                    {formData.flagProjectile && (
                      <div className="form-group" style={{ marginTop: 8, paddingLeft: 24 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rebotes Máx. (0 = infinito)</label>
                        <input type="number" min="0" className="input-field" value={formData.projectileBounces} onChange={e => setFormData({...formData, projectileBounces: Number(e.target.value)})} style={{ width: 120 }} />
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, textAlign: "left", margin: 0 }}>
                        <input type="checkbox" checked={formData.flagChargeable} onChange={e => setFormData({...formData, flagChargeable: e.target.checked})} style={{ margin: 0, marginTop: 3, flex: "0 0 auto", width: "auto" }} />
                        <span>Se puede cargar (ej. Stun de Breach)</span>
                      </label>
                    </div>

                    {formData.flagChargeable && (
                      <div className="form-row" style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: 24 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo Mínimo (m)</label>
                          <input type="number" className="input-field" value={formData.chargeMinLength} onChange={e => setFormData({...formData, chargeMinLength: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo Máximo (m)</label>
                          <input type="number" className="input-field" value={formData.chargeMaxLength} onChange={e => setFormData({...formData, chargeMaxLength: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tiempo/metro (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.chargeTimePerMeter} onChange={e => setFormData({...formData, chargeTimePerMeter: Number(e.target.value)})} />
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, textAlign: "left", margin: 0 }}>
                        <input type="checkbox" checked={formData.flagRolling} onChange={e => setFormData({...formData, flagRolling: e.target.checked})} style={{ margin: 0, marginTop: 3, flex: "0 0 auto", width: "auto" }} />
                        <span>Se expande en oleadas (ej. Ulti Breach/Fade)</span>
                      </label>
                    </div>

                    {formData.flagRolling && (
                      <div className="form-row" style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: 24 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cantidad de Oleadas</label>
                          <input type="number" className="input-field" value={formData.rollWaveCount} onChange={e => setFormData({...formData, rollWaveCount: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tiempo entre oleadas (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.rollTimeBetweenWaves} onChange={e => setFormData({...formData, rollTimeBetweenWaves: Number(e.target.value)})} />
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 48, fontWeight: 800 }} disabled={saveSkillMutation.isPending}>
                    {saveSkillMutation.isPending ? "Guardando..." : "Guardar Habilidad"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-wrapper { max-width: 1400px; margin: 0 auto; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
        .agent-card {
          padding: 24px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.3s;
        }
        .agent-card:hover {
          transform: translateY(-5px);
          border-color: var(--val-cyan);
          background: rgba(0, 212, 170, 0.05);
        }
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.9); backdrop-filter: blur(10px);
          display: flex; alignItems: center; justifyContent: center; z-index: 1000;
        }
        .premium-modal {
          padding: 40px; border-radius: 32px; box-shadow: 0 40px 100px rgba(0,0,0,0.8);
        }
        .icon-action-btn {
          width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); color: white; cursor: pointer;
        }
        .icon-action-btn:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
