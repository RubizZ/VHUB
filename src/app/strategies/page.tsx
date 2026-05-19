/* eslint-disable no-undef */
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getCompetitiveMaps, type ValorantMap } from "@/lib/maps";
import { getAgentsByRole, findAgentById, ROLE_COLORS, type ValorantAgent, type AgentRole } from "@/lib/agents";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Strategy { 
  id: number; 
  map_id: string; 
  name: string; 
  side: string; 
  description: string; 
  canvas_data: unknown; 
}

type Tool = "select" | "draw" | "arrow" | "eraser";
type View = "maps" | "strategies" | "editor";

const competitiveMaps = getCompetitiveMaps();

export default function StrategiesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("maps");
  const [selectedMap, setSelectedMap] = useState<ValorantMap | null>(null);
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [selectedSide, setSelectedSide] = useState<"attack" | "defense">("attack");
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#FF4655");
  const [showNewStrat, setShowNewStrat] = useState(false);
  const [newName, setNewName] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const draggedAgentRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const pathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[] }>>([]);
  const agentsRef = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const agentImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // 1. Query Strategies
  const {
    data: strategiesData,
    isLoading: strategiesLoading
  } = useQuery<{ strategies: Strategy[] }>({
    queryKey: ["strategies", selectedMap?.id],
    queryFn: async () => {
      if (!selectedMap) return { strategies: [] };
      const res = await fetch(`/api/strategies?map_id=${selectedMap.id}`);
      if (!res.ok) throw new Error("Error loading strategies");
      return res.json();
    },
    enabled: !!selectedMap,
  });

  const strategies = strategiesData?.strategies || [];
  const stratsLoading = strategiesLoading;

  const goToMap = (map: ValorantMap) => { 
    setSelectedMap(map); 
    setView("strategies"); 
  };

  const goBack = () => {
    if (view === "editor") { 
      setCurrent(null); 
      setView("strategies"); 
    } else if (view === "strategies") { 
      setSelectedMap(null); 
      setView("maps"); 
    }
  };

  useEffect(() => {
    const mapParam = searchParams.get("map");
    if (mapParam) {
      const foundMap = competitiveMaps.find(m => m.id.toLowerCase() === mapParam.toLowerCase() || m.name.toLowerCase() === mapParam.toLowerCase());
      if (foundMap) {
        goToMap(foundMap);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedMap?.displayIcon) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = selectedMap.displayIcon;
    img.onload = () => { mapImgRef.current = img; };
  }, [selectedMap]);

  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mapImg = mapImgRef.current;
    if (mapImg && mapImg.complete) {
      const scale = Math.min(canvas.width / mapImg.width, canvas.height / mapImg.height);
      const w = mapImg.width * scale;
      const h = mapImg.height * scale;
      const ox = (canvas.width - w) / 2;
      const oy = (canvas.height - h) / 2;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mapImg, ox, oy, w, h);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.font = "bold 60px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((selectedMap?.name || "").toUpperCase(), canvas.width / 2, canvas.height / 2);
      ctx.textAlign = "start";
    }

    ctx.fillStyle = selectedSide === "attack" ? "rgba(255,70,85,0.15)" : "rgba(59,130,246,0.15)";
    ctx.fillRect(0, 0, 4, canvas.height);
    ctx.fillStyle = selectedSide === "attack" ? "#FF4655" : "#3B82F6";
    ctx.font = "bold 11px Outfit, sans-serif";
    ctx.fillText(selectedSide === "attack" ? "ATK" : "DEF", 10, 18);

    for (const path of pathsRef.current) {
      if (path.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.tool === "eraser" ? 20 : 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (path.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      if (path.tool === "arrow" && path.points.length >= 2) {
        const last = path.points[path.points.length - 1];
        const prev = path.points[path.points.length - 2];
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        ctx.beginPath(); ctx.fillStyle = path.color;
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x - 15 * Math.cos(angle - 0.4), last.y - 15 * Math.sin(angle - 0.4));
        ctx.lineTo(last.x - 15 * Math.cos(angle + 0.4), last.y - 15 * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
      }
    }

    for (const a of agentsRef.current) {
      const img = agentImgsRef.current.get(a.id);
      const agent = findAgentById(a.id);
      if (img && img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(a.x, a.y, 18, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, a.x - 18, a.y - 18, 36, 36);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(a.x, a.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = ROLE_COLORS[agent?.role || "duelist"];
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = ROLE_COLORS[agent?.role || "duelist"];
        ctx.arc(a.x, a.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "10px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(agent?.name.substring(0, 2) || "?", a.x, a.y + 4);
        ctx.textAlign = "start";
      }
    }
  }, [selectedMap, selectedSide]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = Math.max(500, canvas.parentElement.clientWidth * 0.6);
    ctxRef.current = canvas.getContext("2d");
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (view !== "editor") return;
    initCanvas();
    window.addEventListener("resize", initCanvas);
    return () => window.removeEventListener("resize", initCanvas);
  }, [initCanvas, view]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { 
    const pos = getPos(e);
    if (tool === "select") {
      // Find if we clicked close to an agent (within 18px radius)
      const found = [...agentsRef.current].reverse().find(a => {
        const dx = a.x - pos.x;
        const dy = a.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= 18;
      });
      if (found) {
        draggedAgentRef.current = found;
      }
      return;
    }
    if (tool === "eraser") {
      // Check if we click close to an agent (within 18px radius) and remove it
      const agentIndex = agentsRef.current.findIndex(a => {
        const dx = a.x - pos.x;
        const dy = a.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= 18;
      });
      if (agentIndex !== -1) {
        agentsRef.current.splice(agentIndex, 1);
        redraw();
        return;
      }
    }
    drawingRef.current = true; 
    pathsRef.current.push({ tool, color, points: [pos] }); 
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => { 
    const pos = getPos(e);
    if (tool === "select") {
      if (draggedAgentRef.current) {
        draggedAgentRef.current.x = pos.x;
        draggedAgentRef.current.y = pos.y;
        redraw();
      }
      return;
    }
    if (!drawingRef.current) return; 
    pathsRef.current[pathsRef.current.length - 1].points.push(pos); 
    redraw(); 
  };

  const stopDraw = () => { 
    drawingRef.current = false; 
    draggedAgentRef.current = null;
  };

  const dropAgent = (a: ValorantAgent) => {
    const c = canvasRef.current; if (!c) return;
    if (!agentImgsRef.current.has(a.id)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = a.displayIcon;
      img.onload = () => { agentImgsRef.current.set(a.id, img); redraw(); };
      agentImgsRef.current.set(a.id, img);
    }
    agentsRef.current.push({ id: a.id, x: 100 + Math.random() * (c.width - 200), y: 100 + Math.random() * (c.height - 200) });
    redraw();
  };

  const openEditor = (s: Strategy) => {
    setCurrent(s);
    setSelectedSide(s.side as "attack" | "defense");
    try { 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (typeof s.canvas_data === "string" ? JSON.parse(s.canvas_data || "{}") : s.canvas_data || {}) as any; 
      pathsRef.current = d.paths || []; 
      agentsRef.current = d.agents || []; 
      
      // Pre-load agent images
      for (const a of agentsRef.current) {
        if (!agentImgsRef.current.has(a.id)) {
          const agent = findAgentById(a.id);
          if (agent) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = agent.displayIcon;
            img.onload = () => {
              agentImgsRef.current.set(a.id, img);
              redraw();
            };
            agentImgsRef.current.set(a.id, img);
          }
        }
      }
    } catch { 
      pathsRef.current = []; 
      agentsRef.current = []; 
    }
    setView("editor");
    setTimeout(() => { initCanvas(); redraw(); }, 150);
  };

  // 2. Save Strategy Canvas Mutation
  const saveStrategyMutation = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const res = await fetch("/api/strategies", { 
        method: "PUT", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          id: current.id, 
          name: current.name, 
          side: selectedSide, 
          description: current.description, 
          canvas_data: { paths: pathsRef.current, agents: agentsRef.current } 
        }) 
      });
      if (!res.ok) throw new Error("Error saving strategy canvas");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
    }
  });

  const saveStrategy = () => {
    saveStrategyMutation.mutate();
  };

  // 3. Create Strategy Mutation
  const createStratMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim() || !selectedMap) {
        throw new Error("Nombre inválido o sin mapa seleccionado");
      }
      const res = await fetch("/api/strategies", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ map_id: selectedMap.id, name: newName, side: selectedSide }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear estrategia");
      return { id: data.id, map_id: selectedMap.id, name: newName, side: selectedSide };
    },
    onSuccess: (data) => {
      if (!data) return;
      setShowNewStrat(false); 
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
      openEditor({ id: data.id, map_id: data.map_id, name: data.name, side: data.side, description: "", canvas_data: "{}" });
    }
  });

  const createStrat = () => {
    createStratMutation.mutate();
  };

  const colors2 = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#FFFFFF", "#FFD700"];

  return (
    <div className="strategies-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Centro Táctico</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>
              {view === "maps" ? "Selecciona un mapa para ver sus estrategias" : 
               view === "strategies" ? `${selectedMap?.name} — Biblioteca de tácticas` : 
               `Editor Táctico — ${current?.name}`}
            </p>
          </div>
          {view !== "maps" && (
            <button className="btn btn-ghost" onClick={goBack}>
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
               Volver
            </button>
          )}
        </div>
      </div>

      <div className="page-content animate-in" style={{ paddingTop: 0 }}>
        
        {view === "maps" && (
          <div className="grid grid-auto" style={{ gap: 20 }}>
            {competitiveMaps.map(m => (
              <div key={m.id} className="card glass-card hover-lift" style={{ cursor: "pointer", padding: 0, overflow: "hidden" }} onClick={() => goToMap(m)}>
                <div style={{ position: "relative", height: 240 }}>
                  <img src={m.listViewIconTall} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,15,1) 0%, transparent 60%)" }} />
                  <div style={{ position: "absolute", bottom: 20, left: 20 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{m.name}</h3>
                    <span style={{ fontSize: 11, color: "var(--val-red)", fontWeight: 800, letterSpacing: 2 }}>{m.tacticalDescription?.toUpperCase() || 'COMPETITIVO'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "strategies" && selectedMap && (
          <div className="animate-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
               <h2 style={{ fontSize: 20, fontWeight: 700 }}>Estrategias para {selectedMap.name}</h2>
               <button className="btn btn-primary" onClick={() => setShowNewStrat(true)}>+ Nueva Táctica</button>
            </div>
            {stratsLoading ? (
              <div className="grid grid-3" style={{ gap: 20 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card glass-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Skeleton width="70%" height={16} />
                      <Skeleton width={30} height={12} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (["attack", "defense"] as const).map(side => {
                const sideStrats = strategies.filter(s => s.side === side);
                if (sideStrats.length === 0) return null;
                return (
                  <div key={side} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 16, background: side === "attack" ? "var(--val-red)" : "var(--val-cyan)", borderRadius: 2 }} />
                      <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                        {side === "attack" ? "Misiones de Ataque" : "Estrategias Defensivas"}
                      </h4>
                    </div>
                    <div className="grid grid-3" style={{ gap: 20 }}>
                      {sideStrats.map(s => (
                        <div key={s.id} className="card glass-card hover-lift" style={{ cursor: "pointer" }} onClick={() => openEditor(s)}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</h3>
                            <span style={{ fontSize: 11, fontWeight: 800, color: s.side === "attack" ? "var(--val-red)" : "var(--val-cyan)" }}>
                              {s.side === "attack" ? "ATK" : "DEF"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            {!stratsLoading && strategies.length === 0 && <EmptyState message="Aún no hay estrategias creadas." />}
          </div>
        )}

        {view === "editor" && current && (
          <div className="strategy-editor-layout" style={{ display: "flex", flexWrap: "wrap", gap: 24, minHeight: 0, flex: 1 }}>
            <div style={{ flex: "1 1 500px", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
              <div className="card glass-card" style={{ padding: 12, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div className="glass-card" style={{ display: "flex", padding: 4, borderRadius: 8 }}>
                   <button className={`btn btn-sm ${selectedSide === "attack" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setSelectedSide("attack"); setTimeout(redraw, 50); }}>⚔️ Atacante</button>
                   <button className={`btn btn-sm ${selectedSide === "defense" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setSelectedSide("defense"); setTimeout(redraw, 50); }}>🛡️ Defensor</button>
                </div>
                <div style={{ width: 1, height: 24, background: "var(--border-color)" }} />
                <div className="strategy-toolbar" style={{ border: "none", padding: 0, display: "flex", gap: 4 }}>
                  {([["select", "👆"], ["draw", "✏️"], ["arrow", "➡️"], ["eraser", "🧹"]] as [Tool, string][]).map(([t, ic]) => (
                    <button key={t} className={`tool-btn ${tool === t ? "active" : ""}`} onClick={() => setTool(t)} style={{ background: tool === t ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, width: 36, height: 36, cursor: "pointer" }}>{ic}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                   {colors2.map(c => (<button key={c} className="tool-btn" style={{ background: color === c ? `${c}33` : "transparent", border: color === c ? `2px solid ${c}` : "1px solid transparent", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setColor(c)}><div style={{ width: 14, height: 14, borderRadius: "50%", background: c }} /></button>))}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { pathsRef.current.pop(); redraw(); }}>↩ Deshacer</button>
                  <button className="btn btn-primary btn-sm" onClick={saveStrategy} disabled={saveStrategyMutation.isPending}>
                    {saveStrategyMutation.isPending ? "Guardando..." : "💾 Guardar Cambios"}
                  </button>
                </div>
              </div>
              <div className="strategy-canvas-wrap glass-card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
            </div>
            <div className="strategy-editor-sidebar" style={{ flex: "0 0 240px", width: "100%" }}>
              <div className="card glass-card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Agentes</h4>
                {(['duelist', 'initiator', 'controller', 'sentinel'] as AgentRole[]).map(role => {
                  const roleAgents = getAgentsByRole(role);
                  return (
                    <div key={role} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: ROLE_COLORS[role], marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>{role === 'duelist' ? '⚔️' : role === 'initiator' ? '🎯' : role === 'controller' ? '🌌' : '🛡️'}</span>
                        <span>{role}s</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
                        {roleAgents.map(a => (
                          <button key={a.id} className="card hover-lift" onClick={() => dropAgent(a)} style={{ padding: '6px 4px', textAlign: "center", background: "rgba(255,255,255,0.02)", cursor: "pointer", border: "1px solid var(--border-color)", borderRadius: 8 }}>
                            <img src={a.displayIcon} alt={a.name} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[a.role] || '#fff'}`, marginBottom: 2, marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                            <div style={{ fontSize: 9, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name.toUpperCase()}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {showNewStrat && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: "90%" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Nueva Estrategia</h3>
            <div className="form-group" style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Nombre</label><input className="input-field" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: B Rush Fake A" autoFocus /></div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Lado Inicial</label>
              <select className="input-field" value={selectedSide} onChange={e => setSelectedSide(e.target.value as "attack" | "defense")}>
                <option value="attack">Atacante (⚔️)</option>
                <option value="defense">Defensor (🛡️)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowNewStrat(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createStrat} disabled={createStratMutation.isPending}>
                {createStratMutation.isPending ? "Creando..." : "Comenzar a Dibujar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}
