"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { MAPS, AGENTS, ROLE_COLORS } from "@/lib/maps";

interface Strategy { id: number; name: string; map: string; side: string; description: string; canvas_data: string; }
type Tool = "select" | "draw" | "arrow" | "eraser";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [selectedMap, setSelectedMap] = useState("ascent");
  const [selectedSide, setSelectedSide] = useState<"attack" | "defense">("attack");
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#FF4655");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const pathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[] }>>([]);
  const agentsRef = useRef<Array<{ id: string; icon: string; x: number; y: number; color: string }>>([]);

  const loadStrategies = () => fetch("/api/strategies").then(r => r.json()).then(d => setStrategies(d.strategies || []));
  useEffect(() => { loadStrategies(); }, []);

  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    // Map label
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "bold 60px Outfit";
    ctx.textAlign = "center";
    ctx.fillText((MAPS.find(m => m.id === selectedMap)?.name || "").toUpperCase(), canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.font = "bold 24px Outfit";
    ctx.fillText(selectedSide === "attack" ? "ATACANTE" : "DEFENSOR", canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = "start";
    // Paths
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
    // Agents on map
    for (const a of agentsRef.current) {
      ctx.beginPath(); ctx.fillStyle = a.color;
      ctx.arc(a.x, a.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "16px serif"; ctx.textAlign = "center";
      ctx.fillText(a.icon, a.x, a.y + 5);
    }
    ctx.textAlign = "start";
  }, [selectedMap, selectedSide]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = Math.max(500, canvas.parentElement.clientWidth * 0.6);
    ctxRef.current = canvas.getContext("2d");
    redraw();
  }, [redraw]);

  useEffect(() => { initCanvas(); window.addEventListener("resize", initCanvas); return () => window.removeEventListener("resize", initCanvas); }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { if (tool === "select") return; drawingRef.current = true; pathsRef.current.push({ tool, color, points: [getPos(e)] }); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!drawingRef.current || tool === "select") return; pathsRef.current[pathsRef.current.length - 1].points.push(getPos(e)); redraw(); };
  const stopDraw = () => { drawingRef.current = false; };

  const dropAgent = (a: typeof AGENTS[0]) => {
    const c = canvasRef.current; if (!c) return;
    agentsRef.current.push({ id: a.id, icon: a.icon, x: 100 + Math.random() * (c.width - 200), y: 100 + Math.random() * (c.height - 200), color: a.color });
    redraw();
  };

  const saveStrategy = async () => {
    if (!current) return;
    await fetch("/api/strategies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...current, canvas_data: JSON.stringify({ paths: pathsRef.current, agents: agentsRef.current }) }) });
    loadStrategies();
  };

  const createStrategy = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/strategies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, map: selectedMap, side: selectedSide }) });
    const { id } = await res.json();
    setShowNew(false); setNewName(""); pathsRef.current = []; agentsRef.current = [];
    await loadStrategies();
    setCurrent({ id, name: newName, map: selectedMap, side: selectedSide, description: "", canvas_data: "{}" });
    setTimeout(redraw, 100);
  };

  const loadStrategy = (s: Strategy) => {
    setCurrent(s); setSelectedMap(s.map); setSelectedSide(s.side as "attack" | "defense");
    try { const d = JSON.parse(s.canvas_data); pathsRef.current = d.paths || []; agentsRef.current = d.agents || []; } catch { pathsRef.current = []; agentsRef.current = []; }
    setTimeout(redraw, 100);
  };

  const colors2 = ["#FF4655", "#00D4AA", "#A855F7", "#3B82F6", "#F59E0B", "#FF6B35", "#FFFFFF", "#FFD700"];
  const competitiveMaps = MAPS.filter(m => m.competitive);
  const byRole = { duelist: AGENTS.filter(a => a.role === "duelist"), initiator: AGENTS.filter(a => a.role === "initiator"), controller: AGENTS.filter(a => a.role === "controller"), sentinel: AGENTS.filter(a => a.role === "sentinel") };

  return (
    <>
      <div className="page-header"><h2>🗺️ Estrategias</h2><p>Planifica tácticas para cada mapa</p></div>
      <div className="page-content animate-in">
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nueva Estrategia</button>
          {current && <button className="btn btn-secondary" onClick={saveStrategy}>💾 Guardar</button>}
          {current && <button className="btn btn-ghost" onClick={() => { pathsRef.current.pop(); redraw(); }}>↩ Deshacer</button>}
          {current && <button className="btn btn-ghost" onClick={() => { pathsRef.current = []; agentsRef.current = []; redraw(); }}>🗑️ Limpiar</button>}
        </div>

        {!current && (
          <div className="grid grid-auto">
            {strategies.map(s => (
              <div key={s.id} className="card" style={{ cursor: "pointer" }} onClick={() => loadStrategy(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</h3>
                  <span className={`tag ${s.side === "attack" ? "tag-red" : "tag-blue"}`}>{s.side === "attack" ? "ATK" : "DEF"}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{MAPS.find(m => m.id === s.map)?.name || s.map}</div>
              </div>
            ))}
            {strategies.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay estrategias aún. ¡Crea la primera!</p>}
          </div>
        )}

        {current && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 600px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {competitiveMaps.map(m => (<button key={m.id} className={`btn btn-sm ${selectedMap === m.id ? "btn-primary" : "btn-ghost"}`} onClick={() => { setSelectedMap(m.id); setTimeout(redraw, 50); }}>{m.name}</button>))}
                <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                <button className={`btn btn-sm ${selectedSide === "attack" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setSelectedSide("attack"); setTimeout(redraw, 50); }}>ATK</button>
                <button className={`btn btn-sm ${selectedSide === "defense" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setSelectedSide("defense"); setTimeout(redraw, 50); }}>DEF</button>
              </div>
              <div className="strategy-toolbar" style={{ marginBottom: 8 }}>
                {([["select", "👆"], ["draw", "✏️"], ["arrow", "➡️"], ["eraser", "🧹"]] as [Tool, string][]).map(([t, ic]) => (
                  <button key={t} className={`tool-btn ${tool === t ? "active" : ""}`} onClick={() => setTool(t)}>{ic}</button>
                ))}
                <div style={{ width: 1, background: "var(--border-color)", margin: "0 4px" }} />
                {colors2.map(c => (<button key={c} className="tool-btn" style={{ background: color === c ? `${c}33` : "transparent", border: color === c ? `2px solid ${c}` : "1px solid transparent" }} onClick={() => setColor(c)}><div style={{ width: 14, height: 14, borderRadius: "50%", background: c }} /></button>))}
              </div>
              <div className="strategy-canvas-wrap">
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
            </div>
            <div style={{ flex: "0 0 200px" }}>
              <div className="card" style={{ position: "sticky", top: 80 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agentes</h4>
                {Object.entries(byRole).map(([role, agents]) => (
                  <div key={role} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: ROLE_COLORS[role], fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{role}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                      {agents.map(a => (<button key={a.id} className="tool-btn" title={a.name} onClick={() => dropAgent(a)} style={{ fontSize: 14, width: 32, height: 32 }}>{a.icon}</button>))}
                    </div>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setCurrent(null)}>← Volver</button>
              </div>
            </div>
          </div>
        )}

        {showNew && (
          <div className="modal-overlay" onClick={() => setShowNew(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Nueva Estrategia</h3>
              <div className="form-group"><label>Nombre</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Split B Rush" autoFocus /></div>
              <div className="form-group"><label>Mapa</label><select value={selectedMap} onChange={e => setSelectedMap(e.target.value)}>{competitiveMaps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div className="form-group"><label>Lado</label><select value={selectedSide} onChange={e => setSelectedSide(e.target.value as "attack" | "defense")}><option value="attack">Atacante</option><option value="defense">Defensor</option></select></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={createStrategy}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
