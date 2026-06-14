"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AgentSkill, ValorantAgent, DeploymentType,
  DeploymentMechanics, LifetimeMechanics, ResolutionMechanics,
  SkillGeometry, ActionEffects, EconomyData
} from "@/lib/domain/agents";

// ── Flat form state ─────────────────────────────────────────────────────────
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

  // Deployment
  dep_type: DeploymentType;
  dep_windup: number;
  dep_spawnOffset: number;
  dep_castRange: number;
  dep_projectileSpeed: number;
  dep_projectileMaxDistance: number;
  dep_bounces: number;
  dep_steerable: boolean;
  dep_traversesWalls: boolean;
  dep_variableDistance: boolean;
  dep_maxAmmo: number;
  dep_directionalOnly: boolean;
  dep_geom_type: "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross";
  dep_geom_radius: number;
  dep_geom_angle: number;
  dep_geom_width: number;
  dep_geom_length: number;

  // Lifetime
  hasLifetime: boolean;
  life_duration: number;
  life_hp: number;
  life_behavior: "static" | "autonomous" | "mobile_aura";
  life_activationRadius: number;
  life_movementSpeed: number;
  life_geom_type: "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross";
  life_geom_radius: number;
  life_geom_angle: number;
  life_geom_width: number;
  life_geom_length: number;

  // Resolution
  hasResolution: boolean;
  res_trigger: "on_impact" | "on_timer" | "on_recast" | "on_death";
  res_geom_type: "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross";
  res_geom_radius: number;
  res_geom_angle: number;
  res_geom_width: number;
  res_geom_length: number;
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
  dep_type: "self_instant",
  dep_windup: 0,
  dep_spawnOffset: 0,
  dep_castRange: 0,
  dep_projectileSpeed: 0,
  dep_projectileMaxDistance: 0,
  dep_bounces: 0,
  dep_steerable: false,
  dep_traversesWalls: false,
  dep_variableDistance: false,
  dep_maxAmmo: 0,
  dep_directionalOnly: false,
  dep_geom_type: "none",
  dep_geom_radius: 0,
  dep_geom_angle: 0,
  dep_geom_width: 0,
  dep_geom_length: 0,
  hasLifetime: false,
  life_duration: 0,
  life_hp: 0,
  life_behavior: "static",
  life_activationRadius: 0,
  life_movementSpeed: 0,
  life_geom_type: "none",
  life_geom_radius: 0,
  life_geom_angle: 0,
  life_geom_width: 0,
  life_geom_length: 0,
  hasResolution: false,
  res_trigger: "on_impact",
  res_geom_type: "none",
  res_geom_radius: 0,
  res_geom_angle: 0,
  res_geom_width: 0,
  res_geom_length: 0,
});

// ── Geometry builder (fully typed) ──────────────────────────────────────────
function buildGeometry(
  type: "none" | "circle" | "rectangle" | "cone" | "line" | "curve" | "sector" | "trapezoid" | "cross",
  radius: number, angle: number, width: number, length: number
): SkillGeometry | undefined {
  switch (type) {
    case "circle":    return { type: "circle", radius: radius || undefined };
    case "cone":      return { type: "cone", radius: radius || undefined, angle: angle || undefined };
    case "sector":    return { type: "sector", radius: radius || undefined, angle: angle || undefined };
    case "rectangle": return { type: "rectangle", width: width || undefined, length: length || undefined };
    case "line":      return { type: "line", width: width || undefined, length: length || undefined };
    case "curve":     return { type: "curve", width: width || undefined, length: length || undefined };
    case "trapezoid": return { type: "trapezoid", width: width || undefined, length: length || undefined };
    case "cross":     return { type: "cross", width: width || undefined, length: length || undefined };
    default:          return undefined;
  }
}

// ── Deployment builder (fully typed switch) ─────────────────────────────────
function buildDeployment(f: SkillFormData): DeploymentMechanics {
  const windup = f.dep_windup || undefined;
  switch (f.dep_type) {
    case "self_instant":
      return { type: "self_instant", windup };
    case "self_mobile_aura":
      return { type: "self_mobile_aura", windup };
    case "projectile_terminal_aoe":
      return {
        type: "projectile_terminal_aoe", windup,
        projectileSpeed: f.dep_projectileSpeed || undefined,
        projectileMaxDistance: f.dep_projectileMaxDistance || undefined,
        bounces: f.dep_bounces || undefined,
        steerable: f.dep_steerable || undefined,
        traversesWalls: f.dep_traversesWalls || undefined,
        variableDistance: f.dep_variableDistance || undefined,
      };
    case "projectile_sweeping":
      return {
        type: "projectile_sweeping", windup,
        spawnOffset: f.dep_spawnOffset || undefined,
        projectileSpeed: f.dep_projectileSpeed || undefined,
        projectileMaxDistance: f.dep_projectileMaxDistance || undefined,
        traversesWalls: f.dep_traversesWalls || undefined,
        geometry: buildGeometry(f.dep_geom_type, f.dep_geom_radius, f.dep_geom_angle, f.dep_geom_width, f.dep_geom_length),
      };
    case "map_target_aoe":
      return { type: "map_target_aoe", windup, castRange: f.dep_castRange || undefined };
    case "static_deployable":
      return { type: "static_deployable", windup, castRange: f.dep_castRange || undefined };
    case "linear_wall":
      return {
        type: "linear_wall", windup,
        steerable: f.dep_steerable || undefined,
        castRange: f.dep_castRange || undefined,
        traversesWalls: f.dep_traversesWalls || undefined,
      };
    case "two_point_barrier":
      return {
        type: "two_point_barrier", windup,
        directionalOnly: f.dep_directionalOnly || undefined,
        castRange: f.dep_castRange || undefined,
      };
    case "equip_weapon":
      return { type: "equip_weapon", windup, maxAmmo: f.dep_maxAmmo || undefined };
    default:
      return { type: "self_instant", windup };
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
export function AgentSkillsManager({
  defaultAgentId, defaultSkillKey, isModalMode, onClose
}: {
  defaultAgentId?: string;
  defaultSkillKey?: string;
  isModalMode?: boolean;
  onClose?: () => void;
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  const [editingSkillKey, setEditingSkillKey] = useState<string>("q");
  const [activeTab, setActiveTab] = useState<"general" | "deployment" | "lifetime" | "resolution">("general");
  const [formData, setFormData] = useState<SkillFormData>(getDefaultFormData());

  const { data: agentsData, isLoading } = useQuery<{ agents: ValorantAgent[] }>({
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
    setActiveTab("general");
    const skill = agent.skills?.find(s => s.key === key);
    if (!skill) { setFormData(getDefaultFormData()); return; }

    const d = skill.deployment || {};
    const l = skill.lifetime || {};
    const r = skill.resolution || {};

    // Read geometry helper
    const readGeom = (geom?: SkillGeometry): Pick<SkillFormData, "dep_geom_type" | "dep_geom_radius" | "dep_geom_angle" | "dep_geom_width" | "dep_geom_length"> & { gType: SkillFormData["dep_geom_type"] } => {
      if (!geom) return { gType: "none", dep_geom_type: "none", dep_geom_radius: 0, dep_geom_angle: 0, dep_geom_width: 0, dep_geom_length: 0 };
      const gType = geom.type as SkillFormData["dep_geom_type"];
      const radius = "radius" in geom ? (geom.radius || 0) : 0;
      const angle = "angle" in geom ? ((geom as { angle?: number }).angle || 0) : 0;
      const width = "width" in geom ? ((geom as { width?: number }).width || 0) : 0;
      const length = "length" in geom ? ((geom as { length?: number }).length || 0) : 0;
      return { gType, dep_geom_type: gType, dep_geom_radius: radius, dep_geom_angle: angle, dep_geom_width: width, dep_geom_length: length };
    };

    const depGeom = "geometry" in d ? readGeom((d as { geometry?: SkillGeometry }).geometry) : readGeom(undefined);
    const lifeGeom = readGeom(l.geometry);
    const resGeom = readGeom(r.geometry);

    setFormData({
      name: skill.name,
      description: skill.description || "",
      color: skill.color || "",
      type: skill.type || "Basic",
      displayIcon: skill.displayIcon || "",
      enabled: skill.enabled ?? true,

      costCredits: skill.economy?.costCredits || 0,
      costUltPoints: skill.economy?.costUltPoints || 0,
      costNote: skill.economy?.costNote || "",
      usesPerRound: skill.economy?.usesPerRound || 1,
      rechargeCondition: skill.economy?.rechargeCondition || "",

      dep_type: ("type" in d ? (d as { type: DeploymentType }).type : "self_instant") || "self_instant",
      dep_windup: ("windup" in d ? (d as { windup?: number }).windup : undefined) || 0,
      dep_spawnOffset: ("spawnOffset" in d ? (d as { spawnOffset?: number }).spawnOffset : undefined) || 0,
      dep_castRange: ("castRange" in d ? (d as { castRange?: number }).castRange : undefined) || 0,
      dep_projectileSpeed: ("projectileSpeed" in d ? (d as { projectileSpeed?: number }).projectileSpeed : undefined) || 0,
      dep_projectileMaxDistance: ("projectileMaxDistance" in d ? (d as { projectileMaxDistance?: number }).projectileMaxDistance : undefined) || 0,
      dep_bounces: ("bounces" in d ? (d as { bounces?: number }).bounces : undefined) || 0,
      dep_steerable: ("steerable" in d ? (d as { steerable?: boolean }).steerable : undefined) || false,
      dep_traversesWalls: ("traversesWalls" in d ? (d as { traversesWalls?: boolean }).traversesWalls : undefined) || false,
      dep_variableDistance: ("variableDistance" in d ? (d as { variableDistance?: boolean }).variableDistance : undefined) || false,
      dep_maxAmmo: ("maxAmmo" in d ? (d as { maxAmmo?: number }).maxAmmo : undefined) || 0,
      dep_directionalOnly: ("directionalOnly" in d ? (d as { directionalOnly?: boolean }).directionalOnly : undefined) || false,
      dep_geom_type: depGeom.gType,
      dep_geom_radius: depGeom.dep_geom_radius,
      dep_geom_angle: depGeom.dep_geom_angle,
      dep_geom_width: depGeom.dep_geom_width,
      dep_geom_length: depGeom.dep_geom_length,

      hasLifetime: skill.lifetime != null && Object.keys(skill.lifetime).length > 0,
      life_duration: l.duration || 0,
      life_hp: l.destructible?.hp || 0,
      life_behavior: l.behavior || "static",
      life_activationRadius: l.autonomous?.activationRadius || 0,
      life_movementSpeed: l.autonomous?.movementSpeed || 0,
      life_geom_type: lifeGeom.gType,
      life_geom_radius: lifeGeom.dep_geom_radius,
      life_geom_angle: lifeGeom.dep_geom_angle,
      life_geom_width: lifeGeom.dep_geom_width,
      life_geom_length: lifeGeom.dep_geom_length,

      hasResolution: !!r.trigger,
      res_trigger: r.trigger || "on_impact",
      res_geom_type: resGeom.gType,
      res_geom_radius: resGeom.dep_geom_radius,
      res_geom_angle: resGeom.dep_geom_angle,
      res_geom_width: resGeom.dep_geom_width,
      res_geom_length: resGeom.dep_geom_length,
    });
  };

  React.useEffect(() => {
    if (defaultAgentId && defaultSkillKey && agents.length > 0 && !selectedAgent) {
      const agent = agents.find(a => a.id === defaultAgentId);
      if (agent) { setSelectedAgent(agent); loadSkillForm(agent, defaultSkillKey); }
    }
  }, [agents, selectedAgent, defaultAgentId, defaultSkillKey]);

  const saveSkillMutation = useMutation({
    mutationFn: async (payload: Omit<AgentSkill, "id">) => {
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error saving skill");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAgents"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      alert("Habilidad guardada correctamente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    const economy: EconomyData = {
      costCredits: formData.costCredits || undefined,
      costUltPoints: formData.costUltPoints || undefined,
      costNote: formData.costNote || undefined,
      usesPerRound: formData.usesPerRound || undefined,
      rechargeCondition: formData.rechargeCondition || undefined,
    };

    const deployment: DeploymentMechanics = buildDeployment(formData);

    const lifetime: LifetimeMechanics | null = formData.hasLifetime ? {
      duration: formData.life_duration || undefined,
      behavior: formData.life_behavior || undefined,
      destructible: formData.life_hp ? { hp: formData.life_hp } : undefined,
      autonomous: formData.life_behavior === "autonomous" ? {
        activationRadius: formData.life_activationRadius || undefined,
        movementSpeed: formData.life_movementSpeed || undefined,
      } : undefined,
      geometry: buildGeometry(
        formData.life_geom_type,
        formData.life_geom_radius, formData.life_geom_angle,
        formData.life_geom_width, formData.life_geom_length
      ),
    } : null;

    const resolution: ResolutionMechanics | null = formData.hasResolution ? {
      trigger: formData.res_trigger,
      geometry: buildGeometry(
        formData.res_geom_type,
        formData.res_geom_radius, formData.res_geom_angle,
        formData.res_geom_width, formData.res_geom_length
      ),
    } : null;

    const payload: Omit<AgentSkill, "id"> = {
      agentId: selectedAgent.id,
      key: editingSkillKey,
      name: formData.name,
      description: formData.description,
      color: formData.color,
      type: formData.type,
      displayIcon: formData.displayIcon || undefined,
      enabled: formData.enabled,
      economy,
      deployment,
      lifetime,
      resolution,
    };

    saveSkillMutation.mutate(payload);
  };

  const handleFetchIcon = async () => {
    if (!selectedAgent || !editingSkillKey) return;
    try {
      const res = await fetch(`https://valorant-api.com/v1/agents/${selectedAgent.id}?language=es-ES`);
      const data = await res.json();
      const abilities = data.data.abilities;
      if (!abilities) return;
      const keyMap: Record<string, string> = {
        "q": "Ability1", "e": "Ability2", "c": "Grenade", "x": "Ultimate", "passive": "Passive"
      };
      const baseKey = editingSkillKey.replace("_alt", "").toLowerCase();
      const slot = keyMap[baseKey];
      if (slot) {
        const ability = abilities.find((a: { slot: string; displayIcon: string }) => a.slot === slot);
        if (ability?.displayIcon) {
          setFormData(prev => ({ ...prev, displayIcon: ability.displayIcon }));
        }
      }
    } catch (err) { console.error(err); }
  };

  if (session?.user?.role !== "super_admin") {
    return <div className="p-20 text-center">Acceso restringido.</div>;
  }

  // ── GeomRow helper ─────────────────────────────────────────────────────────
  type GeomFields = {
    geom_type: SkillFormData["dep_geom_type"];
    geom_radius: number; geom_angle: number; geom_width: number; geom_length: number;
  };
  const GeomEditor = ({
    geomType, radius, angle, width, length,
    onType, onRadius, onAngle, onWidth, onLength
  }: {
    geomType: SkillFormData["dep_geom_type"];
    radius: number; angle: number; width: number; length: number;
    onType: (v: SkillFormData["dep_geom_type"]) => void;
    onRadius: (v: number) => void; onAngle: (v: number) => void;
    onWidth: (v: number) => void; onLength: (v: number) => void;
  }) => (
    <div>
      <select className="input-field" value={geomType} onChange={e => onType(e.target.value as SkillFormData["dep_geom_type"])} style={{ marginBottom: 8 }}>
        <option value="none">Ninguna</option>
        <option value="circle">Círculo</option>
        <option value="rectangle">Rectángulo</option>
        <option value="cone">Cono</option>
        <option value="sector">Sector</option>
        <option value="line">Línea</option>
        <option value="curve">Curva</option>
      </select>
      {(geomType === "circle" || geomType === "cone" || geomType === "sector") && (
        <div style={{ display: "flex", gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ fontSize: 11 }}>Radio (m)</label>
            <input type="number" className="input-field" value={radius} onChange={e => onRadius(Number(e.target.value))} />
          </div>
          {(geomType === "cone" || geomType === "sector") && (
            <div className="form-group" style={{ flex: 1 }}>
              <label style={{ fontSize: 11 }}>Ángulo (°)</label>
              <input type="number" className="input-field" value={angle} onChange={e => onAngle(Number(e.target.value))} />
            </div>
          )}
        </div>
      )}
      {(geomType === "rectangle" || geomType === "line" || geomType === "curve") && (
        <div style={{ display: "flex", gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ fontSize: 11 }}>Ancho (m)</label>
            <input type="number" className="input-field" value={width} onChange={e => onWidth(Number(e.target.value))} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ fontSize: 11 }}>Largo (m)</label>
            <input type="number" className="input-field" value={length} onChange={e => onLength(Number(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-wrapper" style={isModalMode ? { padding: 0, background: "transparent", minHeight: "auto" } : {}}>
      {!isModalMode && (
        <>
          <header className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
            <div>
              <span className="badge" style={{ background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", marginBottom: 8 }}>PLATFORM MANAGEMENT</span>
              <h1 className="gradient-text" style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-1px" }}>Agentes y Habilidades</h1>
              <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 4 }}>Configuración de Despliegue, Vida y Resolución</p>
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
                <button className="icon-action-btn" onClick={() => { setSelectedAgent(null); if (onClose) onClose(); }}>✕</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 24 }}>
              {/* Skill Key Selector */}
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

              {/* Form Panel */}
              <div style={{ flex: 1, maxHeight: isModalMode ? "none" : "70vh", overflowY: "auto", paddingRight: 8 }}>
                <form onSubmit={handleSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: 24, borderRadius: 16 }}>
                  {/* Form Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h3 style={{ margin: 0, textTransform: "uppercase", color: "var(--val-yellow)" }}>Editando {editingSkillKey}</h3>
                    <label className="checkbox-label" style={{ padding: "8px 16px", background: formData.enabled ? "rgba(0, 212, 170, 0.1)" : "rgba(255, 70, 85, 0.1)", borderRadius: 8, border: `1px solid ${formData.enabled ? "rgba(0, 212, 170, 0.3)" : "rgba(255, 70, 85, 0.3)"}` }}>
                      <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                      <span className="checkbox-custom"></span>
                      <span style={{ fontWeight: 800, color: formData.enabled ? "var(--val-cyan)" : "var(--val-red)" }}>{formData.enabled ? "HABILITADA" : "DESHABILITADA"}</span>
                    </label>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                    {(["general", "deployment", "lifetime", "resolution"] as const).map(tab => (
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
                        {tab === "general" ? "General & Economía" : tab === "deployment" ? "Despliegue" : tab === "lifetime" ? "Vida Activa" : "Resolución"}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab: General ─────────────────────────────────────── */}
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
                        <label className="form-label">Descripción</label>
                        <textarea className="input-field" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>

                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Icono de la habilidad (URL)</label>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {formData.displayIcon && <img src={formData.displayIcon} style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(0,0,0,0.5)" }} alt="icon" />}
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
                      <div className="form-row" style={{ display: "flex", gap: 16 }}>
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

                  {/* ── Tab: Deployment ──────────────────────────────────── */}
                  {activeTab === "deployment" && (
                    <div className="tab-content fade-in">
                      <div className="form-group" style={{ marginBottom: 24, padding: 16, background: "rgba(0, 212, 170, 0.05)", border: "1px solid rgba(0, 212, 170, 0.2)", borderRadius: 12 }}>
                        <label style={{ fontSize: 14, fontWeight: 900, color: "var(--val-cyan)", marginBottom: 8, display: "block" }}>Mecánica Central de Despliegue</label>
                        <select className="input-field" value={formData.dep_type} onChange={e => setFormData({...formData, dep_type: e.target.value as DeploymentType})} style={{ background: "rgba(0,0,0,0.5)", fontSize: 16, height: 56 }}>
                          <option value="self_instant">Self / Instantáneo (Ej: Dash, Curación Reyna)</option>
                          <option value="projectile_terminal_aoe">Proyectil → Área Terminal (Detonación)</option>
                          <option value="projectile_sweeping">Proyectil → Barrido en Vuelo (Sweeping)</option>
                          <option value="map_target_aoe">Target en Mapa Táctico → Área</option>
                          <option value="linear_wall">Muro Lineal</option>
                          <option value="two_point_barrier">Barrera de 2 Puntos</option>
                          <option value="self_mobile_aura">Aura Móvil Personal</option>
                          <option value="static_deployable">Desplegable Estático (Trampa/Torreta)</option>
                          <option value="equip_weapon">Equipar Arma</option>
                        </select>
                      </div>

                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Windup (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.dep_windup} onChange={e => setFormData({...formData, dep_windup: Number(e.target.value)})} />
                        </div>
                        {formData.dep_type === "projectile_sweeping" && (
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Spawn Offset (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.dep_spawnOffset} onChange={e => setFormData({...formData, dep_spawnOffset: Number(e.target.value)})} />
                          </div>
                        )}
                        {(formData.dep_type === "map_target_aoe" || formData.dep_type === "static_deployable" || formData.dep_type === "two_point_barrier" || formData.dep_type === "linear_wall") && (
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rango de Cast (m)</label>
                            <input type="number" step="0.1" className="input-field" value={formData.dep_castRange} onChange={e => setFormData({...formData, dep_castRange: Number(e.target.value)})} />
                          </div>
                        )}
                        {formData.dep_type === "equip_weapon" && (
                          <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Munición Máxima</label>
                            <input type="number" className="input-field" value={formData.dep_maxAmmo} onChange={e => setFormData({...formData, dep_maxAmmo: Number(e.target.value)})} />
                          </div>
                        )}
                      </div>

                      {(formData.dep_type === "projectile_terminal_aoe" || formData.dep_type === "projectile_sweeping") && (
                        <div style={{ background: "rgba(255,255,255,0.04)", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                          <h4 style={{ color: "var(--val-yellow)", margin: "0 0 12px" }}>Propiedades de Proyectil</h4>
                          <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Velocidad</label>
                              <input type="number" className="input-field" value={formData.dep_projectileSpeed} onChange={e => setFormData({...formData, dep_projectileSpeed: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Alcance Máx. (m)</label>
                              <input type="number" className="input-field" value={formData.dep_projectileMaxDistance} onChange={e => setFormData({...formData, dep_projectileMaxDistance: Number(e.target.value)})} />
                            </div>
                          </div>
                          {formData.dep_type === "projectile_terminal_aoe" && (
                            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rebotes Máx.</label>
                                <input type="number" className="input-field" value={formData.dep_bounces} onChange={e => setFormData({...formData, dep_bounces: Number(e.target.value)})} />
                              </div>
                              <label className="checkbox-label" style={{ marginTop: 20 }}>
                                <input type="checkbox" checked={formData.dep_steerable} onChange={e => setFormData({...formData, dep_steerable: e.target.checked})} />
                                <span className="checkbox-custom"></span>
                                <span style={{ fontSize: 12, fontWeight: 800 }}>Controlable</span>
                              </label>
                              <label className="checkbox-label" style={{ marginTop: 20 }}>
                                <input type="checkbox" checked={formData.dep_variableDistance} onChange={e => setFormData({...formData, dep_variableDistance: e.target.checked})} />
                                <span className="checkbox-custom"></span>
                                <span style={{ fontSize: 12, fontWeight: 800 }}>Distancia Variable</span>
                              </label>
                            </div>
                          )}
                          <label className="checkbox-label" style={{ marginTop: 8 }}>
                            <input type="checkbox" checked={formData.dep_traversesWalls} onChange={e => setFormData({...formData, dep_traversesWalls: e.target.checked})} />
                            <span className="checkbox-custom"></span>
                            <span style={{ fontSize: 12, fontWeight: 800 }}>Atraviesa Paredes</span>
                          </label>
                        </div>
                      )}

                      {formData.dep_type === "two_point_barrier" && (
                        <label className="checkbox-label" style={{ marginBottom: 16 }}>
                          <input type="checkbox" checked={formData.dep_directionalOnly} onChange={e => setFormData({...formData, dep_directionalOnly: e.target.checked})} />
                          <span className="checkbox-custom"></span>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>Solo Direccional</span>
                        </label>
                      )}

                      {formData.dep_type === "projectile_sweeping" && (
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ color: "var(--val-cyan)", marginBottom: 8 }}>Geometría del Barrido</h4>
                          <GeomEditor
                            geomType={formData.dep_geom_type} radius={formData.dep_geom_radius}
                            angle={formData.dep_geom_angle} width={formData.dep_geom_width} length={formData.dep_geom_length}
                            onType={v => setFormData({...formData, dep_geom_type: v})}
                            onRadius={v => setFormData({...formData, dep_geom_radius: v})}
                            onAngle={v => setFormData({...formData, dep_geom_angle: v})}
                            onWidth={v => setFormData({...formData, dep_geom_width: v})}
                            onLength={v => setFormData({...formData, dep_geom_length: v})}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Lifetime ──────────────────────────────────── */}
                  {activeTab === "lifetime" && (
                    <div className="tab-content fade-in">
                      <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 24, display: "flex" }}>
                        <input type="checkbox" checked={formData.hasLifetime} onChange={e => setFormData({...formData, hasLifetime: e.target.checked})} />
                        <span className="checkbox-custom"></span>
                        <span style={{ fontWeight: 800 }}>Habilitar Fase de Vida Activa</span>
                      </label>

                      {formData.hasLifetime && (
                        <>
                          <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Duración (s)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.life_duration} onChange={e => setFormData({...formData, life_duration: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>HP (0 = invulnerable)</label>
                          <input type="number" className="input-field" value={formData.life_hp} onChange={e => setFormData({...formData, life_hp: Number(e.target.value)})} />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Comportamiento</label>
                        <select className="input-field" value={formData.life_behavior} onChange={e => setFormData({...formData, life_behavior: e.target.value as "static" | "autonomous" | "mobile_aura"})}>
                          <option value="static">Estático</option>
                          <option value="autonomous">IA Autónoma (Persigue/Detecta)</option>
                          <option value="mobile_aura">Aura Móvil (sigue al jugador)</option>
                        </select>
                      </div>

                      {formData.life_behavior === "autonomous" && (
                        <div style={{ background: "rgba(59,130,246,0.1)", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid rgba(59,130,246,0.3)" }}>
                          <div className="form-row" style={{ display: "flex", gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "var(--val-cyan)" }}>Radio de Detección (m)</label>
                              <input type="number" className="input-field" value={formData.life_activationRadius} onChange={e => setFormData({...formData, life_activationRadius: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "var(--val-cyan)" }}>Velocidad de Movimiento</label>
                              <input type="number" className="input-field" value={formData.life_movementSpeed} onChange={e => setFormData({...formData, life_movementSpeed: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                      )}

                      <h4 style={{ color: "var(--val-cyan)", marginBottom: 8 }}>Geometría del Área Activa</h4>
                      <GeomEditor
                        geomType={formData.life_geom_type} radius={formData.life_geom_radius}
                        angle={formData.life_geom_angle} width={formData.life_geom_width} length={formData.life_geom_length}
                        onType={v => setFormData({...formData, life_geom_type: v})}
                        onRadius={v => setFormData({...formData, life_geom_radius: v})}
                        onAngle={v => setFormData({...formData, life_geom_angle: v})}
                        onWidth={v => setFormData({...formData, life_geom_width: v})}
                        onLength={v => setFormData({...formData, life_geom_length: v})}
                      />
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Resolution ────────────────────────────────── */}
                  {activeTab === "resolution" && (
                    <div className="tab-content fade-in">
                      <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 24, display: "flex" }}>
                        <input type="checkbox" checked={formData.hasResolution} onChange={e => setFormData({...formData, hasResolution: e.target.checked})} />
                        <span className="checkbox-custom"></span>
                        <span style={{ fontWeight: 800 }}>Habilitar Fase de Resolución (Explosión/Fin)</span>
                      </label>

                      {formData.hasResolution && (
                        <>
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Trigger</label>
                            <select className="input-field" value={formData.res_trigger} onChange={e => setFormData({...formData, res_trigger: e.target.value as "on_impact" | "on_timer" | "on_recast" | "on_death"})}>
                              <option value="on_impact">Al Impactar (Ej: Flecha Raze)</option>
                              <option value="on_timer">Por Tiempo (Ej: Flash KAY/O)</option>
                              <option value="on_recast">Al Recastear (Ej: C4 Raze)</option>
                              <option value="on_death">Al Morir la Entidad</option>
                            </select>
                          </div>

                          <h4 style={{ color: "var(--val-cyan)", marginBottom: 8 }}>Geometría del Impacto/Explosión</h4>
                          <GeomEditor
                            geomType={formData.res_geom_type} radius={formData.res_geom_radius}
                            angle={formData.res_geom_angle} width={formData.res_geom_width} length={formData.res_geom_length}
                            onType={v => setFormData({...formData, res_geom_type: v})}
                            onRadius={v => setFormData({...formData, res_geom_radius: v})}
                            onAngle={v => setFormData({...formData, res_geom_angle: v})}
                            onWidth={v => setFormData({...formData, res_geom_width: v})}
                            onLength={v => setFormData({...formData, res_geom_length: v})}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 16, fontWeight: 900 }}>
                      {saveSkillMutation.isPending ? "Guardando..." : "Guardar Habilidad"}
                    </button>
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
