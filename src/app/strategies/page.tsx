/* eslint-disable no-undef */
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { type ValorantMap } from "@/lib/maps";
import { ROLE_COLORS, type ValorantAgent, type AgentRole } from "@/lib/agents";
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

type Tool = "select" | "draw" | "arrow" | "eraser" | "pan";
type View = "maps" | "strategies" | "editor";



function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { h: 0, s: 100, l: 50 };
  }

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHSV(h: number, s: number, l: number): { h: number; s: number; v: number } {
  const l_fraction = l / 100;
  const s_fraction = s / 100;
  let v = l_fraction + s_fraction * Math.min(l_fraction, 1 - l_fraction);
  let newS = v === 0 ? 0 : 2 * (1 - l_fraction / v);
  return {
    h,
    s: Math.round(newS * 100),
    v: Math.round(v * 100)
  };
}

function hsvToHSL(h: number, s: number, v: number): { h: number; s: number; l: number } {
  const l = ((2 - s / 100) * (v / 100)) / 2;
  let newS = s;
  if (l !== 0) {
    if (l === 1) {
      newS = 0;
    } else if (l < 0.5) {
      newS = (s * v) / (l * 200);
    } else {
      newS = (s * v) / (2 - l * 2);
    }
  }
  return {
    h,
    s: Math.round(newS),
    l: Math.round(l * 100)
  };
}

export default function StrategiesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("maps");
  const [selectedMap, setSelectedMap] = useState<(ValorantMap & { activeInRotation?: boolean }) | null>(null);
  const [current, setCurrent] = useState<Strategy | null>(null);
  const [selectedSide, setSelectedSide] = useState<"attack" | "defense">("attack");
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#FF4655");
  const [activeTeam, setActiveTeam] = useState<"ally" | "enemy">("ally");
  const [showNewStrat, setShowNewStrat] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeRole, setActiveRole] = useState<AgentRole | null>("duelist");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Strategy Settings States
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configName, setConfigName] = useState("");
  const [configSide, setConfigSide] = useState<"attack" | "defense">("attack");
  const [configDescription, setConfigDescription] = useState("");

  // Brush Size States
  const [pencilSize, setPencilSize] = useState<number>(5);
  const [arrowSize, setArrowSize] = useState<number>(5);
  const [eraserSize, setEraserSize] = useState<number>(20);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const draggedAgentRef = useRef<{ id: string; x: number; y: number; team?: 'ally' | 'enemy' } | null>(null);
  const pathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[]; thickness?: number }>>([]);
  const agentsRef = useRef<Array<{ id: string; x: number; y: number; team?: 'ally' | 'enemy' }>>([]);
  const redoPathsRef = useRef<Array<{ tool: Tool; color: string; points: { x: number; y: number }[]; thickness?: number }>>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customH, setCustomH] = useState(0);
  const [customS, setCustomS] = useState(100);
  const [customL, setCustomL] = useState(50);
  const [customHSV, setCustomHSV] = useState({ s: 100, v: 100 });
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  useEffect(() => {
    if (isDraggingColor) return;
    let hVal = 0, sVal = 100, lVal = 50;
    if (color.startsWith("#")) {
      const { h, s, l } = hexToHSL(color);
      hVal = h;
      sVal = s;
      lVal = l;
    } else if (color.startsWith("hsl")) {
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        hVal = parseInt(match[1]);
        sVal = parseInt(match[2]);
        lVal = parseInt(match[3]);
      }
    }
    setCustomH(hVal);
    setCustomS(sVal);
    setCustomL(lVal);
    const hsv = hslToHSV(hVal, sVal, lVal);
    setCustomHSV({ s: hsv.s, v: hsv.v });
  }, [color]);

  const handleStart2D = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingColor(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const updateColor = (clientX: number, clientY: number) => {
      const boundedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const boundedY = Math.max(rect.top, Math.min(rect.bottom, clientY));

      const x = (boundedX - rect.left) / rect.width;
      const y = (boundedY - rect.top) / rect.height;
      const hsvS = Math.round(x * 100);
      const hsvV = Math.round((1 - y) * 100);

      setCustomHSV({ s: hsvS, v: hsvV });

      const hsl = hsvToHSL(customH, hsvS, hsvV);
      setCustomS(hsl.s);
      setCustomL(hsl.l);
      setColor(`hsl(${customH}, ${hsl.s}%, ${hsl.l}%)`);
    };

    updateColor(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateColor(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingColor(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart2D = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingColor(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const updateColor = (clientX: number, clientY: number) => {
      const boundedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const boundedY = Math.max(rect.top, Math.min(rect.bottom, clientY));

      const x = (boundedX - rect.left) / rect.width;
      const y = (boundedY - rect.top) / rect.height;
      const hsvS = Math.round(x * 100);
      const hsvV = Math.round((1 - y) * 100);

      setCustomHSV({ s: hsvS, v: hsvV });

      const hsl = hsvToHSL(customH, hsvS, hsvV);
      setCustomS(hsl.s);
      setCustomL(hsl.l);
      setColor(`hsl(${customH}, ${hsl.s}%, ${hsl.l}%)`);
    };

    updateColor(e.touches[0].clientX, e.touches[0].clientY);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        updateColor(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingColor(false);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
  };

  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const agentImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const mousePosRef = useRef<{ canvasX: number; canvasY: number } | null>(null);
  const agentsScrollRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

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

  // 1.2 Query Maps
  const {
    data: mapsData,
    isLoading: mapsLoading
  } = useQuery<{ maps: (ValorantMap & { activeInRotation?: boolean })[] }>({
    queryKey: ["maps"],
    queryFn: async () => {
      const res = await fetch("/api/maps");
      if (!res.ok) throw new Error("Error loading maps");
      return res.json();
    }
  });

  const allMaps = mapsData?.maps || [];
  const mapsInRotation = allMaps.filter(m => m.activeInRotation);
  const mapsOutOfRotation = allMaps.filter(m => !m.activeInRotation);

  // 1.5 Query Agents
  const {
    data: agentsData,
  } = useQuery<{ agents: ValorantAgent[] }>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Error loading agents");
      return res.json();
    }
  });

  const agents = agentsData?.agents || [];

  const findAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  const getAgentsByRole = useCallback((role: AgentRole) => {
    return agents.filter(a => a.role === role);
  }, [agents]);

  const goToMap = (map: ValorantMap) => {
    setSelectedMap(map);
    setView("strategies");
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const openConfigModal = () => {
    if (!current) return;
    setConfigName(current.name);
    setConfigSide(current.side as "attack" | "defense");
    setConfigDescription(current.description || "");
    setShowConfigModal(true);
  };

  const saveConfig = () => {
    if (!current) return;
    setCurrent({
      ...current,
      name: configName,
      description: configDescription,
      side: configSide
    });
    setSelectedSide(configSide);
    setShowConfigModal(false);
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
    if (mapParam && allMaps.length > 0) {
      const foundMap = allMaps.find(m => m.id.toLowerCase() === mapParam.toLowerCase() || m.name.toLowerCase() === mapParam.toLowerCase());
      if (foundMap) {
        goToMap(foundMap);
      }
    }
  }, [searchParams, allMaps]);


  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || canvas.width <= 0 || canvas.height <= 0) return;
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
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
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
      pCtx.save();
      pCtx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
      pCtx.scale(zoom, zoom);
      pCtx.rotate(angle);
      pCtx.scale(scale, scale);

      for (const path of pathsRef.current) {
        if (path.points.length < 2) continue;
        pCtx.beginPath();
        pCtx.strokeStyle = path.color;
        pCtx.lineWidth = (path.thickness !== undefined ? path.thickness : (path.tool === "eraser" ? 20 : 5)) / scale;
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

          // Find a reference point going backwards that is at least minDistance away to smooth out rotation jitters
          let refPoint = path.points[path.points.length - 2];
          const minDistance = 10 / scale;

          for (let i = path.points.length - 2; i >= 0; i--) {
            const p = path.points[i];
            const dx = last.x - p.x;
            const dy = last.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) >= minDistance) {
              refPoint = p;
              break;
            }
          }

          const arrowAngle = Math.atan2(last.y - refPoint.y, last.x - refPoint.x);

          pCtx.save();
          pCtx.translate(last.x, last.y);
          pCtx.rotate(arrowAngle);
          pCtx.scale(1 / scale, 1 / scale);

          const arrowScale = (path.thickness !== undefined ? path.thickness : 5) / 5;
          pCtx.beginPath(); pCtx.fillStyle = path.color;
          pCtx.moveTo(0, -6 * arrowScale);
          pCtx.lineTo(15 * arrowScale, 0);
          pCtx.lineTo(0, 6 * arrowScale);
          pCtx.closePath(); pCtx.fill();
          pCtx.restore();
        }
      }
      pCtx.restore();
    }

    // Draw the processed paths onto the main canvas
    ctx.drawImage(pathCanvas, 0, 0);

    // 3. Draw Agents on main canvas
    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    for (const a of agentsRef.current) {
      const img = agentImgsRef.current.get(a.id);
      const agent = findAgent(a.id);

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
        ctx.strokeStyle = a.team === "enemy" ? "#ff4655" : "#3b82f6";
        ctx.lineWidth = draggedAgentRef.current === a ? 4.5 : 2.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = a.team === "enemy" ? "#ff4655" : "#3b82f6";
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
      const r = (eraserSize / 2) * zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mousePosRef.current.canvasX, mousePosRef.current.canvasY, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mousePosRef.current.canvasX, mousePosRef.current.canvasY, Math.max(1, r - 1), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }, [selectedMap, selectedSide, tool, agents, zoom, pan, pencilSize, arrowSize, eraserSize]);

  const updateUndoRedo = useCallback(() => {
    setCanUndo(pathsRef.current.length > 0);
    setCanRedo(redoPathsRef.current.length > 0);
  }, []);

  const undo = useCallback(() => {
    if (pathsRef.current.length > 0) {
      const path = pathsRef.current.pop();
      if (path) {
        redoPathsRef.current.push(path);
      }
      redraw();
      updateUndoRedo();
    }
  }, [redraw, updateUndoRedo]);

  const redo = useCallback(() => {
    if (redoPathsRef.current.length > 0) {
      const path = redoPathsRef.current.pop();
      if (path) {
        pathsRef.current.push(path);
      }
      redraw();
      updateUndoRedo();
    }
  }, [redraw, updateUndoRedo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view === "editor" && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          undo();
        } else if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [view, undo, redo]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();

      const scaleFactor = 1.15;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      let newZoom = currentZoom;
      if (e.deltaY < 0) {
        newZoom = Math.min(currentZoom * scaleFactor, 6);
      } else {
        newZoom = Math.max(currentZoom / scaleFactor, 0.4);
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const dx = mouseX - canvas.width / 2 - currentPan.x;
      const dy = mouseY - canvas.height / 2 - currentPan.y;

      const zoomRatio = newZoom / currentZoom;
      const newPanX = mouseX - canvas.width / 2 - dx * zoomRatio;
      const newPanY = mouseY - canvas.height / 2 - dy * zoomRatio;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    canvas.addEventListener("wheel", handleWheelRaw, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelRaw);
  }, [view, current]);

  useEffect(() => {
    redraw();
  }, [zoom, pan, redraw]);

  const getScreenPos = (mx: number, my: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const angle = selectedSide === "attack" ? Math.PI / 2 : -Math.PI / 2;

    const mapImg = mapImgRef.current;
    let scale = 1;
    if (mapImg && mapImg.complete) {
      const rotatedW = mapImg.height;
      const rotatedH = mapImg.width;
      scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
    }

    const x_rot = mx * scale;
    const y_rot = my * scale;

    const x_rot2 = x_rot * Math.cos(angle) - y_rot * Math.sin(angle);
    const y_rot2 = x_rot * Math.sin(angle) + y_rot * Math.cos(angle);

    const screenX = canvas.width / 2 + panRef.current.x + x_rot2 * zoomRef.current;
    const screenY = canvas.height / 2 + panRef.current.y + y_rot2 * zoomRef.current;

    return { x: screenX, y: screenY };
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent | React.DragEvent) => {
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
    const zoomVal = zoomRef.current;
    const panVal = panRef.current;
    const dx = (canvasX - canvas.width / 2 - panVal.x) / zoomVal;
    const dy = (canvasY - canvas.height / 2 - panVal.y) / zoomVal;

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
    let cx = 0;
    let cy = 0;
    if ("touches" in e) {
      if (e.touches.length > 0) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      }
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }

    const isRightClick = "button" in e && e.button === 2;
    if (tool === "pan" || isRightClick) {
      panningRef.current = true;
      panStartRef.current = { x: cx - panRef.current.x, y: cy - panRef.current.y };
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = "grabbing";
      return;
    }

    const pos = getPos(e);
    const canvas = canvasRef.current;

    if (canvas && tool === "select") {
      const rect = canvas.getBoundingClientRect();
      const mouseX = cx - rect.left;
      const mouseY = cy - rect.top;

      const found = [...agentsRef.current].reverse().find(a => {
        const screenPos = getScreenPos(a.x, a.y);
        const dx = screenPos.x - mouseX;
        const dy = screenPos.y - mouseY;
        return Math.sqrt(dx * dx + dy * dy) <= 18 * zoomRef.current;
      });
      if (found) {
        draggedAgentRef.current = found;
        return;
      }
    }
    if (canvas && tool === "eraser") {
      const rect = canvas.getBoundingClientRect();
      const mouseX = cx - rect.left;
      const mouseY = cy - rect.top;

      const agentIndex = agentsRef.current.findIndex(a => {
        const screenPos = getScreenPos(a.x, a.y);
        const dx = screenPos.x - mouseX;
        const dy = screenPos.y - mouseY;
        return Math.sqrt(dx * dx + dy * dy) <= 18 * zoomRef.current;
      });
      if (agentIndex !== -1) {
        agentsRef.current.splice(agentIndex, 1);
        redraw();
        return;
      }
    }
    drawingRef.current = true;
    const activeSize = tool === "draw" ? pencilSize : tool === "arrow" ? arrowSize : tool === "eraser" ? eraserSize : 5;
    pathsRef.current.push({ tool, color, points: [pos], thickness: activeSize });
    redoPathsRef.current = [];
    updateUndoRedo();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    let cx = 0;
    let cy = 0;
    if ("touches" in e) {
      if (e.touches.length > 0) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      }
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }

    if (panningRef.current) {
      setPan({
        x: cx - panStartRef.current.x,
        y: cy - panStartRef.current.y
      });
      return;
    }

    const pos = getPos(e);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { canvasX: cx - rect.left, canvasY: cy - rect.top };

      if (tool === "select") {
        if (draggedAgentRef.current) {
          canvas.style.cursor = "grabbing";
        } else {
          const mouseX = cx - rect.left;
          const mouseY = cy - rect.top;
          const isOverAgent = agentsRef.current.some(a => {
            const screenPos = getScreenPos(a.x, a.y);
            const dx = screenPos.x - mouseX;
            const dy = screenPos.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) <= 18 * zoomRef.current;
          });
          canvas.style.cursor = isOverAgent ? "pointer" : "default";
        }
      } else if (tool === "pan") {
        canvas.style.cursor = "grab";
      }
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
    if (panningRef.current) {
      panningRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = tool === "pan" ? "grab" : "default";
      }
      return;
    }
    drawingRef.current = false;
    draggedAgentRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && tool === "select") {
      canvas.style.cursor = "default";
    }
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
    agentsRef.current.push({ id: a.id, x: -50 + Math.random() * 100, y: -50 + Math.random() * 100, team: activeTeam });
    redraw();
  };

  const handleAgentDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData("text/plain", agentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData("text/plain");
    if (!agentId) return;

    const pos = getPos(e);

    const agent = findAgent(agentId);
    if (agent) {
      if (!agentImgsRef.current.has(agent.id)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = agent.displayIcon;
        img.onload = () => {
          agentImgsRef.current.set(agent.id, img);
          redraw();
        };
        agentImgsRef.current.set(agent.id, img);
      }
      agentsRef.current.push({ id: agent.id, x: pos.x, y: pos.y, team: activeTeam });
      redraw();
    }
  };

  const handleAgentsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (agentsScrollRef.current) {
      agentsScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const openEditor = (s: Strategy) => {
    setCurrent(s);
    setSelectedSide(s.side as "attack" | "defense");
    setZoom(1);
    setPan({ x: 0, y: 0 });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (typeof s.canvas_data === "string" ? JSON.parse(s.canvas_data || "{}") : s.canvas_data || {}) as any;
      pathsRef.current = d.paths || [];
      agentsRef.current = d.agents || [];

      // Pre-load agent images
      for (const a of agentsRef.current) {
        if (!agentImgsRef.current.has(a.id)) {
          const agent = findAgent(a.id);
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
    redoPathsRef.current = [];
    updateUndoRedo();
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
          side: current.side,
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

  const colors2 = ["#FF4655", "#3B82F6", "#22C55E", "#EAB308", "#F97316", "#A855F7", "#EC4899", "#FFFFFF"];

  return (
    <div className={`strategies-container-premium ${view === "editor" ? "in-editor" : ""}`}>
      {view !== "editor" && (
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
            {/* Global back button removed to place it closer inside the context */}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} className="animate-in">

        {view === "maps" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            {mapsLoading ? (
              <div className="map-grid-premium">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="map-card-premium" style={{ height: 280 }}>
                    <Skeleton width="100%" height="100%" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {mapsInRotation.length > 0 && (
                  <div style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 900, color: '#00d4aa', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00d4aa', boxShadow: '0 0 10px #00d4aa' }} />
                      MAPAS EN ROTACIÓN (ESTA SEASON)
                    </h2>
                    <div className="map-grid-premium">
                      {mapsInRotation.map(m => (
                        <div key={m.id} className="map-card-premium" onClick={() => goToMap(m)}>
                          <img src={m.listViewIconTall || undefined} alt={m.name} className="map-img-premium" />
                          <div className="map-card-overlay-premium">
                            <h3 className="map-card-title-premium">{m.name}</h3>
                            <span className="map-card-subtitle-premium">{m.tacticalDescription || 'Competitivo'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mapsOutOfRotation.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.4)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' }} />
                      OTROS MAPAS (FUERA DE ROTACIÓN)
                    </h2>
                    <div className="map-grid-premium">
                      {mapsOutOfRotation.map(m => (
                        <div key={m.id} className="map-card-premium out-of-rotation" onClick={() => goToMap(m)}>
                          <img src={m.listViewIconTall || undefined} alt={m.name} className="map-img-premium" />
                          <div className="map-card-overlay-premium">
                            <h3 className="map-card-title-premium">{m.name}</h3>
                            <span className="map-card-subtitle-premium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {m.tacticalDescription || 'Fuera de rotación'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === "strategies" && selectedMap && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column" }}>
            <div className="map-banner-premium" style={{
              position: "relative",
              minHeight: "180px",
              height: "auto",
              borderRadius: "24px",
              overflow: "hidden",
              marginBottom: "32px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              padding: "32px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
              flexShrink: 0
            }}>
              {/* Background Image (Splash or listViewIconTall/listViewIcon) */}
              {(selectedMap.splash || selectedMap.listViewIconTall || selectedMap.listViewIcon) && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${selectedMap.splash || selectedMap.listViewIconTall || selectedMap.listViewIcon || ""})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 40%",
                  opacity: 0.35,
                  zIndex: 0
                }} />
              )}
              {/* Visual overlay gradient */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to right, rgba(10, 14, 20, 0.95) 0%, rgba(10, 14, 20, 0.7) 50%, rgba(10, 14, 20, 0.2) 100%)",
                zIndex: 1
              }} />

              {/* Banner Content */}
              <div style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                flexWrap: "wrap",
                gap: 20
              }}>
                <div>
                  <button
                    onClick={goBack}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                      padding: "8px 16px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 16,
                      transition: "all 0.3s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 70, 85, 0.15)";
                      e.currentTarget.style.borderColor = "rgba(255, 70, 85, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Volver a Mapas
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: selectedMap.activeInRotation ? "#00d4aa" : "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      background: selectedMap.activeInRotation ? "rgba(0, 212, 170, 0.1)" : "rgba(255,255,255,0.05)",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      border: selectedMap.activeInRotation ? "1px solid rgba(0, 212, 170, 0.2)" : "1px solid rgba(255,255,255,0.1)"
                    }}>
                      {selectedMap.activeInRotation ? "En Rotación Activa" : "Fuera de Rotación"}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>•</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      {selectedMap.tacticalDescription || "Mapa Competitivo"}
                    </span>
                  </div>
                  <h1 style={{
                    fontSize: 40,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    color: "#ffffff",
                    margin: 0,
                    letterSpacing: 2,
                    lineHeight: 1.1,
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)"
                  }} className="gradient-text-valorant">
                    {selectedMap.name}
                  </h1>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 8, fontWeight: 500 }}>
                    Biblioteca de estrategias creadas para este mapa.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: "12px 28px",
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: 0.5,
                    boxShadow: "0 8px 24px rgba(255, 70, 85, 0.35)",
                    transition: "all 0.3s ease"
                  }}
                  onClick={() => setShowNewStrat(true)}
                >
                  + NUEVA ESTRATEGIA
                </button>
              </div>
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
          <div className="editor-card-premium">

            {/* Top Toolbar Panel */}
            <div className="editor-top-bar-premium">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {/* Volver button */}
                <button
                  className="tool-btn-premium"
                  onClick={goBack}
                  title="Volver a estrategias"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    padding: 0,
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>

                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#ff4655", textTransform: "uppercase", letterSpacing: 1.5 }}>
                    {selectedMap?.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: "#ffffff", letterSpacing: 0.5 }}>
                      {current.name}
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 900,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: current.side === "attack" ? "rgba(255, 70, 85, 0.15)" : "rgba(59, 130, 246, 0.15)",
                      color: current.side === "attack" ? "#ff4655" : "#3b82f6",
                      border: current.side === "attack" ? "1px solid rgba(255, 70, 85, 0.25)" : "1px solid rgba(59, 130, 246, 0.25)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5
                    }}>
                      {current.side === "attack" ? "Atacante" : "Defensor"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Settings Button */}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)"
                  }}
                  onClick={openConfigModal}
                  title="Ajustes de la Táctica"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>AJUSTES</span>
                </button>

                {/* Save Button */}
                <button
                  className="btn btn-primary btn-sm"
                  style={{
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    boxShadow: "0 0 12px rgba(255, 70, 85, 0.25)"
                  }}
                  onClick={saveStrategy}
                  disabled={saveStrategyMutation.isPending}
                  title="Guardar Táctica"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
                    {saveStrategyMutation.isPending ? "GUARDANDO..." : "GUARDAR"}
                  </span>
                </button>
              </div>
            </div>

            {/* Editor Workspace Row: Left is Vertical Toolbar, Right is Canvas */}
            <div className="editor-workspace-row-premium">

              {/* Vertical Toolbar Panel */}
              <div className="editor-toolbar-panel-premium">
                {/* Drawing tools group */}
                <div className="tool-group-premium-vertical">
                  {([
                    ["select", (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 4 7.07 16.93 3.03-7.07 7.07-3.03L4 4z" />
                        <path d="m13 13 6 6" />
                      </svg>
                    ), "Seleccionar"],
                    ["pan", (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 9-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                      </svg>
                    ), "Mover vista"],
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
                    <button key={t} className={`tool-btn-premium ${tool === t ? "active" : ""}`} onClick={() => setTool(t)} title={label} style={{ width: '100%', height: 38, justifyContent: 'center' }}>
                      {icon}
                    </button>
                  ))}
                </div>

                {(tool === "draw" || tool === "arrow") && (
                  <>
                    <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 0" }} />

                    {/* Color Palette orbs */}
                    <div className="color-palette-premium-vertical">
                      {colors2.map(c => (
                        <button key={c} className={`color-orb-premium ${color === c ? "active" : ""}`} style={{ background: c, "--orb-glow": c, width: 18, height: 18 } as React.CSSProperties} onClick={() => { setColor(c); setShowColorPicker(false); }}>
                          {color === c && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                        </button>
                      ))}

                      {/* Custom Spectrum Picker Orb */}
                      <button
                        style={{
                          position: "relative",
                          gridColumn: "span 2",
                          width: "100%",
                          height: 18,
                          borderRadius: 9,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          border: "none",
                          padding: 0,
                          background: "transparent"
                        }}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title="Color personalizado"
                        type="button"
                      >
                        <div
                          className={`color-orb-premium ${!colors2.includes(color) ? "active" : ""}`}
                          style={{
                            width: "100%",
                            height: 18,
                            borderRadius: 9,
                            background: "conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)",
                            boxShadow: !colors2.includes(color) ? `0 0 8px ${color}` : "none",
                            border: !colors2.includes(color) ? `2.5px solid ${color}` : `0px solid ${color}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          {!colors2.includes(color) ? (
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "#ffffff",
                                boxShadow: "0 0 2px rgba(0,0,0,0.5)"
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 8, fontWeight: 900, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.8)", letterSpacing: 0.5 }}>MÁS</span>
                          )}
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {/* Brush Size Selector */}
                {(tool === "draw" || tool === "arrow" || tool === "eraser") && (
                  <>
                    <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0 4px 0" }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase" }}>Grosor</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                        {(tool === "eraser" ? [10, 20, 45, 80] : [2, 5, 10, 18]).map(size => {
                          const activeSize = tool === "draw" ? pencilSize : tool === "arrow" ? arrowSize : eraserSize;
                          const isActive = activeSize === size;

                          // Visual representation of the dot size scaled down
                          const dotSize = Math.max(4, Math.min(16, tool === "eraser" ? size / 4 : size * 0.9));

                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                if (tool === "draw") setPencilSize(size);
                                else if (tool === "arrow") setArrowSize(size);
                                else if (tool === "eraser") setEraserSize(size);
                              }}
                              className={`size-selector-btn-premium ${isActive ? "active" : ""}`}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                border: isActive ? "1px solid var(--val-red)" : "1px solid rgba(255,255,255,0.06)",
                                background: isActive ? "rgba(255, 70, 85, 0.15)" : "rgba(255,255,255,0.02)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                outline: "none",
                              }}
                              title={`${size}px`}
                            >
                              <div
                                style={{
                                  width: dotSize,
                                  height: dotSize,
                                  borderRadius: "50%",
                                  background: isActive ? "var(--val-red)" : "rgba(255,255,255,0.6)",
                                  transition: "all 0.2s ease",
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ flexGrow: 1 }} />

                {/* Actions group */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  {/* Deshacer (Undo) */}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "100%",
                      padding: "10px 4px",
                      height: "auto",
                      opacity: canUndo ? 1 : 0.35,
                      pointerEvents: canUndo ? "auto" : "none",
                      transition: "all 0.2s ease"
                    }}
                    onClick={undo}
                    title="Deshacer (Ctrl+Z)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7v6h6" />
                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                    <span style={{ fontSize: 8, marginTop: 4, letterSpacing: 0.5, fontWeight: 700 }}>DESHACER</span>
                  </button>

                  {/* Rehacer (Redo) */}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "100%",
                      padding: "10px 4px",
                      height: "auto",
                      opacity: canRedo ? 1 : 0.35,
                      pointerEvents: canRedo ? "auto" : "none",
                      transition: "all 0.2s ease"
                    }}
                    onClick={redo}
                    title="Rehacer (Ctrl+Y)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 7v6h-6" />
                      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                    </svg>
                    <span style={{ fontSize: 8, marginTop: 4, letterSpacing: 0.5, fontWeight: 700 }}>REHACER</span>
                  </button>
                </div>
              </div>

              {/* Custom Color Picker Panel (Styled to match the app) */}
              {showColorPicker && (
                <div className="color-picker-panel-premium">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>Color de trazo</span>
                    <button
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, padding: 0 }}
                      onClick={() => setShowColorPicker(false)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Color Preview Block */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: color,
                        border: "1px solid rgba(255,255,255,0.2)",
                        boxShadow: `0 0 10px ${color}33`,
                        flexShrink: 0
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Valor actual</span>
                      <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>{color}</span>
                    </div>
                  </div>

                  {/* 2D Picker Canvas (Saturation & Value) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>
                      <span>SATURACIÓN / LUMINOSIDAD</span>
                    </div>
                    <div style={{ position: "relative", width: "100%", height: 110 }}>
                      {/* Gradient Background Container */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 8,
                          backgroundColor: `hsl(${customH}, 100%, 50%)`,
                          backgroundImage: "linear-gradient(to bottom, transparent, #000000), linear-gradient(to right, #ffffff, transparent)",
                          overflow: "hidden",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
                          pointerEvents: "none"
                        }}
                      />
                      {/* Dragging Area & Target Selector */}
                      <div
                        onMouseDown={handleStart2D}
                        onTouchStart={handleTouchStart2D}
                        style={{
                          position: "absolute",
                          inset: 0,
                          cursor: "crosshair",
                          userSelect: "none"
                        }}
                      >
                        {/* Target selector circle */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${customHSV.s}%`,
                            top: `${100 - customHSV.v}%`,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "#ffffff",
                            border: "2px solid #000000",
                            boxShadow: "0 0 0 1.5px #ffffff, 0 1px 4px rgba(0,0,0,0.5)",
                            transform: "translate(-50%, -50%)",
                            cursor: isDraggingColor ? "crosshair" : "grab",
                            pointerEvents: "auto"
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hue Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>
                      <span>TONO</span>
                      <span>{customH}°</span>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 8,
                        borderRadius: 4,
                        background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={customH}
                        onChange={(e) => {
                          const h = parseInt(e.target.value);
                          setCustomH(h);
                          setColor(`hsl(${h}, ${customS}%, ${customL}%)`);
                        }}
                        className="color-picker-slider"
                        style={{
                          position: "absolute",
                          left: 6,
                          right: 6,
                          width: "calc(100% - 12px)",
                          background: "transparent",
                          margin: 0,
                          padding: 0,
                          height: 20,
                          cursor: "pointer"
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setShowColorPicker(false)}
                    style={{
                      marginTop: 4,
                      background: "rgba(255, 70, 85, 0.15)",
                      border: "1px solid rgba(255, 70, 85, 0.4)",
                      color: "#ffffff",
                      borderRadius: 6,
                      padding: "6px 0",
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 1,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      transition: "all 0.2s ease"
                    }}
                  >
                    ACEPTAR
                  </button>
                </div>
              )}

              {/* Canvas Wrap */}
              <div className="canvas-wrap-premium" style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : tool === "pan" ? "grab" : tool === "eraser" ? "none" : "crosshair", touchAction: "none", width: "100%", height: "100%" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={() => { mousePosRef.current = null; stopDraw(); redraw(); }}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                  onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
                  onContextMenu={e => e.preventDefault()} />

                {/* Floating Zoom & Perspective Controls */}
                <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 10 }}>
                  <button className="tool-btn-premium" onClick={() => {
                    const nextZoom = Math.min(zoom * 1.25, 6);
                    setZoom(nextZoom);
                  }} title="Acercar" style={{ width: 32, height: 32, borderRadius: 8, padding: 0, justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button className="tool-btn-premium" onClick={() => {
                    const nextZoom = Math.max(zoom / 1.25, 0.4);
                    setZoom(nextZoom);
                  }} title="Alejar" style={{ width: 32, height: 32, borderRadius: 8, padding: 0, justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button className="tool-btn-premium" onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }} title="Restablecer vista" style={{ width: 64, height: 32, borderRadius: 8, padding: 0, fontSize: 10, fontWeight: 800, justifyContent: 'center', textTransform: 'uppercase' }}>
                    {Math.round(zoom * 100)}%
                  </button>

                  {/* Integrated Horizontal Side/Perspective Selector */}
                  <div className="pill-toggle-premium" style={{ padding: 2, borderRadius: 8, display: 'flex', gap: 2, height: 32, alignItems: 'center', background: 'rgba(10, 14, 20, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)' }}>
                    <button
                      type="button"
                      className={`pill-btn-premium atk ${selectedSide === "attack" ? "active" : ""}`}
                      onClick={() => setSelectedSide("attack")}
                      title="Perspectiva de Ataque (ATK)"
                      style={{ padding: "0 8px", fontSize: 10, borderRadius: 6, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, height: '100%', border: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="14.5 17.5 3 6 6 3 17.5 14.5" />
                        <line x1="13" y1="19" x2="19" y2="13" />
                        <line x1="16" y1="20" x2="20" y2="16" />
                      </svg>
                      ATK
                    </button>
                    <button
                      type="button"
                      className={`pill-btn-premium def ${selectedSide === "defense" ? "active" : ""}`}
                      onClick={() => setSelectedSide("defense")}
                      title="Perspectiva de Defensa (DEF)"
                      style={{ padding: "0 8px", fontSize: 10, borderRadius: 6, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, height: '100%', border: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      DEF
                    </button>
                  </div>
                </div>
              </div>

              {/* No secondary right toolbar - Moved to Top Toolbar */}

            </div>

            {/* Agent Selector Panel (Horizontal below canvas) */}
            <div className="editor-agents-panel-premium">
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Añadir como:</span>
                <div className="pill-toggle-premium" style={{ padding: 2, borderRadius: 6 }}>
                  <button className={`pill-btn-premium def ${activeTeam === "ally" ? "active" : ""}`} onClick={() => setActiveTeam("ally")} style={{ padding: "3px 8px", fontSize: 9, borderRadius: 4, textTransform: "uppercase", fontWeight: 800 }}>
                    Aliado
                  </button>
                  <button className={`pill-btn-premium atk ${activeTeam === "enemy" ? "active" : ""}`} onClick={() => setActiveTeam("enemy")} style={{ padding: "3px 8px", fontSize: 9, borderRadius: 4, textTransform: "uppercase", fontWeight: 800 }}>
                    Enemigo
                  </button>
                </div>
              </div>

              <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

              <div className="agents-horizontal-premium" style={{ flex: 1, minWidth: 0 }} ref={agentsScrollRef} onWheel={handleAgentsWheel}>
                {(['duelist', 'initiator', 'controller', 'sentinel'] as AgentRole[]).map(role => {
                  const roleAgents = getAgentsByRole(role);
                  if (roleAgents.length === 0) return null;
                  return (
                    <div key={role} className="agents-role-group-premium">
                      <button
                        onClick={() => setActiveRole(activeRole === role ? null : role)}
                        className={`agents-role-header-premium ${activeRole === role ? 'active' : ''}`}
                        style={{
                          background: activeRole === role ? ROLE_COLORS[role] : undefined,
                          color: activeRole === role ? (role === 'initiator' ? '#0a0e14' : '#ffffff') : ROLE_COLORS[role],
                          borderColor: activeRole === role ? ROLE_COLORS[role] : undefined
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            backgroundColor: activeRole === role ? (role === 'initiator' ? '#0a0e14' : '#ffffff') : ROLE_COLORS[role],
                            maskImage: `url(${roleAgents[0].roleIcon})`,
                            WebkitMaskImage: `url(${roleAgents[0].roleIcon})`,
                            maskSize: 'contain',
                            WebkitMaskSize: 'contain',
                            maskRepeat: 'no-repeat',
                            WebkitMaskRepeat: 'no-repeat',
                            flexShrink: 0
                          }}
                        />
                        <span className="agents-role-name-premium">{role.toUpperCase()}S</span>
                      </button>

                      <div className={`agents-row-premium ${activeRole === role ? 'expanded' : ''}`}>
                        {roleAgents.map(a => (
                          <button key={a.id} className="agent-btn-premium-horizontal" onClick={() => dropAgent(a)} draggable={true} onDragStart={(e) => handleAgentDragStart(e, a.id)}>
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
              <div className="pill-toggle-premium" style={{ width: '100%', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className={`pill-btn-premium atk ${selectedSide === "attack" ? "active" : ""}`}
                  onClick={() => setSelectedSide("attack")}
                  style={{ flex: 1, padding: "8px 0", fontSize: 11, borderRadius: 6, textTransform: "uppercase", fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14.5 17.5 3 6 6 3 17.5 14.5" />
                    <line x1="13" y1="19" x2="19" y2="13" />
                    <line x1="16" y1="20" x2="20" y2="16" />
                    <line x1="19" y1="21" x2="21" y2="19" />
                  </svg>
                  Atacante
                </button>
                <button
                  type="button"
                  className={`pill-btn-premium def ${selectedSide === "defense" ? "active" : ""}`}
                  onClick={() => setSelectedSide("defense")}
                  style={{ flex: 1, padding: "8px 0", fontSize: 11, borderRadius: 6, textTransform: "uppercase", fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Defensor
                </button>
              </div>
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

      {showConfigModal && (
        <div className="modal-overlay-premium">
          <div className="modal-card-premium" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 24, textTransform: "uppercase", letterSpacing: 1 }}>Ajustes de la Táctica</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nombre de la táctica</label>
              <input className="input-premium" value={configName} onChange={e => setConfigName(e.target.value)} placeholder="Ej: Control de Mid a A" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Bando de juego</label>
              <div className="pill-toggle-premium" style={{ width: '100%', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className={`pill-btn-premium atk ${configSide === "attack" ? "active" : ""}`}
                  onClick={() => setConfigSide("attack")}
                  style={{ flex: 1, padding: "8px 0", fontSize: 11, borderRadius: 6, textTransform: "uppercase", fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14.5 17.5 3 6 6 3 17.5 14.5" />
                    <line x1="13" y1="19" x2="19" y2="13" />
                    <line x1="16" y1="20" x2="20" y2="16" />
                    <line x1="19" y1="21" x2="21" y2="19" />
                  </svg>
                  Atacante
                </button>
                <button
                  type="button"
                  className={`pill-btn-premium def ${configSide === "defense" ? "active" : ""}`}
                  onClick={() => setConfigSide("defense")}
                  style={{ flex: 1, padding: "8px 0", fontSize: 11, borderRadius: 6, textTransform: "uppercase", fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Defensor
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Descripción</label>
              <textarea
                className="input-premium"
                rows={3}
                value={configDescription}
                onChange={e => setConfigDescription(e.target.value)}
                placeholder="Describe la ejecución, utilidades a usar, etc..."
                style={{ resize: 'none', height: 'auto', paddingTop: 10, paddingBottom: 10 }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" style={{ borderRadius: 10 }} onClick={() => setShowConfigModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ borderRadius: 10, padding: "10px 20px" }} onClick={saveConfig}>
                Confirmar
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
