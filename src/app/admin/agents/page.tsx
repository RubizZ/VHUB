"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AgentSkill, ValorantAgent, SkillGeometry, SkillBehavior } from "@/lib/agents";
import { type ValorantWeapon } from "@/lib/weapons";

interface SkillFormData {
  name: string;
  description: string;
  color: string;
  charges: number;
  castTime: number;
  geometryType: "circle" | "rectangle" | "cone" | "infinite-wall";
  geometryRadius: number;
  geometryWidth: number;
  geometryLength: number;
  geometryAngle: number;
  behaviorCharges: number;
  behaviorCastTime: number;
  behaviorRechargeTime: number;
  behaviorBuffDuration: number;
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
  rechargeTime: number;
  consumesSkillKey: string;
  flagRecallable: boolean;
  flagGrantsWeapon: boolean;
  flagTeleportsToDeployed: boolean;
  flagInstantSelfBuff: boolean;
  flagSelfRevive: boolean;
  flagTargetRevive: boolean;
  flagActivatableDeployable: boolean;
  flagTwoPointDeployment: boolean;
  flagDeployablePreRound: boolean;
  flagControllablePath: boolean;
  flagTriggerOnSight: boolean;
  flagStoppableInFlight: boolean;
  behaviorSpeed: number;
  behaviorDuration: number;
  displayIcon: string;
  enabled: boolean;
}

export default function AdminAgentsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  const [editingSkillKey, setEditingSkillKey] = useState<string>("q");
  const [activeTab, setActiveTab] = useState<"general" | "geometry" | "mechanics" | "times">("general");
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
    behaviorCharges: 1,
    behaviorCastTime: 0,
    behaviorRechargeTime: 0,
    behaviorBuffDuration: 0,
    behaviorSpeed: 0,
    behaviorDuration: 0,
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
    rechargeTime: 0,
    consumesSkillKey: "",
    flagRecallable: false,
    flagGrantsWeapon: false,
    flagTeleportsToDeployed: false,
    flagInstantSelfBuff: false,
    flagSelfRevive: false,
    flagTargetRevive: false,
    flagActivatableDeployable: false,
    flagTwoPointDeployment: false,
    flagDeployablePreRound: false,
    flagControllablePath: false,
    flagTriggerOnSight: false,
    flagStoppableInFlight: false,
    displayIcon: "",
    enabled: true,
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

  const { data: weaponsData } = useQuery<{ weapons: ValorantWeapon[] }>({
    queryKey: ["weapons"],
    queryFn: async () => {
      const res = await fetch("/api/weapons");
      if (!res.ok) throw new Error("Error loading weapons");
      return res.json();
    },
    staleTime: 3600 * 1000,
  });

  const agents = agentsData?.agents || [];
  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const handleOpenAgent = (agent: ValorantAgent) => {
    setSelectedAgent(agent);
    loadSkillForm(agent, "q");
  };

  const loadSkillForm = (agent: ValorantAgent, key: string) => {
    setEditingSkillKey(key);
    const skill = agent.skills?.find(s => s.key === key);
    if (skill) {
      setFormData({
        name: skill.name,
        description: skill.description || "",
        color: skill.color || "",
        charges: skill.behavior?.charges || 1,
        castTime: skill.behavior?.castTime || 0,
        geometryType: (skill.geometry?.type as SkillFormData["geometryType"]) || "circle",
        geometryRadius: skill.geometry?.radius || 5,
        geometryWidth: skill.geometry?.width || 5,
        geometryLength: skill.geometry?.length || 5,
        geometryAngle: skill.geometry?.angle || 90,
        behaviorCharges: skill.behavior?.charges || 1,
        behaviorCastTime: skill.behavior?.castTime || 0,
        behaviorRechargeTime: skill.behavior?.rechargeTime || 0,
        behaviorBuffDuration: skill.behavior?.buffDuration || 0,
        behaviorSpeed: skill.behavior?.speed || 0,
        behaviorDuration: skill.behavior?.duration || 0,
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
        rechargeTime: skill.behavior?.rechargeTime || 0,
        consumesSkillKey: skill.behavior?.consumesSkillKey || "",
        flagRecallable: skill.behavior?.flags?.recallable || false,
        flagGrantsWeapon: skill.behavior?.flags?.grantsWeapon || false,
        flagTeleportsToDeployed: skill.behavior?.flags?.teleportsToDeployed || false,
        flagInstantSelfBuff: skill.behavior?.flags?.instantSelfBuff || false,
        flagSelfRevive: skill.behavior?.flags?.selfRevive || false,
        flagTargetRevive: skill.behavior?.flags?.targetRevive || false,
        flagActivatableDeployable: skill.behavior?.flags?.activatableDeployable || false,
        flagTwoPointDeployment: skill.behavior?.flags?.twoPointDeployment || false,
        flagDeployablePreRound: skill.behavior?.flags?.deployablePreRound || false,
        flagControllablePath: skill.behavior?.flags?.controllablePath || false,
        flagTriggerOnSight: skill.behavior?.flags?.triggerOnSight || false,
        flagStoppableInFlight: skill.behavior?.flags?.stoppableInFlight || false,
        displayIcon: skill.displayIcon || "",
        enabled: skill.enabled ?? false,
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
        behaviorCharges: 1,
        behaviorCastTime: 0,
        behaviorRechargeTime: 0,
        behaviorBuffDuration: 0,
        behaviorSpeed: 0,
        behaviorDuration: 0,
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
        rechargeTime: 0,
        consumesSkillKey: "",
        flagRecallable: false,
        flagGrantsWeapon: false,
        flagTeleportsToDeployed: false,
        flagInstantSelfBuff: false,
        flagSelfRevive: false,
        flagTargetRevive: false,
        flagActivatableDeployable: false,
        flagTwoPointDeployment: false,
        flagDeployablePreRound: false,
        flagControllablePath: false,
        flagTriggerOnSight: false,
        flagStoppableInFlight: false,
        displayIcon: "",
        enabled: true,
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
          charges: formData.behaviorCharges,
          castTime: formData.behaviorCastTime,
          rechargeTime: formData.behaviorRechargeTime,
          buffDuration: formData.behaviorBuffDuration || undefined,
          speed: formData.behaviorSpeed,
          duration: formData.behaviorDuration,
          spawn: formData.behaviorSpawn as "player" | "ground" | "wall" | "projectile",
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
            rolling: formData.flagRolling || undefined,
            recallable: formData.flagRecallable || undefined,
            grantsWeapon: formData.flagGrantsWeapon || undefined,
            teleportsToDeployed: formData.flagTeleportsToDeployed || undefined,
            instantSelfBuff: formData.flagInstantSelfBuff || undefined,
            selfRevive: formData.flagSelfRevive || undefined,
            targetRevive: formData.flagTargetRevive || undefined,
            activatableDeployable: formData.flagActivatableDeployable || undefined,
            twoPointDeployment: formData.flagTwoPointDeployment || undefined,
            deployablePreRound: formData.flagDeployablePreRound || undefined,
            controllablePath: formData.flagControllablePath || undefined,
            triggerOnSight: formData.flagTriggerOnSight || undefined,
            stoppableInFlight: formData.flagStoppableInFlight || undefined,
          }
        },
        displayIcon: formData.displayIcon || undefined,
        enabled: formData.enabled
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

  const handleFetchIcon = async () => {
    if (!selectedAgent || !editingSkillKey) return;
    try {
      const res = await fetch(`https://valorant-api.com/v1/agents/${selectedAgent.id}?language=es-ES`);
      const data = await res.json();
      const abilities = data.data.abilities;
      if (!abilities) return;
      
      const keyMap: Record<string, string> = {
        "q": "Ability1",
        "e": "Ability2",
        "c": "Grenade",
        "x": "Ultimate",
        "passive": "Passive"
      };
      
      const baseKey = editingSkillKey.replace("_alt", "").toLowerCase();
      const slot = keyMap[baseKey];
      if (slot) {
        const ability = abilities.find((a: any) => a.slot === slot);
        if (ability?.displayIcon) {
          setFormData(prev => ({ ...prev, displayIcon: ability.displayIcon }));
        }
      }
    } catch (e) {
      console.error(e);
    }
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
              <div className="agent-skills-preview" style={{ display: "flex", gap: 8 }}>
                 {["q", "e", "c", "x", "passive"].map(key => {
                   const hasSkill = agent.skills?.some(s => s.key === key && s.enabled);
                   const hasAlt = agent.skills?.some(s => s.key === `${key}_alt` && s.enabled);
                   return (
                     <div key={key} style={{ 
                       flex: 1, textAlign: "center", padding: "4px", borderRadius: 4, 
                       background: hasSkill ? "rgba(0, 212, 170, 0.2)" : "rgba(255, 70, 85, 0.2)",
                       color: hasSkill ? "var(--val-cyan)" : "var(--val-red)",
                       fontSize: 10, fontWeight: 800, textTransform: "uppercase"
                     }}>
                       {key}{hasAlt ? "*" : ""}
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
              <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 12 }}>
                {["q", "e", "c", "x", "passive"].map(key => (
                  <React.Fragment key={key}>
                    <button 
                      className={`btn ${editingSkillKey === key ? "btn-primary" : "btn-secondary"}`}
                      style={{ textTransform: "uppercase", fontWeight: 900, height: 48, flex: "0 0 auto", padding: "0 24px" }}
                      onClick={() => loadSkillForm(selectedAgent, key)}
                    >
                      {key}
                    </button>
                    {selectedAgent.skills?.some(s => s.key === `${key}_alt`) ? (
                      <button 
                        className={`btn ${editingSkillKey === `${key}_alt` ? "btn-primary" : "btn-secondary"}`}
                        style={{ textTransform: "uppercase", fontWeight: 800, height: 36, marginLeft: 16, marginTop: -8, fontSize: 12 }}
                        onClick={() => loadSkillForm(selectedAgent, `${key}_alt`)}
                      >
                        ↳ {key} (Alt)
                      </button>
                    ) : (
                      <button 
                        className="btn btn-secondary"
                        style={{ textTransform: "uppercase", fontWeight: 800, height: 32, marginLeft: 16, marginTop: -8, fontSize: 10, opacity: 0.5, border: "1px dashed rgba(255,255,255,0.2)" }}
                        onClick={() => loadSkillForm(selectedAgent, `${key}_alt`)}
                      >
                        + Añadir Alt
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div style={{ flex: 1 }}>
                <form onSubmit={handleSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: 24, borderRadius: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h3 style={{ margin: 0, textTransform: "uppercase", color: "var(--val-yellow)" }}>Configurando {editingSkillKey}</h3>
                    <label className="checkbox-label" style={{ padding: "8px 16px", background: formData.enabled ? "rgba(0, 212, 170, 0.1)" : "rgba(255, 70, 85, 0.1)", borderRadius: 8, border: `1px solid ${formData.enabled ? "rgba(0, 212, 170, 0.3)" : "rgba(255, 70, 85, 0.3)"}` }}>
                      <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                      <span className="checkbox-custom"></span>
                      <span style={{ fontWeight: 800, color: formData.enabled ? "var(--val-cyan)" : "var(--val-red)" }}>{formData.enabled ? "HABILITADA" : "DESHABILITADA"}</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                    {(["general", "geometry", "mechanics", "times"] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                          background: activeTab === tab ? "var(--val-cyan)" : "rgba(255,255,255,0.05)",
                          color: activeTab === tab ? "#000" : "var(--text-secondary)",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 12,
                          textTransform: "uppercase",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {tab === "general" ? "General" : tab === "geometry" ? "Forma & Geo" : tab === "mechanics" ? "Mecánicas" : "Tiempos & Stats"}
                      </button>
                    ))}
                  </div>

                  {activeTab === "general" && (
                    <div className="tab-content fade-in">
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nombre Habilidad</label>
                        <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Key ID</label>
                        <input className="input-field" value={editingSkillKey} disabled style={{ opacity: 0.5 }} />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Icono de la habilidad (URL valorant-api)</label>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <input className="input-field" value={formData.displayIcon} onChange={e => setFormData({...formData, displayIcon: e.target.value})} placeholder="https://..." style={{ flex: 1 }} />
                          <button type="button" className="btn btn-secondary" onClick={handleFetchIcon} style={{ flexShrink: 0, height: 48 }}>Extraer de Valorant API</button>
                          {formData.displayIcon && (
                            <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(10, 14, 20, 0.9)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
                              <img src={formData.displayIcon} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Color Base (Hex) - opcional</label>
                        <input className="input-field" placeholder="#FF4655" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {activeTab === "geometry" && (
                    <div className="tab-content fade-in">
                      <div className="form-group" style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Comportamiento de Spawn base</label>
                        <select className="input-field" value={formData.behaviorSpawn} onChange={e => setFormData({...formData, behaviorSpawn: e.target.value as SkillFormData["behaviorSpawn"]})}>
                          <option value="player">Sale de la posición del jugador</option>
                          <option value="ground">Se coloca en el suelo libremente (ej. Humos)</option>
                        </select>
                      </div>

                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 12 }}>
                        <div className="form-group" style={{ flex: "1 1 100%" }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Forma Geométrica Visual</label>
                          <select className="input-field" value={formData.geometryType} onChange={e => setFormData({...formData, geometryType: e.target.value as SkillFormData["geometryType"]})}>
                            <option value="circle">Círculo / Área</option>
                            <option value="rectangle">Rectángulo / Línea</option>
                            <option value="cone">Cono</option>
                            <option value="infinite-wall">Muro Infinito</option>
                            <option value="path">Ruta / Camino</option>
                          </select>
                        </div>
                        {formData.geometryType === "circle" && (
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Radio (m)</label>
                            <input type="number" className="input-field" value={formData.geometryRadius} onChange={e => setFormData({...formData, geometryRadius: Number(e.target.value)})} />
                          </div>
                        )}
                        {(formData.geometryType === "rectangle" || formData.geometryType === "cone") && (
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
                    </div>
                  )}

                  {activeTab === "mechanics" && (
                    <div className="tab-content fade-in">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagDeployablePreRound} onChange={e => setFormData({...formData, flagDeployablePreRound: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Pre-ronda (Timeline mode)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagActivatableDeployable} onChange={e => setFormData({...formData, flagActivatableDeployable: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Activable (Cárcel Cypher)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagTwoPointDeployment} onChange={e => setFormData({...formData, flagTwoPointDeployment: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Dos Puntos (Cables Cypher)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagControllablePath} onChange={e => setFormData({...formData, flagControllablePath: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Ruta Controlable (Perro Fade)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagTeleportsToDeployed} onChange={e => setFormData({...formData, flagTeleportsToDeployed: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Permite TP (Chamber E)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagInstantSelfBuff} onChange={e => setFormData({...formData, flagInstantSelfBuff: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Auto-Buff Instantáneo</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagSelfRevive} onChange={e => setFormData({...formData, flagSelfRevive: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Auto-Revivir (Clove X)</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="checkbox" checked={formData.flagTargetRevive} onChange={e => setFormData({...formData, flagTargetRevive: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span>Revivir Objetivo (Sage X)</span>
                        </label>
                      </div>

                      <h4 style={{ color: "var(--val-cyan)", textTransform: "uppercase", fontSize: 14, fontWeight: 900, marginBottom: 12 }}>Comportamientos Avanzados</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 12 }}>
                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagThroughWall} onChange={e => setFormData({...formData, flagThroughWall: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Atraviesa paredes (se tira contra un muro y sale por el otro)</span>
                        </label>
                        
                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagRecallable} onChange={e => setFormData({...formData, flagRecallable: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Se puede recoger manualmente (CD empieza al recoger)</span>
                        </label>

                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagGrantsWeapon} onChange={e => setFormData({...formData, flagGrantsWeapon: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Actúa como arma equipable (ej. Q/X de Chamber)</span>
                        </label>
                        
                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagTriggerOnSight} onChange={e => setFormData({...formData, flagTriggerOnSight: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Se detona/activa automáticamente al ver enemigo (Ej: Wingman de Gekko, Prowler de Fade)</span>
                        </label>
                        
                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagStoppableInFlight} onChange={e => setFormData({...formData, flagStoppableInFlight: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Se puede detener manualmente mientras avanza (Ej: Cascade de Harbor)</span>
                        </label>

                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "8px 0" }}></div>

                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagProjectile} onChange={e => setFormData({...formData, flagProjectile: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Es un proyectil (físicas de rebote o parábola)</span>
                        </label>
                        {formData.flagProjectile && (
                          <div className="form-group" style={{ marginTop: 8, paddingLeft: 24 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rebotes Máx. (0 = infinito)</label>
                            <input type="number" min="0" className="input-field" value={formData.projectileBounces} onChange={e => setFormData({...formData, projectileBounces: Number(e.target.value)})} style={{ width: 120 }} />
                          </div>
                        )}

                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagChargeable} onChange={e => setFormData({...formData, flagChargeable: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Se puede cargar (ej. Stun de Breach)</span>
                        </label>
                        {formData.flagChargeable && (
                          <div className="form-row" style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: 24 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo Mín (m)</label>
                              <input type="number" className="input-field" value={formData.chargeMinLength} onChange={e => setFormData({...formData, chargeMinLength: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo Máx (m)</label>
                              <input type="number" className="input-field" value={formData.chargeMaxLength} onChange={e => setFormData({...formData, chargeMaxLength: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tiempo/m (s)</label>
                              <input type="number" step="0.1" className="input-field" value={formData.chargeTimePerMeter} onChange={e => setFormData({...formData, chargeTimePerMeter: Number(e.target.value)})} />
                            </div>
                          </div>
                        )}

                        <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, margin: 0 }}>
                          <input type="checkbox" checked={formData.flagRolling} onChange={e => setFormData({...formData, flagRolling: e.target.checked})} style={{ margin: 0, marginTop: 3 }} />
                          <span>Se expande en oleadas (ej. Ulti Breach)</span>
                        </label>
                        {formData.flagRolling && (
                          <div className="form-row" style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: 24 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Oleadas</label>
                              <input type="number" className="input-field" value={formData.rollWaveCount} onChange={e => setFormData({...formData, rollWaveCount: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Segundos/oleada</label>
                              <input type="number" step="0.1" className="input-field" value={formData.rollTimeBetweenWaves} onChange={e => setFormData({...formData, rollTimeBetweenWaves: Number(e.target.value)})} />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Requiere consumir (Key de otra habilidad, ej. x_alt)</label>
                        <input className="input-field" placeholder="Vacío = no depende de otra habilidad" value={formData.consumesSkillKey} onChange={e => setFormData({...formData, consumesSkillKey: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {activeTab === "times" && (
                    <div className="tab-content fade-in">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cargas Totales</label>
                          <input type="number" min="1" max="10" className="input-field" value={formData.behaviorCharges} onChange={e => setFormData({...formData, behaviorCharges: Number(e.target.value)})} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rango Máx. Casteo (m, 0=inf)</label>
                          <input type="number" className="input-field" value={formData.behaviorGroundRange} onChange={e => setFormData({...formData, behaviorGroundRange: Number(e.target.value)})} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tiempo Casteo (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.behaviorCastTime} onChange={e => setFormData({...formData, behaviorCastTime: parseFloat(e.target.value)})} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tiempo de Recarga (s, 0=nunca)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.behaviorRechargeTime} onChange={e => setFormData({...formData, behaviorRechargeTime: parseFloat(e.target.value)})} />
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "24px 0" }}></div>

                      {(formData.flagInstantSelfBuff || formData.flagActivatableDeployable) && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--val-cyan)" }}>Duración del Efecto/Buff (s)</label>
                          <input type="number" step="0.1" className="input-field" style={{ border: "1px solid rgba(0, 212, 170, 0.3)" }} value={formData.behaviorBuffDuration} onChange={e => setFormData({...formData, behaviorBuffDuration: parseFloat(e.target.value)})} />
                        </div>
                      )}

                      {formData.flagControllablePath && (
                        <div className="form-row" style={{ display: "flex", gap: 16 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--val-cyan)" }}>Velocidad (m/s)</label>
                            <input type="number" step="0.1" className="input-field" style={{ border: "1px solid rgba(0, 212, 170, 0.3)" }} value={formData.behaviorSpeed} onChange={e => setFormData({...formData, behaviorSpeed: parseFloat(e.target.value)})} />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--val-cyan)" }}>Duración Máx (s)</label>
                            <input type="number" step="0.1" className="input-field" style={{ border: "1px solid rgba(0, 212, 170, 0.3)" }} value={formData.behaviorDuration} onChange={e => setFormData({...formData, behaviorDuration: parseFloat(e.target.value)})} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: 16, fontSize: 16, fontWeight: 900, textTransform: "uppercase", marginTop: 16 }} disabled={saveSkillMutation.isPending}>
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
        .tab-content {
          animation: fade-in 0.2s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .icon-action-btn {
          width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); color: white; cursor: pointer;
        }
        .icon-action-btn:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
