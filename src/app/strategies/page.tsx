"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { getCompetitiveMaps, type ValorantMap } from "@/lib/maps";
import { AGENTS, getAgentsByRole, findAgentById, ROLE_COLORS, type ValorantAgent } from "@/lib/agents";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const pathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[] }>>([]);
  const agentsRef = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const agentImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Load compositions for a map
  const loadComps = (mapId: string) => fetch(`/api/compositions?map_id=${mapId}`).then(r => r.json()).then(d => setCompositions(d.compositions || []));
  // Load strategies for a composition
  const loadStrats = (compId: number) => fetch(`/api/strategies?composition_id=${compId}`).then(r => r.json()).then(d => setStrategies(d.strategies || []));

  // Navigate to map
  const goToMap = (map: ValorantMap) => { setSelectedMap(map); setView("compositions"); loadComps(map.id); };
  // Navigate to composition
  const goToComp = (comp: Composition) => { setSelectedComp(comp); setView("strategies"); loadStrats(comp.id); };
  // Navigate back
  const goBack = () => {
    if (view === "editor") { setCurrent(null); setView("strategies"); }
    else if (view === "strategies") { setSelectedComp(null); setView("compositions"); }
    else if (view === "compositions") { setSelectedMap(null); setView("maps"); }
  };

  // Preload map image
  useEffect(() => {
    if (!selectedMap?.displayIcon) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = selectedMap.displayIcon;
    img.onload = () => { mapImgRef.current = img; };
  }, [selectedMap]);

  // Canvas redraw with real minimap
  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw minimap
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
      // Fallback: map name
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.font = "bold 60px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((selectedMap?.name || "").toUpperCase(), canvas.width / 2, canvas.height / 2);
      ctx.textAlign = "start";
    }

    // Side indicator
    ctx.fillStyle = selectedSide === "attack" ? "rgba(255,70,85,0.15)" : "rgba(59,130,246,0.15)";
    ctx.fillRect(0, 0, 4, canvas.height);
    ctx.fillStyle = selectedSide === "attack" ? "#FF4655" : "#3B82F6";
    ctx.font = "bold 11px Outfit, sans-serif";
    ctx.fillText(selectedSide === "attack" ? "ATK" : "DEF", 10, 18);

    // Draw paths
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

    // Draw agents with real icons
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
    // Preload agent icon
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
    <>
      <div className="page-header">
        <h2>🗺️ Estrategias</h2>
        <p>{view === "maps" ? "Selecciona un mapa" : view === "compositions" ? `${selectedMap?.name} — Composiciones` : view === "strategies" ? `${selectedComp?.name} — Estrategias` : `Editando — ${current?.name}`}</p>
      </div>
      <div className="page-content animate-in">
        {view !== "maps" && (
          <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={goBack}>← Volver</button>
        )}

        {/* MAP GRID */}
        {view === "maps" && (
          <div className="grid grid-auto">
            {competitiveMaps.map(m => (
              <div key={m.id} className="card" style={{ cursor: "pointer", padding: 0, overflow: "hidden" }} onClick={() => goToMap(m)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.listViewIconTall} alt={m.name} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "12px 16px" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.tacticalDescription}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COMPOSITIONS LIST */}
        {view === "compositions" && (
          <>
            <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowNewComp(true)}>+ Nueva Composición</button>
            <div className="grid grid-auto">
              {compositions.map(c => {
                const agents = getAgentIcons(c);
                return (
                  <div key={c.id} className="card" style={{ cursor: "pointer" }} onClick={() => goToComp(c)}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{c.name}</h3>
                    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                      {agents.map(a => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={a.id} src={a.displayIcon} alt={a.name} title={a.name} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[a.role]}`, background: "#1a1a2e" }} />
                      ))}
                    </div>
                    {c.description && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{c.description}</p>}
                  </div>
                );
              })}
              {compositions.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay composiciones para {selectedMap?.name}. ¡Crea la primera!</p>}
            </div>
          </>
        )}

        {/* STRATEGIES LIST */}
        {view === "strategies" && selectedComp && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-primary" onClick={() => setShowNewStrat(true)}>+ Nueva Estrategia</button>
              <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                {getAgentIcons(selectedComp).map(a => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={a.id} src={a.displayIcon} alt={a.name} title={a.name} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${ROLE_COLORS[a.role]}` }} />
                ))}
              </div>
            </div>
            {(["attack", "defense"] as const).map(side => {
              const sideStrats = strategies.filter(s => s.side === side);
              if (sideStrats.length === 0) return null;
              return (
                <div key={side} style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: side === "attack" ? "#FF4655" : "#3B82F6", textTransform: "uppercase", marginBottom: 8 }}>
                    {side === "attack" ? "⚔️ Ataque" : "🛡️ Defensa"}
                  </h4>
                  <div className="grid grid-auto">
                    {sideStrats.map(s => (
                      <div key={s.id} className="card" style={{ cursor: "pointer" }} onClick={() => openEditor(s)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</h3>
                          <span className={`tag ${s.side === "attack" ? "tag-red" : "tag-blue"}`}>{s.side === "attack" ? "ATK" : "DEF"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {strategies.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay estrategias para esta composición. ¡Crea la primera!</p>}
          </>
        )}

        {/* STRATEGY EDITOR */}
        {view === "editor" && current && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 600px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className={`btn btn-sm ${selectedSide === "attack" ? "btn-primary" : "btn-ghost"}`} style={{ borderColor: selectedSide === "attack" ? "#FF4655" : undefined, background: selectedSide === "attack" ? "#FF465522" : undefined }} onClick={() => { setSelectedSide("attack"); setTimeout(redraw, 50); }}>⚔️ ATK</button>
                <button className={`btn btn-sm ${selectedSide === "defense" ? "btn-primary" : "btn-ghost"}`} style={{ borderColor: selectedSide === "defense" ? "#3B82F6" : undefined, background: selectedSide === "defense" ? "#3B82F622" : undefined }} onClick={() => { setSelectedSide("defense"); setTimeout(redraw, 50); }}>🛡️ DEF</button>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={saveStrategy}>💾 Guardar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { pathsRef.current.pop(); redraw(); }}>↩ Deshacer</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { pathsRef.current = []; agentsRef.current = []; redraw(); }}>🗑️</button>
                </div>
              </div>
              <div className="strategy-toolbar" style={{ marginBottom: 8 }}>
                {([["select", "👆"], ["draw", "✏️"], ["arrow", "➡️"], ["eraser", "🧹"]] as [Tool, string][]).map(([t, ic]) => (
                  <button key={t} className={`tool-btn ${tool === t ? "active" : ""}`} onClick={() => setTool(t)}>{ic}</button>
                ))}
                <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                {colors2.map(c => (<button key={c} className="tool-btn" style={{ background: color === c ? `${c}33` : "transparent", border: color === c ? `2px solid ${c}` : "1px solid transparent" }} onClick={() => setColor(c)}><div style={{ width: 14, height: 14, borderRadius: "50%", background: c }} /></button>))}
              </div>
              <div className="strategy-canvas-wrap">
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none", borderRadius: 8 }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div className="card" style={{ position: "sticky", top: 80 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agentes</h4>
                {Object.entries(byRole).map(([role, agents]) => (
                  <div key={role} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: ROLE_COLORS[role as keyof typeof ROLE_COLORS], fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{role}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                      {agents.map(a => (
                        <button key={a.id} className="tool-btn" title={a.name} onClick={() => dropAgent(a)} style={{ padding: 2, width: 32, height: 32 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.displayIcon} alt={a.name} style={{ width: 24, height: 24, borderRadius: "50%" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NEW COMPOSITION MODAL */}
        {showNewComp && (
          <div className="modal-overlay" onClick={() => setShowNewComp(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h3>Nueva Composición — {selectedMap?.name}</h3>
              <div className="form-group"><label>Nombre</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Double Duelist Agro" autoFocus /></div>
              <div className="form-group"><label>Descripción (opcional)</label><input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Notas sobre esta composición..." /></div>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>Agentes (5)</h4>
              {compAgents.map((agentId, idx) => (
                <div key={idx} className="form-group" style={{ marginBottom: 6 }}>
                  <select value={agentId} onChange={e => { const next = [...compAgents]; next[idx] = e.target.value; setCompAgents(next); }} style={{ padding: "6px 10px" }}>
                    <option value="">— Agente {idx + 1} —</option>
                    {AGENTS.map(a => <option key={a.id} value={a.id} disabled={compAgents.includes(a.id) && compAgents[idx] !== a.id}>{a.name} ({a.role})</option>)}
                  </select>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setShowNewComp(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={createComp} disabled={compAgents.some(a => !a)}>Crear</button>
              </div>
            </div>
          </div>
        )}

        {/* NEW STRATEGY MODAL */}
        {showNewStrat && (
          <div className="modal-overlay" onClick={() => setShowNewStrat(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Nueva Estrategia</h3>
              <div className="form-group"><label>Nombre</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: B Rush Fake A" autoFocus /></div>
              <div className="form-group"><label>Lado</label>
                <select value={selectedSide} onChange={e => setSelectedSide(e.target.value as "attack" | "defense")}>
                  <option value="attack">Atacante</option>
                  <option value="defense">Defensor</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowNewStrat(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={createStrat}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
