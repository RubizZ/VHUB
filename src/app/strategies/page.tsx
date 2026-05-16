"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { getCompetitiveMaps, type ValorantMap } from "@/lib/maps";
import { AGENTS, getAgentsByRole, findAgentById, ROLE_COLORS, type ValorantAgent } from "@/lib/agents";
import { Skeleton } from "@/components/Skeleton";

interface Composition { id: number; map_id: string; name: string; description: string; agent_1: string; agent_2: string; agent_3: string; agent_4: string; agent_5: string; }
interface Strategy { id: number; composition_id: number; name: string; side: string; description: string; canvas_data: string; }
type Tool = "select" | "draw" | "arrow" | "eraser";
type View = "maps" | "compositions" | "strategies" | "editor";

const competitiveMaps = getCompetitiveMaps();

export default function StrategiesPage() {
  const [view, setView] = useState<View>("maps");
  const [selectedMap, setSelectedMap] = useState<ValorantMap | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Composition | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [selectedSide, setSelectedSide] = useState<"attack" | "defense">("attack");
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#FF4655");
  const [showNewComp, setShowNewComp] = useState(false);
  const [showNewStrat, setShowNewStrat] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [compAgents, setCompAgents] = useState<string[]>(["", "", "", "", ""]);
  const [compsLoading, setCompsLoading] = useState(false);
  const [stratsLoading, setStratsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const pathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[] }>>([]);
  const agentsRef = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const agentImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const loadComps = (mapId: string) => {
    setCompsLoading(true);
    return fetch(`/api/compositions?map_id=${mapId}`)
      .then(r => r.json())
      .then(d => {
        setCompositions(d.compositions || []);
        setCompsLoading(false);
      });
  };
  const loadStrats = (compId: number) => {
    setStratsLoading(true);
    return fetch(`/api/strategies?composition_id=${compId}`)
      .then(r => r.json())
      .then(d => {
        setStrategies(d.strategies || []);
        setStratsLoading(false);
      });
  };

  const goToMap = (map: ValorantMap) => { setSelectedMap(map); setView("compositions"); loadComps(map.id); };
  const goToComp = (comp: Composition) => { setSelectedComp(comp); setView("strategies"); loadStrats(comp.id); };
  const goBack = () => {
    if (view === "editor") { setCurrent(null); setView("strategies"); }
    else if (view === "strategies") { setSelectedComp(null); setView("compositions"); }
    else if (view === "compositions") { setSelectedMap(null); setView("maps"); }
  };

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
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { if (tool === "select") return; drawingRef.current = true; pathsRef.current.push({ tool, color, points: [getPos(e)] }); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!drawingRef.current || tool === "select") return; pathsRef.current[pathsRef.current.length - 1].points.push(getPos(e)); redraw(); };
  const stopDraw = () => { drawingRef.current = false; };

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
    try { const d = JSON.parse(s.canvas_data || "{}"); pathsRef.current = d.paths || []; agentsRef.current = d.agents || []; }
    catch { pathsRef.current = []; agentsRef.current = []; }
    setView("editor");
    setTimeout(() => { initCanvas(); redraw(); }, 150);
  };

  const saveStrategy = async () => {
    if (!current) return;
    await fetch("/api/strategies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id, name: current.name, side: selectedSide, description: current.description, canvas_data: { paths: pathsRef.current, agents: agentsRef.current } }) });
    if (selectedComp) loadStrats(selectedComp.id);
  };

  const createComp = async () => {
    if (!newName.trim() || !selectedMap || compAgents.some(a => !a)) return;
    await fetch("/api/compositions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ map_id: selectedMap.id, name: newName, description: newDesc, agent_1: compAgents[0], agent_2: compAgents[1], agent_3: compAgents[2], agent_4: compAgents[3], agent_5: compAgents[4] }) });
    setShowNewComp(false); setNewName(""); setNewDesc(""); setCompAgents(["", "", "", "", ""]);
    loadComps(selectedMap.id);
  };

  const createStrat = async () => {
    if (!newName.trim() || !selectedComp) return;
    const res = await fetch("/api/strategies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ composition_id: selectedComp.id, name: newName, side: selectedSide }) });
    const { id } = await res.json();
    setShowNewStrat(false); setNewName("");
    await loadStrats(selectedComp.id);
    openEditor({ id, composition_id: selectedComp.id, name: newName, side: selectedSide, description: "", canvas_data: "{}" });
  };

  const getAgentIcons = (comp: Composition) => [comp.agent_1, comp.agent_2, comp.agent_3, comp.agent_4, comp.agent_5].map(id => findAgentById(id)).filter(Boolean) as ValorantAgent[];

  const byRole = { duelist: getAgentsByRole("duelist"), initiator: getAgentsByRole("initiator"), controller: getAgentsByRole("controller"), sentinel: getAgentsByRole("sentinel") };
  const colors2 = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#FFFFFF", "#FFD700"];

  return (
    <div className="strategies-wrapper">
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Centro Táctico</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>
              {view === "maps" ? "Selecciona un mapa para ver sus estrategias" : 
               view === "compositions" ? `${selectedMap?.name} — Gestiona tus composiciones` : 
               view === "strategies" ? `${selectedComp?.name} — Biblioteca de tácticas` : 
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
          <div className="grid grid-4" style={{ gap: 20 }}>
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

        {view === "compositions" && (
          <div className="animate-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
               <h2 style={{ fontSize: 20, fontWeight: 700 }}>Composiciones Disponibles</h2>
               <button className="btn btn-primary" onClick={() => setShowNewComp(true)}>+ Crear Nueva</button>
            </div>
            <div className="grid grid-3" style={{ gap: 20 }}>
              {compsLoading ? (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="card glass-card">
                      <Skeleton width="60%" height={20} style={{ marginBottom: 16 }} />
                      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Skeleton key={j} width={36} height={36} circle />
                        ))}
                      </div>
                      <Skeleton width="100%" height={12} style={{ marginBottom: 4 }} />
                      <Skeleton width="80%" height={12} />
                    </div>
                  ))}
                </>
              ) : compositions.map(c => {
                const agents = getAgentIcons(c);
                return (
                  <div key={c.id} className="card glass-card hover-lift" style={{ cursor: "pointer" }} onClick={() => goToComp(c)}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{c.name}</h3>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                      {agents.map(a => (
                        <img key={a.id} src={a.displayIcon} alt={a.name} title={a.name} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[a.role] || '#fff'}`, background: "rgba(0,0,0,0.3)" }} />
                      ))}
                    </div>
                    {c.description && <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{c.description}</p>}
                  </div>
                );
              })}
              {!compsLoading && compositions.length === 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <EmptyState message={`No hay composiciones para ${selectedMap?.name}.`} />
                </div>
              )}
            </div>
          </div>
        )}

        {view === "strategies" && selectedComp && (
          <div className="animate-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
               <h2 style={{ fontSize: 20, fontWeight: 700 }}>Estrategias para {selectedComp.name}</h2>
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
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 800px" }}>
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
                  <button className="btn btn-primary btn-sm" onClick={saveStrategy}>💾 Guardar Cambios</button>
                </div>
              </div>
              <div className="strategy-canvas-wrap glass-card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
            </div>
            <div style={{ flex: "0 0 240px" }}>
              <div className="card glass-card" style={{ position: "sticky", top: 80 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Agentes de Comp.</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {selectedComp && getAgentIcons(selectedComp).map(a => (
                    <button key={a.id} className="card hover-lift" onClick={() => dropAgent(a)} style={{ padding: 10, textAlign: "center", background: "rgba(255,255,255,0.02)", cursor: "pointer", border: "1px solid var(--border-color)" }}>
                      <img src={a.displayIcon} alt={a.name} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[a.role] || '#fff'}`, marginBottom: 4 }} />
                      <div style={{ fontSize: 10, fontWeight: 700 }}>{a.name.toUpperCase()}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showNewComp && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: "90%" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Nueva Composición — {selectedMap?.name}</h3>
            <div className="form-group" style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Nombre</label><input className="input-field" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Double Duelist Agro" autoFocus /></div>
            <div className="form-group" style={{ marginBottom: 16 }}><label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Descripción (opcional)</label><input className="input-field" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Notas sobre esta composición..." /></div>
            <h4 style={{ fontSize: 13, fontWeight: 800, marginTop: 20, marginBottom: 12, textTransform: "uppercase" }}>Selección de Agentes</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {compAgents.map((agentId, idx) => (
                <select key={idx} className="input-field" value={agentId} onChange={e => { const next = [...compAgents]; next[idx] = e.target.value; setCompAgents(next); }}>
                  <option value="">— Agente {idx + 1} —</option>
                  {AGENTS.map(a => <option key={a.id} value={a.id} disabled={compAgents.includes(a.id) && compAgents[idx] !== a.id}>{a.name} ({a.role})</option>)}
                </select>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewComp(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={createComp} disabled={compAgents.some(a => !a)}>Crear Composición</button>
            </div>
          </div>
        </div>
      )}

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
              <button className="btn btn-primary" onClick={createStrat}>Comenzar a Dibujar</button>
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
