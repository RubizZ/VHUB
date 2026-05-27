"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AgentSkill {
  id: string;
  key: string;
  name: string;
  description: string | null;
  geometry: any;
  behavior: any;
  color: string | null;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  displayIcon: string;
  roleIcon: string;
  bgColors: string[];
  skills: AgentSkill[];
}

export default function AdminAgentsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editingSkillKey, setEditingSkillKey] = useState<string>("q");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "",
    geometryType: "circle",
    geometryRadius: 5,
    geometryWidth: 5,
    geometryLength: 5,
    geometryAngle: 90,
    behaviorSpawn: "player",
    behaviorBounces: 1,
    behaviorProjectileMode: "bounce",
    behaviorGroundRange: 10,
  });

  const {
    data: agentsData,
    isLoading,
  } = useQuery<{ agents: Agent[] }>({
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

  const handleOpenAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    loadSkillForm(agent, "q");
  };

  const loadSkillForm = (agent: Agent, key: string) => {
    setEditingSkillKey(key);
    const skill = agent.skills.find(s => s.key === key);
    if (skill) {
      setFormData({
        name: skill.name,
        description: skill.description || "",
        color: skill.color || "",
        geometryType: skill.geometry?.type || "circle",
        geometryRadius: skill.geometry?.radius || 5,
        geometryWidth: skill.geometry?.width || 5,
        geometryLength: skill.geometry?.length || 5,
        geometryAngle: skill.geometry?.angle || 90,
        behaviorSpawn: skill.behavior?.spawn || "player",
        behaviorBounces: skill.behavior?.bounces || 1,
        behaviorProjectileMode: skill.behavior?.projectileMode || "bounce",
        behaviorGroundRange: skill.behavior?.groundRange || 10,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "",
        geometryType: "circle",
        geometryRadius: 5,
        geometryWidth: 5,
        geometryLength: 5,
        geometryAngle: 90,
        behaviorSpawn: "player",
        behaviorBounces: 1,
        behaviorProjectileMode: "bounce",
        behaviorGroundRange: 10,
      });
    }
  };

  const saveSkillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) return;
      const payload = {
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
          spawn: formData.behaviorSpawn,
          bounces: formData.behaviorSpawn === "projectile" ? Number(formData.behaviorBounces) : undefined,
          projectileMode: formData.behaviorSpawn === "projectile" ? formData.behaviorProjectileMode : undefined,
          groundRange: formData.behaviorSpawn === "ground" ? Number(formData.behaviorGroundRange) : undefined,
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
                  
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Color Base (Hex) - opcional</label>
                    <input className="input-field" placeholder="#FF4655" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
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
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Comportamiento de Spawn</label>
                    <select className="input-field" value={formData.behaviorSpawn} onChange={e => setFormData({...formData, behaviorSpawn: e.target.value})}>
                      <option value="player">Sale de la posición del jugador</option>
                      <option value="wall">Se adhiere a las paredes (ej. Flash Breach)</option>
                      <option value="ground">Se coloca en el suelo libremente</option>
                      <option value="projectile">Proyectil con rebotes o parábola</option>
                    </select>
                  </div>

                  {formData.behaviorSpawn === "projectile" && (
                    <div className="form-group" style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rebotes Máx. (al tirarlo a pared)</label>
                      <input type="number" className="input-field" value={formData.behaviorBounces} onChange={e => setFormData({...formData, behaviorBounces: Number(e.target.value)})} />
                    </div>
                  )}

                  {formData.behaviorSpawn === "ground" && (
                    <div className="form-group" style={{ marginBottom: 24 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Rango máx. de colocación (m, 0 = infinito)</label>
                      <input type="number" className="input-field" value={formData.behaviorGroundRange} onChange={e => setFormData({...formData, behaviorGroundRange: Number(e.target.value)})} />
                    </div>
                  )}

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
