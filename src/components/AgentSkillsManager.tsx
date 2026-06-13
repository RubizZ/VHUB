"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AgentSkill, ValorantAgent, DeploymentType, MechanicsData, EffectsData, DamageData, HealData, VisionData } from "@/lib/domain/agents";

interface SkillFormData {
  name: string;
  description: string;
  color: string;
  type: "Basic" | "Signature" | "Ultimate" | "Passive";
  displayIcon: string;
  enabled: boolean;

  // Economy
  costCredits: number;
  costUltPoints: number;
  costNote: string;
  usesPerRound: number;
  rechargeCondition: string;

  // Mechanics Base
  deploymentType: DeploymentType;
  windup: number;
  duration: number;
  castRange: number;
  traversesWalls: boolean;

  // Mechanics Specifics
  geometryType: "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross";
  projectileSpeed: number;
  projectileMaxDistance: number;
  bounces: number;
  steerable: boolean;
  aoeRadius: number;
  aoeWidth: number;
  aoeLength: number;
  mapRadiusUnits: number;
  directionalOnly: boolean;
  pulses: number;
  maxAmmo: number;
  activationRadius: number;
  visionConeAngle: number;
  movementSpeed: number;

  // Effects Toggles
  hasDamage: boolean;
  hasHeal: boolean;
  hasVision: boolean;
  hasDestructible: boolean;

  // Damage
  damageType: "burst" | "dot" | "weapon" | "instant" | "decay";
  baseDamage: number;
  damagePerSecond: number;
  damagePerPulse: number;
  damagePulses: number;
  ticksPerSecond: number;
  damageMin: number;
  damageMax: number;
  headshotDamage: number;
  bodyDamage: number;
  legDamage: number;
  oneShotBody: boolean;

  // Heal
  healAmount: number;
  healDuration: number;
  selfHealAmount: number;
  selfHealDuration: number;
  requiresSoulOrb: boolean;

  // Vision
  blocksVision: boolean;
  nearsight: boolean;
  flash: boolean;
  flashDuration: number;
  reveal: boolean;
  revealPulses: number;

  // Destructible
  hp: number;

  // General Effects
  cc: string; // comma separated
  buffs: string; // comma separated
  notes: string;
  isolatesTarget: boolean;
  revives: boolean;
  recollectable: boolean;
  fuelBased: boolean;
  audioCueRadius: number;
}

const getDefaultFormData = (): SkillFormData => ({
  name: "",
  description: "",
  color: "",
  type: "Basic",
  displayIcon: "",
  enabled: true,

  costCredits: 0,
  costUltPoints: 0,
  costNote: "",
  usesPerRound: 1,
  rechargeCondition: "",

  deploymentType: "self_instant",
  windup: 0,
  duration: 0,
  castRange: 0,
  traversesWalls: false,

  geometryType: "none",
  projectileSpeed: 0,
  projectileMaxDistance: 0,
  bounces: 0,
  steerable: false,
  aoeRadius: 0,
  aoeWidth: 0,
  aoeLength: 0,
  mapRadiusUnits: 0,
  directionalOnly: false,
  pulses: 0,
  maxAmmo: 0,
  activationRadius: 0,
  visionConeAngle: 0,
  movementSpeed: 0,

  hasDamage: false,
  hasHeal: false,
  hasVision: false,
  hasDestructible: false,

  damageType: "burst",
  baseDamage: 0,
  damagePerSecond: 0,
  damagePerPulse: 0,
  damagePulses: 0,
  ticksPerSecond: 0,
  damageMin: 0,
  damageMax: 0,
  headshotDamage: 0,
  bodyDamage: 0,
  legDamage: 0,
  oneShotBody: false,

  healAmount: 0,
  healDuration: 0,
  selfHealAmount: 0,
  selfHealDuration: 0,
  requiresSoulOrb: false,

  blocksVision: false,
  nearsight: false,
  flash: false,
  flashDuration: 0,
  reveal: false,
  revealPulses: 0,

  hp: 0,

  cc: "",
  buffs: "",
  notes: "",
  isolatesTarget: false,
  revives: false,
  recollectable: false,
  fuelBased: false,
  audioCueRadius: 0
});

export function AgentSkillsManager({ defaultAgentId, defaultSkillKey, isModalMode, onClose }: { defaultAgentId?: string, defaultSkillKey?: string, isModalMode?: boolean, onClose?: () => void }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  const [editingSkillKey, setEditingSkillKey] = useState<string>("q");
  const [activeTab, setActiveTab] = useState<"general" | "mechanics" | "effects">("general");
  const [formData, setFormData] = useState<SkillFormData>(getDefaultFormData());

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
    const skill = agent.skills?.find(s => s.key === key);
    if (skill) {
      const data = getDefaultFormData();
      data.name = skill.name;
      data.description = skill.description || "";
      data.color = skill.color || "";
      data.type = skill.type || "Basic";
      data.displayIcon = skill.displayIcon || "";
      data.enabled = skill.enabled ?? true;

      // Economy
      if (skill.economy) {
        data.costCredits = skill.economy.costCredits || 0;
        data.costUltPoints = skill.economy.costUltPoints || 0;
        data.costNote = skill.economy.costNote || "";
        data.usesPerRound = skill.economy.usesPerRound || 1;
        data.rechargeCondition = skill.economy.rechargeCondition || "";
      }

      // Mechanics
      if (skill.mechanics) {
        data.deploymentType = skill.mechanics.deploymentType;
        data.windup = skill.mechanics.windup || 0;
        data.duration = skill.mechanics.duration || 0;
        data.castRange = "castRange" in skill.mechanics ? (skill.mechanics.castRange || 0) : 0;
        data.traversesWalls = "traversesWalls" in skill.mechanics ? (skill.mechanics.traversesWalls || false) : false;

        const m = skill.mechanics;
        data.geometryType = m.geometry?.type || "none";
        data.projectileSpeed = "projectileSpeed" in m ? (m.projectileSpeed || 0) : 0;
        data.projectileMaxDistance = "projectileMaxDistance" in m ? (m.projectileMaxDistance || 0) : 0;
        data.bounces = "bounces" in m ? (m.bounces || 0) : 0;
        data.steerable = "steerable" in m ? (m.steerable || false) : false;
        data.aoeRadius = m.geometry && "radius" in m.geometry ? (m.geometry.radius || 0) : 0;
        data.aoeWidth = m.geometry && "width" in m.geometry ? (m.geometry.width || 0) : 0;
        data.aoeLength = m.geometry && "length" in m.geometry ? (m.geometry.length || 0) : 0;
        data.mapRadiusUnits = "mapRadiusUnits" in m ? (m.mapRadiusUnits || 0) : 0;
        data.directionalOnly = "directionalOnly" in m ? (m.directionalOnly || false) : false;
        data.pulses = "pulses" in m ? (m.pulses || 0) : 0;
        data.maxAmmo = "maxAmmo" in m ? (m.maxAmmo || 0) : 0;
        data.activationRadius = "activationRadius" in m ? (m.activationRadius || 0) : 0;
        data.visionConeAngle = m.geometry && "angle" in m.geometry ? (m.geometry.angle || 0) : 0;
        data.movementSpeed = "movementSpeed" in m ? (m.movementSpeed || 0) : 0;
      }

      // Effects
      if (skill.effects) {
        const e = skill.effects;
        data.hasDamage = !!e.damage;
        if (e.damage) {
          data.damageType = e.damage.type || "burst";
          data.baseDamage = e.damage.baseDamage || 0;
          data.damagePerSecond = e.damage.damagePerSecond || 0;
          data.damagePerPulse = e.damage.damagePerPulse || 0;
          data.damagePulses = e.damage.pulses || 0;
          data.ticksPerSecond = e.damage.ticksPerSecond || 0;
          data.damageMin = e.damage.damageMin || 0;
          data.damageMax = e.damage.damageMax || 0;
          data.headshotDamage = e.damage.headshotDamage || 0;
          data.bodyDamage = e.damage.bodyDamage || 0;
          data.legDamage = e.damage.legDamage || 0;
          data.oneShotBody = e.damage.oneShotBody || false;
        }

        data.hasHeal = !!e.heal;
        if (e.heal) {
          data.healAmount = e.heal.amount || 0;
          data.healDuration = e.heal.duration || 0;
          data.selfHealAmount = e.heal.selfAmount || 0;
          data.selfHealDuration = e.heal.selfDuration || 0;
          data.requiresSoulOrb = e.heal.requiresSoulOrb || false;
        }

        data.hasVision = !!e.vision;
        if (e.vision) {
          data.blocksVision = e.vision.blocksVision || false;
          data.nearsight = e.vision.nearsight || false;
          data.flash = e.vision.flash || false;
          data.flashDuration = e.vision.flashDuration || 0;
          data.reveal = e.vision.reveal || false;
          data.revealPulses = e.vision.revealPulses || 0;
        }

        data.hasDestructible = !!e.destructible;
        if (e.destructible) {
          data.hp = e.destructible.hp || 0;
        }

        data.cc = e.cc?.join(", ") || "";
        data.buffs = e.buffs?.join(", ") || "";
        data.notes = e.notes || "";
        data.isolatesTarget = e.isolatesTarget || false;
        data.revives = e.revives || false;
        data.recollectable = e.recollectable || false;
        data.fuelBased = e.fuelBased || false;
        data.audioCueRadius = e.audioCueRadius || 0;
      }

      setFormData(data);
    } else {
      setFormData(getDefaultFormData());
    }
  };

  React.useEffect(() => {
    if (defaultAgentId && defaultSkillKey && agents.length > 0 && !selectedAgent) {
      const agent = agents.find(a => a.id === defaultAgentId);
      if (agent) {
        setSelectedAgent(agent);
        loadSkillForm(agent, defaultSkillKey);
      }
    }
  }, [agents, selectedAgent, defaultAgentId, defaultSkillKey]);

  const saveSkillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) return;
      
      const payload: Omit<AgentSkill, "id"> = {
        agentId: selectedAgent.id,
        key: editingSkillKey,
        name: formData.name,
        description: formData.description,
        color: formData.color,
        type: formData.type,
        displayIcon: formData.displayIcon || undefined,
        enabled: formData.enabled,
        economy: {
          costCredits: Number(formData.costCredits) || undefined,
          costUltPoints: Number(formData.costUltPoints) || undefined,
          costNote: formData.costNote || undefined,
          usesPerRound: Number(formData.usesPerRound) || undefined,
          rechargeCondition: formData.rechargeCondition || undefined,
        },
        mechanics: (() => {
          const base = {
            windup: Number(formData.windup) || undefined,
            duration: Number(formData.duration) || undefined,
          };
          const castRange = Number(formData.castRange) || undefined;
          const traversesWalls = formData.traversesWalls || undefined;
          
          const geometry = (() => {
             if (formData.deploymentType === "self_instant" || formData.deploymentType === "equip_weapon") return undefined;
             if (formData.geometryType === "none") return undefined;
             const gType = formData.geometryType;
             if (gType === "circle") return { type: "circle" as const, radius: Number(formData.aoeRadius) || undefined };
             if (gType === "cone") return { type: "cone" as const, radius: Number(formData.aoeRadius) || undefined, angle: Number(formData.visionConeAngle) || undefined };
             if (gType === "sector") return { type: "sector" as const, radius: Number(formData.aoeRadius) || undefined, angle: Number(formData.visionConeAngle) || undefined };
             if (gType === "rectangle") return { type: "rectangle" as const, length: Number(formData.aoeLength) || undefined, width: Number(formData.aoeWidth) || undefined };
             if (gType === "line") return { type: "line" as const, length: Number(formData.aoeLength) || undefined, width: Number(formData.aoeWidth) || undefined };
             if (gType === "curve") return { type: "curve" as const, length: Number(formData.aoeLength) || undefined, width: Number(formData.aoeWidth) || undefined };
             return undefined;
          })();

          switch (formData.deploymentType) {
            case "self_instant": return { ...base, deploymentType: "self_instant" as const };
            case "equip_weapon": return { ...base, deploymentType: "equip_weapon" as const, maxAmmo: Number(formData.maxAmmo) || undefined };
            case "self_mobile_aura": return { ...base, deploymentType: "self_mobile_aura" as const, geometry, pulses: Number(formData.pulses) || undefined, traversesWalls };
            case "projectile_terminal_aoe": return { ...base, deploymentType: "projectile_terminal_aoe" as const, geometry, projectileSpeed: Number(formData.projectileSpeed) || undefined, projectileMaxDistance: Number(formData.projectileMaxDistance) || undefined, bounces: Number(formData.bounces) || undefined, steerable: formData.steerable || undefined, traversesWalls };
            case "projectile_sweeping": return { ...base, deploymentType: "projectile_sweeping" as const, geometry, projectileSpeed: Number(formData.projectileSpeed) || undefined, projectileMaxDistance: Number(formData.projectileMaxDistance) || undefined, traversesWalls };
            case "map_target_aoe": return { ...base, deploymentType: "map_target_aoe" as const, geometry, mapRadiusUnits: Number(formData.mapRadiusUnits) || undefined, castRange };
            case "static_deployable": return { ...base, deploymentType: "static_deployable" as const, geometry, castRange };
            case "linear_wall": return { ...base, deploymentType: "linear_wall" as const, geometry, steerable: formData.steerable || undefined, castRange, traversesWalls };
            case "two_point_barrier": return { ...base, deploymentType: "two_point_barrier" as const, geometry, directionalOnly: formData.directionalOnly || undefined, castRange };
            case "autonomous_entity": return { ...base, deploymentType: "autonomous_entity" as const, geometry, activationRadius: Number(formData.activationRadius) || undefined, movementSpeed: Number(formData.movementSpeed) || undefined };
          }
        })(),
        effects: {
          damage: formData.hasDamage ? {
            type: formData.damageType,
            baseDamage: Number(formData.baseDamage) || undefined,
            damagePerSecond: Number(formData.damagePerSecond) || undefined,
            damagePerPulse: Number(formData.damagePerPulse) || undefined,
            pulses: Number(formData.damagePulses) || undefined,
            ticksPerSecond: Number(formData.ticksPerSecond) || undefined,
            damageMin: Number(formData.damageMin) || undefined,
            damageMax: Number(formData.damageMax) || undefined,
            headshotDamage: Number(formData.headshotDamage) || undefined,
            bodyDamage: Number(formData.bodyDamage) || undefined,
            legDamage: Number(formData.legDamage) || undefined,
            oneShotBody: formData.oneShotBody || undefined,
          } : undefined,
          heal: formData.hasHeal ? {
            amount: Number(formData.healAmount) || undefined,
            duration: Number(formData.healDuration) || undefined,
            selfAmount: Number(formData.selfHealAmount) || undefined,
            selfDuration: Number(formData.selfHealDuration) || undefined,
            requiresSoulOrb: formData.requiresSoulOrb || undefined,
          } : undefined,
          vision: formData.hasVision ? {
            blocksVision: formData.blocksVision || undefined,
            nearsight: formData.nearsight || undefined,
            flash: formData.flash || undefined,
            flashDuration: Number(formData.flashDuration) || undefined,
            reveal: formData.reveal || undefined,
            revealPulses: Number(formData.revealPulses) || undefined,
          } : undefined,
          destructible: formData.hasDestructible ? {
            hp: Number(formData.hp) || 0
          } : undefined,
          cc: formData.cc ? formData.cc.split(",").map(s => s.trim()).filter(Boolean) : undefined,
          buffs: formData.buffs ? formData.buffs.split(",").map(s => s.trim()).filter(Boolean) : undefined,
          notes: formData.notes || undefined,
          isolatesTarget: formData.isolatesTarget || undefined,
          revives: formData.revives || undefined,
          recollectable: formData.recollectable || undefined,
          fuelBased: formData.fuelBased || undefined,
          audioCueRadius: Number(formData.audioCueRadius) || undefined,
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
      queryClient.invalidateQueries({ queryKey: ["agents"] });
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
        const ability = abilities.find((a: { slot: string; displayIcon: string }) => a.slot === slot);
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
    <div className="admin-wrapper" style={isModalMode ? { padding: 0, background: "transparent", minHeight: "auto" } : {}}>
      {!isModalMode && (
        <>
          <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
            <div>
              <span className="badge" style={{ background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", marginBottom: 8 }}>PLATFORM MANAGEMENT</span>
              <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Agentes y Habilidades</h1>
              <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Configuración remodelada basada en Mecánicas y Efectos</p>
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
                     {["c", "q", "e", "x", "passive"].map(key => {
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
        </>
      )}

      {selectedAgent && (
        <div className={isModalMode ? "" : "modal-overlay"} style={isModalMode ? { padding: 20 } : {}}>
          <div className={isModalMode ? "" : "modal-content card glass-card premium-modal"} style={isModalMode ? { maxWidth: 700, width: "100%", margin: "0 auto", padding: 0, background: "transparent", border: "none", boxShadow: "none" } : { maxWidth: 850, width: "95%" }}>
            {!isModalMode && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                 <div>
                   <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Habilidades de {selectedAgent.name}</h2>
                   <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Editor de Árbol de Mecánicas</p>
                 </div>
                 <button className="icon-action-btn" onClick={() => {
                   setSelectedAgent(null);
                   if (onClose) onClose();
                 }}>✕</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 12 }}>
                {["c", "q", "e", "x", "passive"].map(key => (
                  <React.Fragment key={key}>
                    <button 
                      type="button"
                      className={`btn ${editingSkillKey === key ? "btn-primary" : "btn-secondary"}`}
                      style={{ textTransform: "uppercase", fontWeight: 900, height: 48, flex: "0 0 auto", padding: "0 24px" }}
                      onClick={() => loadSkillForm(selectedAgent, key)}
                    >
                      {key}
                    </button>
                    {selectedAgent.skills?.some(s => s.key === `${key}_alt`) ? (
                      <button 
                        type="button"
                        className={`btn ${editingSkillKey === `${key}_alt` ? "btn-primary" : "btn-secondary"}`}
                        style={{ textTransform: "uppercase", fontWeight: 800, height: 36, marginLeft: 16, marginTop: -8, fontSize: 12 }}
                        onClick={() => loadSkillForm(selectedAgent, `${key}_alt`)}
                      >
                        ↳ {key} (Alt)
                      </button>
                    ) : (
                      <button 
                        type="button"
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

              <div style={{ flex: 1, maxHeight: isModalMode ? "none" : "70vh", overflowY: "auto", paddingRight: 8 }}>
                <form onSubmit={handleSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: 24, borderRadius: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h3 style={{ margin: 0, textTransform: "uppercase", color: "var(--val-yellow)" }}>Editando {editingSkillKey}</h3>
                    <label className="checkbox-label" style={{ padding: "8px 16px", background: formData.enabled ? "rgba(0, 212, 170, 0.1)" : "rgba(255, 70, 85, 0.1)", borderRadius: 8, border: `1px solid ${formData.enabled ? "rgba(0, 212, 170, 0.3)" : "rgba(255, 70, 85, 0.3)"}` }}>
                      <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                      <span className="checkbox-custom"></span>
                      <span style={{ fontWeight: 800, color: formData.enabled ? "var(--val-cyan)" : "var(--val-red)" }}>{formData.enabled ? "HABILITADA" : "DESHABILITADA"}</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                    {(["general", "mechanics", "effects"] as const).map(tab => (
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
                        {tab === "general" ? "General & Economía" : tab === "mechanics" ? "Mecánica (Árbol)" : "Efectos & Pasivas"}
                      </button>
                    ))}
                  </div>

                  {activeTab === "general" && (
                    <div className="tab-content fade-in">
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 2 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nombre Habilidad</label>
                          <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Tipo</label>
                          <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as "Basic" | "Signature" | "Ultimate" | "Passive"})}>
                            <option value="Basic">Básica</option>
                            <option value="Signature">Firma (Signature)</option>
                            <option value="Ultimate">Ultimate</option>
                            <option value="Passive">Pasiva</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Icono de la habilidad (URL)</label>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <input className="input-field" value={formData.displayIcon} onChange={e => setFormData({...formData, displayIcon: e.target.value})} style={{ flex: 1 }} />
                          <button type="button" className="btn btn-secondary" onClick={handleFetchIcon} style={{ flexShrink: 0, height: 48 }}>Valorant API</button>
                        </div>
                      </div>

                      <h4 style={{ marginTop: 32, marginBottom: 16, color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>Economía y Usos</h4>
                      
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Coste Créditos</label>
                          <input type="number" className="input-field" value={formData.costCredits} onChange={e => setFormData({...formData, costCredits: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Puntos Ultimate</label>
                          <input type="number" className="input-field" value={formData.costUltPoints} onChange={e => setFormData({...formData, costUltPoints: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Usos por Ronda</label>
                          <input type="number" className="input-field" value={formData.usesPerRound} onChange={e => setFormData({...formData, usesPerRound: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Condición de Recarga</label>
                          <input className="input-field" placeholder="ej. 2 kills, 40s cooldown..." value={formData.rechargeCondition} onChange={e => setFormData({...formData, rechargeCondition: e.target.value})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Nota de Coste</label>
                          <input className="input-field" placeholder="ej. Usa estrellas compartidas" value={formData.costNote} onChange={e => setFormData({...formData, costNote: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "mechanics" && (
                    <div className="tab-content fade-in">
                      <div className="form-group" style={{ marginBottom: 24, padding: 16, background: "rgba(0, 212, 170, 0.05)", border: "1px solid rgba(0, 212, 170, 0.2)", borderRadius: 12 }}>
                        <label style={{ fontSize: 14, fontWeight: 900, color: "var(--val-cyan)", marginBottom: 8, display: "block" }}>Mecánica Central de Despliegue</label>
                        <select className="input-field" value={formData.deploymentType} onChange={e => {
                          const val = e.target.value as DeploymentType;
                          if (val === "self_instant" || val === "equip_weapon") {
                            setFormData({...formData, deploymentType: val, geometryType: "none"});
                          } else {
                            setFormData({...formData, deploymentType: val});
                          }
                        }} style={{ background: "rgba(0,0,0,0.5)", fontSize: 16, height: 56 }}>
                          <option value="self_instant">Self / Instantáneo (Ej: Dash, Curación Reyna)</option>
                          <option value="projectile_terminal_aoe">Proyectil -&gt; Área Terminal (Detonación)</option>
                          <option value="projectile_sweeping">Proyectil -&gt; Barrido en Vuelo (Sweeping)</option>
                          <option value="map_target_aoe">Target en Mapa Táctico -&gt; Área (Ej: Humo Brim, Asteroides Astra)</option>
                          <option value="linear_wall">Muro Lineal (Ej: Muro Viper, Muro Phoenix)</option>
                          <option value="two_point_barrier">Barrera de 2 Puntos (Ej: Cable Cypher, Muro Sage)</option>
                          <option value="self_mobile_aura">Aura Móvil Personal (Ej: Ulti KAY/O, Reyna Empress)</option>
                          <option value="static_deployable">Desplegable Estático (Ej: Ulti KJ, Trampa Cypher, Muro Sage)</option>
                          <option value="equip_weapon">Equipar Arma (Ej: Ulti Jett, Armas Chamber)</option>
                          <option value="autonomous_entity">Entidad Autónoma (Ej: Boombot Raze, Torreta KJ)</option>
                        </select>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Al seleccionar la mecánica central, se infiere el comportamiento del motor.</p>
                        
                        {(formData.deploymentType === "projectile_terminal_aoe" || formData.deploymentType === "projectile_sweeping" || formData.deploymentType === "linear_wall" || formData.deploymentType === "self_mobile_aura") && (
                          <div style={{ marginTop: 12 }}>
                            <label className="checkbox-label">
                              <input type="checkbox" checked={formData.traversesWalls} onChange={e => setFormData({...formData, traversesWalls: e.target.checked})} />
                              <span className="checkbox-custom"></span>
                              <span style={{ fontSize: 12, fontWeight: 800 }}>Atraviesa Paredes (Geometría del Mundo)</span>
                            </label>
                          </div>
                        )}
                        
                        {formData.deploymentType !== "self_instant" && formData.deploymentType !== "equip_weapon" && (
                          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(0, 212, 170, 0.2)" }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--val-cyan)", marginBottom: 8, display: "block" }}>Forma Geométrica Visual (Motor 2D)</label>
                            <select className="input-field" value={formData.geometryType} onChange={e => setFormData({...formData, geometryType: e.target.value as "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross"})} style={{ background: "rgba(0,0,0,0.5)" }}>
                              <option value="none">Ninguna (Solo Icono)</option>
                              <option value="circle">Círculo / Área Radial</option>
                              <option value="rectangle">Rectángulo</option>
                              <option value="line">Línea (Conexión directa)</option>
                              <option value="cone">Cono (Visión frontal)</option>
                              <option value="curve">Curva (Muro moldeable)</option>
                              <option value="sector">Sector (Área direccional)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <h4 style={{ marginTop: 32, marginBottom: 16, color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>Tiempos Base y Casteo</h4>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Windup (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.windup} onChange={e => setFormData({...formData, windup: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Duración (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} />
                        </div>
                        {(formData.deploymentType === "map_target_aoe" || formData.deploymentType === "static_deployable" || formData.deploymentType === "two_point_barrier" || formData.deploymentType === "linear_wall") && (
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rango de Cast (m)</label>
                            <input type="number" step="0.1" className="input-field" placeholder="0 = Infinito" value={formData.castRange} onChange={e => setFormData({...formData, castRange: Number(e.target.value)})} />
                          </div>
                        )}
                      </div>

                      <h4 style={{ marginTop: 32, marginBottom: 16, color: "var(--val-yellow)", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>Propiedades Específicas: {formData.deploymentType}</h4>
                      
                      {/* Específicos de Proyectiles */}
                      {(formData.deploymentType === "projectile_terminal_aoe" || formData.deploymentType === "projectile_sweeping") && (
                        <>
                          <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Velocidad Proyectil</label>
                              <input type="number" className="input-field" value={formData.projectileSpeed} onChange={e => setFormData({...formData, projectileSpeed: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Alcance Máx. (m)</label>
                              <input type="number" className="input-field" value={formData.projectileMaxDistance} onChange={e => setFormData({...formData, projectileMaxDistance: Number(e.target.value)})} placeholder="Ej: 35" />
                            </div>
                          </div>
                          {formData.deploymentType === "projectile_terminal_aoe" && (
                            <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rebotes Máx.</label>
                                <input type="number" className="input-field" value={formData.bounces} onChange={e => setFormData({...formData, bounces: Number(e.target.value)})} />
                              </div>
                              <div className="form-group" style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 12 }}>
                                <label className="checkbox-label">
                                  <input type="checkbox" checked={formData.steerable} onChange={e => setFormData({...formData, steerable: e.target.checked})} />
                                  <span className="checkbox-custom"></span>
                                  <span style={{ fontSize: 12, fontWeight: 800 }}>Controlable / Curvable</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Específicos de Geometría Radial */}
                      {(formData.geometryType === "circle" || formData.geometryType === "cone" || formData.geometryType === "sector") && (
                        <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Radio del Área (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.aoeRadius} onChange={e => setFormData({...formData, aoeRadius: Number(e.target.value)})} />
                          </div>
                          {(formData.geometryType === "cone" || formData.geometryType === "sector") && (
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Ángulo (grados)</label>
                              <input type="number" className="input-field" value={formData.visionConeAngle} onChange={e => setFormData({...formData, visionConeAngle: Number(e.target.value)})} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Específicos de Geometría Lineal */}
                      {(formData.geometryType === "rectangle" || formData.geometryType === "line" || formData.geometryType === "curve") && (
                        <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Ancho/Grosor (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.aoeWidth} onChange={e => setFormData({...formData, aoeWidth: Number(e.target.value)})} />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Largo/Alcance Máx (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.aoeLength} onChange={e => setFormData({...formData, aoeLength: Number(e.target.value)})} />
                          </div>
                        </div>
                      )}

                      {/* Otros específicos combinados */}
                      {formData.deploymentType === "autonomous_entity" && (
                        <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Radio Activación (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.activationRadius} onChange={e => setFormData({...formData, activationRadius: Number(e.target.value)})} />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Cono Visión (grados)</label>
                            <input type="number" className="input-field" value={formData.visionConeAngle} onChange={e => setFormData({...formData, visionConeAngle: Number(e.target.value)})} />
                          </div>
                        </div>
                      )}
                      
                      {formData.deploymentType === "equip_weapon" && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Munición Máxima (0 = Inf)</label>
                          <input type="number" className="input-field" value={formData.maxAmmo} onChange={e => setFormData({...formData, maxAmmo: Number(e.target.value)})} />
                        </div>
                      )}

                    </div>
                  )}

                  {activeTab === "effects" && (
                    <div className="tab-content fade-in">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                        <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                          <input type="checkbox" checked={formData.hasDamage} onChange={e => setFormData({...formData, hasDamage: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span style={{ fontWeight: 800 }}>Inflige Daño</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                          <input type="checkbox" checked={formData.hasHeal} onChange={e => setFormData({...formData, hasHeal: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span style={{ fontWeight: 800 }}>Provee Curación</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                          <input type="checkbox" checked={formData.hasVision} onChange={e => setFormData({...formData, hasVision: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span style={{ fontWeight: 800 }}>Efectos de Visión</span>
                        </label>
                        <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                          <input type="checkbox" checked={formData.hasDestructible} onChange={e => setFormData({...formData, hasDestructible: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span style={{ fontWeight: 800 }}>Destruible (HP)</span>
                        </label>
                      </div>

                      {formData.hasDamage && (
                        <div style={{ marginBottom: 24, padding: 16, background: "rgba(255, 70, 85, 0.05)", borderRadius: 12, border: "1px solid rgba(255, 70, 85, 0.2)" }}>
                           <h4 style={{ color: "var(--val-red)", marginBottom: 12 }}>Daño</h4>
                           <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Tipo Daño</label>
                               <select className="input-field" value={formData.damageType} onChange={e => setFormData({...formData, damageType: e.target.value as "burst" | "dot" | "weapon" | "instant" | "decay"})}>
                                 <option value="burst">Burst</option>
                                 <option value="dot">DoT</option>
                                 <option value="weapon">Weapon</option>
                               </select>
                             </div>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Daño Base</label>
                               <input type="number" className="input-field" value={formData.baseDamage} onChange={e => setFormData({...formData, baseDamage: Number(e.target.value)})} />
                             </div>
                           </div>
                           <div className="form-row" style={{ display: "flex", gap: 16 }}>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Daño/s (DoT)</label>
                               <input type="number" className="input-field" value={formData.damagePerSecond} onChange={e => setFormData({...formData, damagePerSecond: Number(e.target.value)})} />
                             </div>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Pulso Daño</label>
                               <input type="number" className="input-field" value={formData.damagePerPulse} onChange={e => setFormData({...formData, damagePerPulse: Number(e.target.value)})} />
                             </div>
                           </div>
                        </div>
                      )}

                      {formData.hasHeal && (
                        <div style={{ marginBottom: 24, padding: 16, background: "rgba(0, 212, 170, 0.05)", borderRadius: 12, border: "1px solid rgba(0, 212, 170, 0.2)" }}>
                           <h4 style={{ color: "var(--val-cyan)", marginBottom: 12 }}>Curación</h4>
                           <div className="form-row" style={{ display: "flex", gap: 16 }}>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Cura (Aliados)</label>
                               <input type="number" className="input-field" value={formData.healAmount} onChange={e => setFormData({...formData, healAmount: Number(e.target.value)})} />
                             </div>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Duración Cura</label>
                               <input type="number" className="input-field" value={formData.healDuration} onChange={e => setFormData({...formData, healDuration: Number(e.target.value)})} />
                             </div>
                             <div className="form-group" style={{ flex: 1 }}>
                               <label style={{ fontSize: 12 }}>Auto-cura</label>
                               <input type="number" className="input-field" value={formData.selfHealAmount} onChange={e => setFormData({...formData, selfHealAmount: Number(e.target.value)})} />
                             </div>
                           </div>
                        </div>
                      )}

                      {formData.hasVision && (
                         <div style={{ marginBottom: 24, padding: 16, background: "rgba(255, 255, 255, 0.05)", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.2)" }}>
                           <h4 style={{ color: "#fff", marginBottom: 12 }}>Visión</h4>
                           <label className="checkbox-label"><input type="checkbox" checked={formData.blocksVision} onChange={e => setFormData({...formData, blocksVision: e.target.checked})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Bloquea Visión (Humos/Muros)</span></label>
                           <label className="checkbox-label"><input type="checkbox" checked={formData.flash} onChange={e => setFormData({...formData, flash: e.target.checked})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Flashea (Ciega)</span></label>
                           <label className="checkbox-label"><input type="checkbox" checked={formData.nearsight} onChange={e => setFormData({...formData, nearsight: e.target.checked})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Nearsight (Miope)</span></label>
                           <label className="checkbox-label"><input type="checkbox" checked={formData.reveal} onChange={e => setFormData({...formData, reveal: e.target.checked})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Revela Posición</span></label>
                         </div>
                      )}

                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>CC (Separado por comas)</label>
                        <input className="input-field" value={formData.cc} onChange={e => setFormData({...formData, cc: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>Buffs (Separados por comas)</label>
                        <input className="input-field" value={formData.buffs} onChange={e => setFormData({...formData, buffs: e.target.value})} />
                      </div>

                    </div>
                  )}

                  <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 16, fontWeight: 900 }}>Guardar Habilidad</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
