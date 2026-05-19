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
  const mousePosRef = useRef<{ canvasX: number; canvasY: number } | null>(null);

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


  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mapImg = mapImgRef.current;
    if (!(mapImg && mapImg.complete)) {
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

    const angle = selectedSide === "attack" ? Math.PI / 2 : -Math.PI / 2;

    let scale = 1;
    let imgW = 1000;
    let imgH = 1000;
    if (mapImg && mapImg.complete) {
      imgW = mapImg.width;
      imgH = mapImg.height;
      const rotatedW = imgH;
      const rotatedH = imgW;
      scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
    }

    // 1. Draw Map Image on main canvas
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    if (mapImg && mapImg.complete) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mapImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 2. Draw Paths on an offscreen canvas to prevent eraser from erasing the map
    const pathCanvas = document.createElement("canvas");
    pathCanvas.width = canvas.width;
    pathCanvas.height = canvas.height;
    const pCtx = pathCanvas.getContext("2d");
    if (pCtx) {
      pCtx.translate(canvas.width / 2, canvas.height / 2);
      pCtx.rotate(angle);
      pCtx.scale(scale, scale);

      for (const path of pathsRef.current) {
        if (path.points.length < 2) continue;
        pCtx.beginPath();
        pCtx.strokeStyle = path.color;
        pCtx.lineWidth = (path.tool === "eraser" ? 20 : 3) / scale;
        pCtx.lineCap = "round";
        pCtx.lineJoin = "round";
        if (path.tool === "eraser") {
          pCtx.globalCompositeOperation = "destination-out";
        } else {
          pCtx.globalCompositeOperation = "source-over";
        }
        pCtx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          pCtx.lineTo(path.points[i].x, path.points[i].y);
        }
        pCtx.stroke();
        
        pCtx.globalCompositeOperation = "source-over";
        if (path.tool === "arrow" && path.points.length >= 2) {
          const last = path.points[path.points.length - 1];
          const prev = path.points[path.points.length - 2];
          const arrowAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
          
          pCtx.save();
          pCtx.translate(last.x, last.y);
          pCtx.rotate(arrowAngle);
          pCtx.scale(1 / scale, 1 / scale);
          
          pCtx.beginPath(); pCtx.fillStyle = path.color;
          pCtx.moveTo(0, 0);
          pCtx.lineTo(-15, -6);
          pCtx.lineTo(-15, 6);
          pCtx.closePath(); pCtx.fill();
          pCtx.restore();
        }
      }
    }

    // Draw the processed paths onto the main canvas
    ctx.drawImage(pathCanvas, 0, 0);

    // 3. Draw Agents on main canvas
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    for (const a of agentsRef.current) {
      const img = agentImgsRef.current.get(a.id);
      const agent = findAgentById(a.id);
      
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(-angle);
      ctx.scale(1 / scale, 1 / scale);
      
      if (img && img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -18, -18, 36, 36);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.strokeStyle = ROLE_COLORS[agent?.role || "duelist"];
        ctx.lineWidth = draggedAgentRef.current === a ? 4 : 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = ROLE_COLORS[agent?.role || "duelist"];
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "10px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(agent?.name.substring(0, 2) || "?", 0, 4);
        ctx.textAlign = "start";
      }
      ctx.restore();
    }
    ctx.restore();

    // 4. Draw Custom Eraser Circle cursor in screen space
    if (tool === "eraser" && mousePosRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mousePosRef.current.canvasX, mousePosRef.current.canvasY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(mousePosRef.current.canvasX, mousePosRef.current.canvasY, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }, [selectedMap, selectedSide, tool]);

  useEffect(() => {
    if (!selectedMap?.displayIcon) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = selectedMap.displayIcon;
    img.onload = () => { 
      mapImgRef.current = img; 
      redraw();
    };
  }, [selectedMap, redraw]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    ctxRef.current = canvas.getContext("2d");
  }, []);

  useEffect(() => {
    if (view !== "editor") return;
    initCanvas();
    redraw();
    const handleResize = () => {
      initCanvas();
      redraw();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [view, initCanvas, redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let cx = 0;
    let cy = 0;
    if ("touches" in e) {
      if (e.touches.length > 0) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else if ("changedTouches" in e && e.changedTouches.length > 0) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      }
    } else {
      cx = (e as React.MouseEvent).clientX;
      cy = (e as React.MouseEvent).clientY;
    }
    
    const canvasX = cx - rect.left;
    const canvasY = cy - rect.top;
    
    const angle = selectedSide === "attack" ? Math.PI / 2 : -Math.PI / 2;
    const dx = canvasX - canvas.width / 2;
    const dy = canvasY - canvas.height / 2;
    
    const mapImg = mapImgRef.current;
    let scale = 1;
    if (mapImg && mapImg.complete) {
      const rotatedW = mapImg.height;
      const rotatedH = mapImg.width;
      scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
    }
    
    const mx = (dx * Math.cos(-angle) - dy * Math.sin(-angle)) / scale;
    const my = (dx * Math.sin(-angle) + dy * Math.cos(-angle)) / scale;
    
    return { x: mx, y: my };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { 
    const pos = getPos(e);
    
    const canvas = canvasRef.current;
    const mapImg = mapImgRef.current;
    let scale = 1;
    if (canvas && mapImg && mapImg.complete) {
      const rotatedW = mapImg.height;
      const rotatedH = mapImg.width;
      scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
    }

    if (tool === "select") {
      const found = [...agentsRef.current].reverse().find(a => {
        const dx = a.x - pos.x;
        const dy = a.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= (18 / scale);
      });
      if (found) {
        draggedAgentRef.current = found;
      }
      return;
    }
    if (tool === "eraser") {
      const agentIndex = agentsRef.current.findIndex(a => {
        const dx = a.x - pos.x;
        const dy = a.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= (18 / scale);
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

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      let cx = 0;
      let cy = 0;
      if ("touches" in e) {
        if (e.touches.length > 0) {
          cx = e.touches[0].clientX;
          cy = e.touches[0].clientY;
        } else if ("changedTouches" in e && e.changedTouches.length > 0) {
          cx = e.changedTouches[0].clientX;
          cy = e.changedTouches[0].clientY;
        }
      } else {
        cx = (e as React.MouseEvent).clientX;
        cy = (e as React.MouseEvent).clientY;
      }
      mousePosRef.current = { canvasX: cx - rect.left, canvasY: cy - rect.top };
    }

    if (tool === "select") {
      if (draggedAgentRef.current) {
        draggedAgentRef.current.x = pos.x;
        draggedAgentRef.current.y = pos.y;
        redraw();
      }
      return;
    }
    if (!drawingRef.current) {
      if (tool === "eraser") redraw();
      return;
    } 
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
    agentsRef.current.push({ id: a.id, x: -50 + Math.random() * 100, y: -50 + Math.random() * 100 });
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
    <div className="strategies-container-premium">
      <div className="header-premium">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 className="gradient-text-valorant" style={{ fontSize: 32, fontWeight: 900 }}>Centro Táctico</h1>
            <p style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
              {view === "maps" ? "Selecciona un mapa para ver sus estrategias" : 
               view === "strategies" ? `${selectedMap?.name.toUpperCase()} — Biblioteca de tácticas` : 
               `Editor Táctico — ${current?.name}`}
            </p>
          </div>
          {view !== "maps" && (
            <button className="btn-back-premium" onClick={goBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Volver
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} className="animate-in">
        
        {view === "maps" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            <div className="map-grid-premium">
              {competitiveMaps.map(m => (
                <div key={m.id} className="map-card-premium" onClick={() => goToMap(m)}>
                  <img src={m.listViewIconTall} alt={m.name} className="map-img-premium" />
                  <div className="map-card-overlay-premium">
                    <h3 className="map-card-title-premium">{m.name}</h3>
                    <span className="map-card-subtitle-premium">{m.tacticalDescription || 'Competitivo'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "strategies" && selectedMap && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16, flexShrink: 0 }}>
               <h2 style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Estrategias: {selectedMap.name}</h2>
               <button className="btn btn-primary" style={{ padding: "10px 20px", borderRadius: 12 }} onClick={() => setShowNewStrat(true)}>+ Nueva Táctica</button>
            </div>
            {strategiesLoading ? (
              <div className="strats-grid-premium">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card glass-card" style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="20%" height={12} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {(["attack", "defense"] as const).map(side => {
                  const sideStrats = strategies.filter(s => s.side === side);
                  if (sideStrats.length === 0) return null;
                  return (
                    <div key={side} style={{ marginBottom: 36, flexShrink: 0 }}>
                      <div className="strategy-group-title">
                        <div className="strategy-group-line" style={{ background: side === "attack" ? "#ff4655" : "#3b82f6" }} />
                        <h4 className="strategy-group-text">
                          {side === "attack" ? "Planes de Ataque (ATK)" : "Líneas de Defensa (DEF)"}
                        </h4>
                      </div>
                      <div className="strats-grid-premium">
                        {sideStrats.map(s => (
                          <div key={s.id} className={`strategy-card-premium ${s.side === "attack" ? "atk" : "def"}`} onClick={() => openEditor(s)}>
                            <h3 className="strategy-card-title-premium">{s.name}</h3>
                            <span className={`strategy-card-badge-premium ${s.side === "attack" ? "atk" : "def"}`}>
                              {s.side === "attack" ? "Atacante" : "Defensor"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!strategiesLoading && strategies.length === 0 && <EmptyState message="Aún no hay estrategias creadas para este mapa." />}
              </>
            )}
          </div>
        )}

        {view === "editor" && current && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 16 }}>
            
            <div className="toolbar-premium" style={{ flexShrink: 0 }}>
              {/* Pill side selector */}
              <div className="pill-toggle-premium">
                <button className={`pill-btn-premium atk ${selectedSide === "attack" ? "active" : ""}`} onClick={() => setSelectedSide("attack")}>
                  <span>⚔️</span> Atacante
                </button>
                <button className={`pill-btn-premium def ${selectedSide === "defense" ? "active" : ""}`} onClick={() => setSelectedSide("defense")}>
                  <span>🛡️</span> Defensor
                </button>
              </div>

              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />

              {/* Drawing tools group */}
              <div className="tool-group-premium">
                {([
                  ["select", (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4 4 7.07 16.93 3.03-7.07 7.07-3.03L4 4z" />
                      <path d="m13 13 6 6" />
                    </svg>
                  ), "Seleccionar"],
                  ["draw", (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  ), "Lápiz"],
                  ["arrow", (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  ), "Vector/Flecha"],
                  ["eraser", (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                      <path d="M22 21H7" />
                      <path d="m5 11 9 9" />
                    </svg>
                  ), "Borrar"]
                ] as [Tool, React.ReactNode, string][]).map(([t, icon, label]) => (
                  <button key={t} className={`tool-btn-premium ${tool === t ? "active" : ""}`} onClick={() => setTool(t)} title={label}>
                    {icon}
                  </button>
                ))}
              </div>

              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />

              {/* Color Palette orbs */}
              <div className="color-palette-premium">
                {colors2.map(c => (
                  <button key={c} className={`color-orb-premium ${color === c ? "active" : ""}`} style={{ background: c, "--orb-glow": c } as React.CSSProperties} onClick={() => setColor(c)}>
                    {color === c && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </button>
                ))}
              </div>

              {/* Right controls */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
                <button className="btn btn-ghost btn-sm" style={{ borderRadius: 10, display: "flex", alignItems: "center" }} onClick={() => { pathsRef.current.pop(); redraw(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                  Deshacer
                </button>
                <button className="btn btn-primary btn-sm" style={{ borderRadius: 10, display: "flex", alignItems: "center", padding: "8px 16px" }} onClick={saveStrategy} disabled={saveStrategyMutation.isPending}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {saveStrategyMutation.isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

            {/* Canvas Wrap */}
            <div className="canvas-wrap-premium" style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : tool === "eraser" ? "none" : "crosshair", touchAction: "none", width: "100%", height: "100%" }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={() => { mousePosRef.current = null; stopDraw(); redraw(); }}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
            </div>

            {/* Agent Selector (Horizontal below canvas) */}
            <div className="agents-horizontal-premium">
              {(['duelist', 'initiator', 'controller', 'sentinel'] as AgentRole[]).map(role => {
                const roleAgents = getAgentsByRole(role);
                if (roleAgents.length === 0) return null;
                return (
                  <div key={role} className="agents-role-group-premium">
                    <div className="agents-role-header-premium" style={{ color: ROLE_COLORS[role] }}>
                      <span>{role === 'duelist' ? '⚔️' : role === 'initiator' ? '🎯' : role === 'controller' ? '🌌' : '🛡️'}</span>
                      <span className="agents-role-name-premium">{role.toUpperCase()}S</span>
                    </div>
                    <div className="agents-row-premium">
                      {roleAgents.map(a => (
                        <button key={a.id} className="agent-btn-premium-horizontal" onClick={() => dropAgent(a)}>
                          <img src={a.displayIcon} alt={a.name} className="agent-icon-horizontal" style={{ border: `1.5px solid ${ROLE_COLORS[a.role] || '#fff'}` }} />
                          <div className="agent-name-horizontal">{a.name.toUpperCase()}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {showNewStrat && (
        <div className="modal-overlay-premium">
          <div className="modal-card-premium" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, textTransform: "uppercase", letterSpacing: 1 }}>Nueva Estrategia</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nombre de la táctica</label>
              <input className="input-premium" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Control de Mid a A" autoFocus />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Bando inicial</label>
              <select className="input-premium" value={selectedSide} onChange={e => setSelectedSide(e.target.value as "attack" | "defense")}>
                <option value="attack">Atacante (⚔️)</option>
                <option value="defense">Defensor (🛡️)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" style={{ borderRadius: 10 }} onClick={() => setShowNewStrat(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ borderRadius: 10, padding: "10px 20px" }} onClick={createStrat} disabled={createStratMutation.isPending}>
                {createStratMutation.isPending ? "Creando..." : "Crear Estrategia"}
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
    <div className="empty-state-dashed">
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255, 255, 255, 0.45)", margin: 0 }}>{message}</p>
    </div>
  );
}
