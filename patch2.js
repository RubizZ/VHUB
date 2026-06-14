const fs = require('fs');

// Read the old layout file which has the OLD schema
let content = fs.readFileSync('src/components/AgentSkillsManager.tsx', 'utf16le');
if (content.indexOf('interface SkillFormData') === -1) {
    content = fs.readFileSync('src/components/AgentSkillsManager.tsx', 'utf8');
}
// Strip BOM if present
if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);

// 1. Update imports
content = content.replace(
    'import { AgentSkill, ValorantAgent, DeploymentType, MechanicsData, EffectsData, DamageData, HealData, VisionData } from "@/lib/domain/agents";',
    'import { AgentSkill, ValorantAgent, DeploymentType } from "@/lib/domain/agents";'
);

// 2. Replace Interface
const interfaceStart = content.indexOf('interface SkillFormData {');
const interfaceEnd = content.indexOf('export function AgentSkillsManager');
const newInterface = `interface SkillFormData {
  name: string;
  description: string;
  color: string;
  type: "Basic" | "Signature" | "Ultimate" | "Passive";
  displayIcon: string;
  enabled: boolean;

  costCredits: number;
  costUltPoints: number;
  costNote: string;
  usesPerRound: number;
  rechargeCondition: string;

  // Deployment
  dep_type: string;
  dep_windup: number;
  dep_castRange: number;
  dep_projectileSpeed: number;
  dep_projectileMaxDistance: number;
  dep_bounces: number;
  dep_steerable: boolean;
  dep_traversesWalls: boolean;
  dep_maxAmmo: number;
  dep_directionalOnly: boolean;
  dep_geom_type: string;
  dep_geom_radius: number;
  dep_geom_width: number;
  dep_geom_length: number;
  dep_effects: any;

  // Lifetime
  life_duration: number;
  life_hp: number;
  life_behavior: string;
  life_activationRadius: number;
  life_movementSpeed: number;
  life_geom_type: string;
  life_geom_radius: number;
  life_geom_width: number;
  life_geom_length: number;
  life_effects: any;

  // Resolution
  hasResolution: boolean;
  res_trigger: string;
  res_geom_type: string;
  res_geom_radius: number;
  res_geom_width: number;
  res_geom_length: number;
  res_effects: any;
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
  dep_castRange: 0,
  dep_projectileSpeed: 0,
  dep_projectileMaxDistance: 0,
  dep_bounces: 0,
  dep_steerable: false,
  dep_traversesWalls: false,
  dep_maxAmmo: 0,
  dep_directionalOnly: false,
  dep_geom_type: "none",
  dep_geom_radius: 0,
  dep_geom_width: 0,
  dep_geom_length: 0,
  dep_effects: {},

  life_duration: 0,
  life_hp: 0,
  life_behavior: "static",
  life_activationRadius: 0,
  life_movementSpeed: 0,
  life_geom_type: "none",
  life_geom_radius: 0,
  life_geom_width: 0,
  life_geom_length: 0,
  life_effects: {},

  hasResolution: false,
  res_trigger: "on_impact",
  res_geom_type: "none",
  res_geom_radius: 0,
  res_geom_width: 0,
  res_geom_length: 0,
  res_effects: {}
});

`;

content = content.substring(0, interfaceStart) + newInterface + content.substring(interfaceEnd);

// 3. Replace Methods
const loadStart = content.indexOf('  const loadSkillForm = (agent: ValorantAgent, key: string) => {');
const loadEnd = content.indexOf('  const handleFetchIcon = async () => {', loadStart);

const newMethods = `  const loadSkillForm = (agent: ValorantAgent, key: string) => {
    setEditingSkillKey(key);
    const skill = agent.skills?.find(s => s.key === key);
    if (skill) {
      const d = skill.deployment as any || {};
      const l = skill.lifetime as any || {};
      const r = skill.resolution as any || {};

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

        // Deployment
        dep_type: d.type || "self_instant",
        dep_windup: d.windup || 0,
        dep_castRange: d.castRange || 0,
        dep_projectileSpeed: d.projectileSpeed || 0,
        dep_projectileMaxDistance: d.projectileMaxDistance || 0,
        dep_bounces: d.bounces || 0,
        dep_steerable: d.steerable || false,
        dep_traversesWalls: d.traversesWalls || false,
        dep_maxAmmo: d.maxAmmo || 0,
        dep_directionalOnly: d.directionalOnly || false,
        dep_geom_type: d.geometry?.type || "none",
        dep_geom_radius: d.geometry?.radius || 0,
        dep_geom_width: d.geometry?.width || 0,
        dep_geom_length: d.geometry?.length || 0,
        dep_effects: d.sweepEffects || {},

        // Lifetime
        life_duration: l.duration || 0,
        life_hp: l.hp || 0,
        life_behavior: l.behavior || "static",
        life_activationRadius: l.activationRadius || 0,
        life_movementSpeed: l.movementSpeed || 0,
        life_geom_type: l.geometry?.type || "none",
        life_geom_radius: l.geometry?.radius || 0,
        life_geom_width: l.geometry?.width || 0,
        life_geom_length: l.geometry?.length || 0,
        life_effects: l.activeEffects || {},

        // Resolution
        hasResolution: !!r.trigger,
        res_trigger: r.trigger || "on_impact",
        res_geom_type: r.geometry?.type || "none",
        res_geom_radius: r.geometry?.radius || 0,
        res_geom_width: r.geometry?.width || 0,
        res_geom_length: r.geometry?.length || 0,
        res_effects: r.terminalEffects || {}
      });
    } else {
      setFormData(getDefaultFormData());
    }
  };

  const saveSkillMutation = useMutation({
    mutationFn: async (updatedSkill: Omit<AgentSkill, "id">) => {
      const payload = {
        agentId: selectedAgent!.id,
        skills: [updatedSkill]
      };
      
      const res = await fetch("/api/admin/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAgents"] });
      alert("¡Habilidad guardada!");
    },
    onError: (err: any) => {
      alert("Error: " + err.message);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    const depPayload: any = {
      type: formData.dep_type,
      windup: formData.dep_windup || undefined
    };
    if (formData.dep_castRange) depPayload.castRange = formData.dep_castRange;
    if (formData.dep_projectileSpeed) depPayload.projectileSpeed = formData.dep_projectileSpeed;
    if (formData.dep_projectileMaxDistance) depPayload.projectileMaxDistance = formData.dep_projectileMaxDistance;
    if (formData.dep_bounces) depPayload.bounces = formData.dep_bounces;
    if (formData.dep_steerable) depPayload.steerable = formData.dep_steerable;
    if (formData.dep_traversesWalls) depPayload.traversesWalls = formData.dep_traversesWalls;
    if (formData.dep_maxAmmo) depPayload.maxAmmo = formData.dep_maxAmmo;
    if (formData.dep_directionalOnly) depPayload.directionalOnly = formData.dep_directionalOnly;
    if (formData.dep_geom_type !== "none") {
      depPayload.geometry = formData.dep_geom_type === "circle"
        ? { type: "circle", radius: formData.dep_geom_radius }
        : { type: "rectangle", width: formData.dep_geom_width, length: formData.dep_geom_length };
    }

    const lifetimePayload: any = {
      duration: formData.life_duration || undefined,
      behavior: formData.life_behavior || undefined
    };
    if (formData.life_hp) lifetimePayload.destructible = { hp: formData.life_hp };
    if (formData.life_behavior === "autonomous") {
      lifetimePayload.autonomous = {
        activationRadius: formData.life_activationRadius || undefined,
        movementSpeed: formData.life_movementSpeed || undefined
      };
    }
    if (formData.life_geom_type !== "none") {
      lifetimePayload.geometry = formData.life_geom_type === "circle"
        ? { type: "circle", radius: formData.life_geom_radius }
        : { type: "rectangle", width: formData.life_geom_width, length: formData.life_geom_length };
    }

    const payload: Omit<AgentSkill, "id"> = {
      agentId: selectedAgent.id,
      key: editingSkillKey,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      color: formData.color,
      displayIcon: formData.displayIcon,
      enabled: formData.enabled,

      economy: {
        costCredits: formData.costCredits,
        costUltPoints: formData.costUltPoints,
        costNote: formData.costNote,
        usesPerRound: formData.usesPerRound,
        rechargeCondition: formData.rechargeCondition
      },

      deployment: depPayload as any,
      lifetime: lifetimePayload,

      resolution: formData.hasResolution ? {
        trigger: formData.res_trigger as any,
        geometry: formData.res_geom_type !== "none" ? (
          formData.res_geom_type === "circle"
            ? { type: "circle" as const, radius: formData.res_geom_radius }
            : { type: "rectangle" as const, width: formData.res_geom_width, length: formData.res_geom_length }
        ) : undefined,
        effects: formData.res_effects
      } : undefined
    };

    saveSkillMutation.mutate(payload as any);
  };

`;

content = content.substring(0, loadStart) + newMethods + content.substring(loadEnd);

// 4. Replace Form Contents
const formStart = content.indexOf('<form onSubmit={handleSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: 24, borderRadius: 16 }}>');
const formEnd = content.indexOf('</form>', formStart) + '</form>'.length;

const newForm = `<form onSubmit={handleSubmit}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                    <button type="button" onClick={() => setActiveTab("general")} className={\`btn \${activeTab === "general" ? "btn-primary" : "btn-secondary"}\`}>General</button>
                    <button type="button" onClick={() => setActiveTab("deployment")} className={\`btn \${activeTab === "deployment" ? "btn-primary" : "btn-secondary"}\`}>1. Despliegue</button>
                    <button type="button" onClick={() => setActiveTab("lifetime")} className={\`btn \${activeTab === "lifetime" ? "btn-primary" : "btn-secondary"}\`}>2. Vida Activa</button>
                    <button type="button" onClick={() => setActiveTab("resolution")} className={\`btn \${activeTab === "resolution" ? "btn-primary" : "btn-secondary"}\`}>3. Resolución</button>
                  </div>

                  {activeTab === "general" && (
                    <div className="tab-content fade-in">
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Nombre</label>
                          <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tipo</label>
                          <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                            <option value="Basic">Básica</option>
                            <option value="Signature">Firma (Signature)</option>
                            <option value="Ultimate">Ultimate</option>
                            <option value="Passive">Pasiva</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>Descripción</label>
                        <textarea className="input-field" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                        <img src={formData.displayIcon} style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(0,0,0,0.5)" }} alt="icon" />
                        <button type="button" onClick={handleFetchIcon} className="btn btn-secondary">Icono Automático</button>
                      </div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Coste (Créditos)</label>
                          <input type="number" className="input-field" value={formData.costCredits} onChange={e => setFormData({...formData, costCredits: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Coste (Orbes de Ulti)</label>
                          <input type="number" className="input-field" value={formData.costUltPoints} onChange={e => setFormData({...formData, costUltPoints: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Usos por ronda</label>
                          <input type="number" className="input-field" value={formData.usesPerRound} onChange={e => setFormData({...formData, usesPerRound: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "deployment" && (
                    <div className="tab-content fade-in">
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 16 }}>Define cómo la habilidad entra y viaja por el mundo.</p>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tipo de Despliegue</label>
                          <select className="input-field" value={formData.dep_type} onChange={e => setFormData({...formData, dep_type: e.target.value as any})}>
                            <option value="self_instant">Instantáneo (Self / Aura)</option>
                            <option value="projectile_terminal_aoe">Proyectil (Termina en AoE)</option>
                            <option value="projectile_sweeping">Proyectil (Pasa a través)</option>
                            <option value="map_target_aoe">Selección en Mapa (Click to place)</option>
                            <option value="linear_wall">Muro Lineal</option>
                            <option value="two_point_barrier">Barrera de 2 Puntos</option>
                            <option value="static_deployable">Desplegable Estático (Trampa/Torreta)</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tiempo de Carga / Windup (seg)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.dep_windup} onChange={e => setFormData({...formData, dep_windup: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Rango de Cast (metros)</label>
                          <input type="number" className="input-field" value={formData.dep_castRange} onChange={e => setFormData({...formData, dep_castRange: Number(e.target.value)})} />
                        </div>
                      </div>
                      
                      {(formData.dep_type.includes("projectile")) && (
                        <div style={{ background: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                          <div className="form-row" style={{ display: "flex", gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Velocidad Proyectil</label>
                              <input type="number" className="input-field" value={formData.dep_projectileSpeed} onChange={e => setFormData({...formData, dep_projectileSpeed: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Distancia Máxima (Fusible)</label>
                              <input type="number" className="input-field" value={formData.dep_projectileMaxDistance} onChange={e => setFormData({...formData, dep_projectileMaxDistance: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Rebotes Permitidos</label>
                              <input type="number" className="input-field" value={formData.dep_bounces} onChange={e => setFormData({...formData, dep_bounces: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <p style={{ color: "var(--val-cyan)", fontSize: 14 }}>Geometría del Despliegue</p>
                        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                           <select className="input-field" value={formData.dep_geom_type} onChange={e => setFormData({...formData, dep_geom_type: e.target.value})}>
                             <option value="none">Ninguna</option>
                             <option value="circle">Círculo</option>
                             <option value="rectangle">Rectángulo</option>
                           </select>
                           {formData.dep_geom_type === "circle" && <input type="number" placeholder="Radio" className="input-field" value={formData.dep_geom_radius} onChange={e => setFormData({...formData, dep_geom_radius: Number(e.target.value)})} />}
                           {formData.dep_geom_type === "rectangle" && <>
                              <input type="number" placeholder="Ancho" className="input-field" value={formData.dep_geom_width} onChange={e => setFormData({...formData, dep_geom_width: Number(e.target.value)})} />
                              <input type="number" placeholder="Largo" className="input-field" value={formData.dep_geom_length} onChange={e => setFormData({...formData, dep_geom_length: Number(e.target.value)})} />
                           </>}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "lifetime" && (
                    <div className="tab-content fade-in">
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Duración (segundos)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.life_duration} onChange={e => setFormData({...formData, life_duration: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Puntos de Vida (0 si es invulnerable)</label>
                          <input type="number" className="input-field" value={formData.life_hp} onChange={e => setFormData({...formData, life_hp: Number(e.target.value)})} />
                        </div>
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>Comportamiento Físico/IA</label>
                        <select className="input-field" value={formData.life_behavior} onChange={e => setFormData({...formData, life_behavior: e.target.value as any})}>
                          <option value="static">Estático (Se queda donde se planta)</option>
                          <option value="autonomous">IA Autónoma (Persigue o Detecta enemigos)</option>
                          <option value="mobile_aura">Aura Móvil (Se mueve con el jugador)</option>
                        </select>
                      </div>
                      
                      {formData.life_behavior === "autonomous" && (
                        <div style={{ background: "rgba(59,130,246,0.1)", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid rgba(59,130,246,0.3)" }}>
                          <div className="form-row" style={{ display: "flex", gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "#00d4aa" }}>Radio de Detección</label>
                              <input type="number" className="input-field" value={formData.life_activationRadius} onChange={e => setFormData({...formData, life_activationRadius: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "#00d4aa" }}>Velocidad de Movimiento</label>
                              <input type="number" className="input-field" value={formData.life_movementSpeed} onChange={e => setFormData({...formData, life_movementSpeed: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <p style={{ color: "var(--val-cyan)", fontSize: 14 }}>Geometría del Área Activa</p>
                        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                           <select className="input-field" value={formData.life_geom_type} onChange={e => setFormData({...formData, life_geom_type: e.target.value})}>
                             <option value="none">Ninguna</option>
                             <option value="circle">Círculo</option>
                             <option value="rectangle">Rectángulo</option>
                           </select>
                           {formData.life_geom_type === "circle" && <input type="number" placeholder="Radio" className="input-field" value={formData.life_geom_radius} onChange={e => setFormData({...formData, life_geom_radius: Number(e.target.value)})} />}
                           {formData.life_geom_type === "rectangle" && <>
                              <input type="number" placeholder="Ancho" className="input-field" value={formData.life_geom_width} onChange={e => setFormData({...formData, life_geom_width: Number(e.target.value)})} />
                              <input type="number" placeholder="Largo" className="input-field" value={formData.life_geom_length} onChange={e => setFormData({...formData, life_geom_length: Number(e.target.value)})} />
                           </>}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "resolution" && (
                    <div className="tab-content fade-in">
                      <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 16 }}>
                        <input type="checkbox" checked={formData.hasResolution} onChange={e => setFormData({...formData, hasResolution: e.target.checked})} />
                        <span className="checkbox-custom"></span>
                        <span style={{ fontWeight: 800 }}>Habilitar Fase de Resolución (Muerte/Explosión)</span>
                      </label>
                      
                      {formData.hasResolution && (
                        <div>
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12 }}>Trigger (Desencadenante)</label>
                            <select className="input-field" value={formData.res_trigger} onChange={e => setFormData({...formData, res_trigger: e.target.value as any})}>
                              <option value="on_impact">Al Impactar (Ej: Flecha Raze)</option>
                              <option value="on_timer">Por Tiempo (Ej: Flash Kayo)</option>
                              <option value="on_recast">Al Recastear (Ej: C4 Raze)</option>
                              <option value="on_death">Al morir entidad</option>
                            </select>
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <p style={{ color: "var(--val-cyan)", fontSize: 14 }}>Geometría del Impacto/Explosión</p>
                            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                               <select className="input-field" value={formData.res_geom_type} onChange={e => setFormData({...formData, res_geom_type: e.target.value})}>
                                 <option value="none">Ninguna</option>
                                 <option value="circle">Círculo</option>
                                 <option value="rectangle">Rectángulo</option>
                               </select>
                               {formData.res_geom_type === "circle" && <input type="number" placeholder="Radio" className="input-field" value={formData.res_geom_radius} onChange={e => setFormData({...formData, res_geom_radius: Number(e.target.value)})} />}
                               {formData.res_geom_type === "rectangle" && <>
                                  <input type="number" placeholder="Ancho" className="input-field" value={formData.res_geom_width} onChange={e => setFormData({...formData, res_geom_width: Number(e.target.value)})} />
                                  <input type="number" placeholder="Largo" className="input-field" value={formData.res_geom_length} onChange={e => setFormData({...formData, res_geom_length: Number(e.target.value)})} />
                               </>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 16, fontWeight: 900 }}>Guardar Habilidad</button>
                  </div>
                </form>`;

content = content.substring(0, formStart) + newForm + content.substring(formEnd);

// Fix the activeTab type
content = content.replace(
  'const [activeTab, setActiveTab] = useState<"general" | "mechanics" | "effects">("general");',
  'const [activeTab, setActiveTab] = useState<"general" | "deployment" | "lifetime" | "resolution">("general");'
);

fs.writeFileSync('src/components/AgentSkillsManager.tsx', content, 'utf8');
