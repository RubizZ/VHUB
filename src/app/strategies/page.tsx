/* eslint-disable no-undef */
"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type ValorantMap } from "@/lib/maps";
import { ROLE_COLORS, type ValorantAgent, type AgentRole } from "@/lib/agents";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Strategy {
  id: number;
  map_id: string;
  name: string;
  side: string;
  description: string;
  canvas_data: unknown;
  updated_at?: string;
}

interface CollabUser {
  userId: string;
  userName: string;
  userColor: string;
}

interface RemoteCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
}

interface CanvasPath {
  id: string;
  tool: Tool;
  color: string;
  points: { x: number; y: number }[];
  thickness?: number;
  createdBy?: string;
}

interface CanvasAgent {
  instanceId: string;
  id: string;
  x: number;
  y: number;
  team?: 'ally' | 'enemy';
  createdBy?: string;
}

type UndoAction =
  | { type: 'add-path'; path: CanvasPath }
  | { type: 'remove-path'; path: CanvasPath; index: number }
  | { type: 'add-agent'; agent: CanvasAgent }
  | { type: 'remove-agent'; agent: CanvasAgent; index: number }
  | { type: 'move-agent'; agentId: string; oldX: number; oldY: number; newX: number; newY: number }
  | { type: 'clear-all'; paths: CanvasPath[]; agents: CanvasAgent[] };

type Tool = "select" | "draw" | "arrow" | "eraser";
type View = "maps" | "strategies" | "editor";

// RAF-based redraw scheduler to avoid calling redraw multiple times per frame
let pendingRedrawRef: number | null = null;



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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [view, setView] = useState<View>(() => {
    if (searchParams.get("strategy")) return "editor";
    if (searchParams.get("map")) return "strategies";
    return "maps";
  });
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
  const [compositionFilter, setCompositionFilter] = useState<string | null>(null);
  const [hoverMenuState, setHoverMenuState] = useState<{ agent: CanvasAgent | null; x: number; y: number; visible: boolean }>({ agent: null, x: 0, y: 0, visible: false });
  const hoverMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoveredAgentRef = useRef<CanvasAgent | null>(null);
  const isAgentDroppedRef = useRef<boolean>(false);

  // Strategy Settings States
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configName, setConfigName] = useState("");
  const [configSide, setConfigSide] = useState<"attack" | "defense">("attack");
  const [configDescription, setConfigDescription] = useState("");
  const [configMapId, setConfigMapId] = useState("");

  // Brush Size States
  const [pencilSize, setPencilSize] = useState<number>(5);
  const [arrowSize, setArrowSize] = useState<number>(5);
  const [eraserSize, setEraserSize] = useState<number>(20);
  const [eraserMode, setEraserMode] = useState<"pixels" | "lines">("pixels");
  const eraserSizeRef = useRef<number>(20);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const draggedAgentRef = useRef<CanvasAgent | null>(null);
  const draggedAgentOldPosRef = useRef<{ x: number; y: number } | null>(null);
  const agentClickStartRef = useRef<{ x: number; y: number } | null>(null);
  const pathsRef = useRef<CanvasPath[]>([]);
  const agentsRef = useRef<CanvasAgent[]>([]);
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const hoveredPathIdRef = useRef<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customH, setCustomH] = useState(0);
  const [customS, setCustomS] = useState(100);
  const [customL, setCustomL] = useState(50);
  const [customHSV, setCustomHSV] = useState({ s: 100, v: 100 });
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  // ── Collaboration State ──
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSavedAtRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorBroadcastTimeRef = useRef<number>(0);
  const lastStrokeBroadcastTimeRef = useRef<number>(0);
  const lastAgentBroadcastTimeRef = useRef<number>(0);
  const activePathIdRef = useRef<string | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const customCursorRef = useRef<HTMLDivElement | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingExternalStratId, setEditingExternalStratId] = useState<number | null>(null);
  const myUserId = session?.user?.id || "";
  const myUserName = session?.user?.name || "Anónimo";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myPlayerColor = (session?.user as any)?.avatarColor || "#FF4655";

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
  const loadedPathIdsRef = useRef<Set<string>>(new Set());
  const loadedAgentIdsRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef<{ canvasX: number; canvasY: number } | null>(null);
  const agentsScrollRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  // Tracks whether we need to flush pan state to React after panning ends
  const pendingPanFlushRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);

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

  const getAllyAgents = useCallback((strategy: Strategy): CanvasAgent[] => {
    const canvasData = strategy.canvas_data as { agents?: CanvasAgent[] } | null;
    if (!canvasData?.agents) return [];
    return canvasData.agents.filter(a => a.team === 'ally').slice(0, 5);
  }, []);

  const getAllyComposition = useCallback((strategy: Strategy): string[] => {
    const allyAgents = getAllyAgents(strategy);
    return allyAgents.map(a => a.id);
  }, [getAllyAgents]);

  const getUniqueCompositions = useCallback((strats: Strategy[]): Map<string, Strategy[]> => {
    const compMap = new Map<string, Strategy[]>();
    for (const s of strats) {
      const comp = getAllyComposition(s);
      if (comp.length === 0) continue;
      const key = comp.join(',');
      if (!compMap.has(key)) {
        compMap.set(key, []);
      }
      compMap.get(key)!.push(s);
    }
    return compMap;
  }, [getAllyComposition]);

  const syncCanvasLocalState = useCallback((paths: CanvasPath[], agentsList: CanvasAgent[]) => {
    const sanitizedPaths = paths.map((p) => ({
      ...p,
      id: p.id || Math.random().toString(36).substring(2, 9)
    }));
    const sanitizedAgents = agentsList.map((a) => ({
      ...a,
      instanceId: a.instanceId || Math.random().toString(36).substring(2, 9)
    }));

    pathsRef.current = sanitizedPaths;
    agentsRef.current = sanitizedAgents;

    loadedPathIdsRef.current = new Set(sanitizedPaths.map((p) => p.id));
    loadedAgentIdsRef.current = new Set(sanitizedAgents.map((a) => a.instanceId));
  }, []);

  const goToMap = (map: ValorantMap) => {
    setSelectedMap(map);
    setView("strategies");
    setZoom(1);
    setPan({ x: 0, y: 0 });
    router.push(`?map=${map.id}`);
  };

  const openConfigModal = () => {
    if (!current) return;
    setConfigName(current.name);
    setConfigSide(current.side as "attack" | "defense");
    setConfigDescription(current.description || "");
    setConfigMapId(current.map_id || selectedMap?.id || "");
    setShowConfigModal(true);
  };

  const saveConfig = () => {
    if (!current) return;
    // If map changed, update selected map
    if (configMapId && configMapId !== current.map_id) {
      const newMap = allMaps.find(m => m.id === configMapId);
      if (newMap) {
        setSelectedMap(newMap);
        // Reset map image so it reloads
        mapImgRef.current = null;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = newMap.displayIcon || '';
        img.onload = () => { mapImgRef.current = img; redraw(); };
      }
    }
    setCurrent({
      ...current,
      name: configName,
      description: configDescription,
      side: configSide,
      map_id: configMapId || current.map_id
    });
    setSelectedSide(configSide);
    setShowConfigModal(false);
  };

  const goBack = () => {
    if (view === "editor") {
      setCurrent(null);
      setView("strategies");
      if (selectedMap) {
        router.push(`?map=${selectedMap.id}`);
      } else {
        router.push("?");
      }
    } else if (view === "strategies") {
      setSelectedMap(null);
      setView("maps");
      router.push("?");
    }
  };

  const initialRouteHandled = useRef(false);
  useEffect(() => {
    if (initialRouteHandled.current || allMaps.length === 0) return;
    initialRouteHandled.current = true;
    
    const stratParam = searchParams.get("strategy");
    if (stratParam) {
      fetch(`/api/strategies?id=${stratParam}`).then(res => res.json()).then(data => {
        if (data.strategy) {
          const s = data.strategy;
          const foundMap = allMaps.find(m => m.id === s.map_id);
          if (foundMap) {
            setSelectedMap(foundMap);
            openEditor(s);
          }
        }
      });
    } else {
      const mapParam = searchParams.get("map");
      if (mapParam) {
        const foundMap = allMaps.find(m => m.id.toLowerCase() === mapParam.toLowerCase() || m.name.toLowerCase() === mapParam.toLowerCase());
        if (foundMap) {
          goToMap(foundMap);
        }
      }
    }
  }, [searchParams, allMaps]);


  // Stable ref to always call the latest redrawImmediate without stale closure
  const redrawImmediateRef = useRef<() => void>(() => {});

  // Throttled redraw via requestAnimationFrame to prevent multiple redraws per frame
  const scheduleRedraw = useCallback(() => {
    if (pendingRedrawRef !== null) return;
    pendingRedrawRef = requestAnimationFrame(() => {
      pendingRedrawRef = null;
      redrawImmediateRef.current();
    });
  }, []);

  const redraw = useCallback(() => {
    scheduleRedraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMap, selectedSide, tool, agents, zoom, pan, pencilSize, arrowSize, eraserSize, remoteCursors]);

  // The actual drawing function that reads from refs (no stale closures for pan/zoom)
  const redrawImmediate = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || canvas.width <= 0 || canvas.height <= 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mapImg = mapImgRef.current;
    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    const currentSide = selectedSide;
    const currentTool = tool;
    const currentEraserSize = eraserSizeRef.current;

    if (!(mapImg && mapImg.complete)) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.font = "bold 60px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((selectedMap?.name || "").toUpperCase(), canvas.width / 2, canvas.height / 2);
      ctx.textAlign = "start";
    }

    const angle = currentSide === "attack" ? Math.PI / 2 : -Math.PI / 2;

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
    ctx.translate(canvas.width / 2 + currentPan.x, canvas.height / 2 + currentPan.y);
    ctx.scale(currentZoom, currentZoom);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    if (mapImg && mapImg.complete) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mapImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 2. Draw Paths on an offscreen canvas to prevent eraser from erasing the map (using ref-based pan/zoom)
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const pathCanvas = offscreenCanvasRef.current;
    if (pathCanvas.width !== canvas.width || pathCanvas.height !== canvas.height) {
      pathCanvas.width = canvas.width;
      pathCanvas.height = canvas.height;
    }
    const pCtx = pathCanvas.getContext("2d");
    if (pCtx) {
      pCtx.clearRect(0, 0, pathCanvas.width, pathCanvas.height);
      pCtx.save();
      pCtx.translate(canvas.width / 2 + currentPan.x, canvas.height / 2 + currentPan.y);
      pCtx.scale(currentZoom, currentZoom);
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
          pCtx.beginPath();
          pCtx.strokeStyle = path.color;
          pCtx.lineWidth = path.thickness !== undefined ? path.thickness : 5;
          pCtx.lineCap = "round";
          pCtx.lineJoin = "round";
          pCtx.moveTo(-16 * arrowScale, -10 * arrowScale);
          pCtx.lineTo(0, 0);
          pCtx.lineTo(-16 * arrowScale, 10 * arrowScale);
          pCtx.stroke();
          pCtx.restore();
        }
      }
      pCtx.restore();
    }

    // Draw the processed paths onto the main canvas
    ctx.drawImage(pathCanvas, 0, 0);

    // 3. Draw Agents on main canvas
    ctx.save();
    ctx.translate(canvas.width / 2 + currentPan.x, canvas.height / 2 + currentPan.y);
    ctx.scale(currentZoom, currentZoom);
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

    // 4. Custom Eraser Circle cursor is now handled natively via DOM for 0 lag.
    // 4b. Line-eraser highlight disabled (no preview)

    // 5. Draw Remote Cursors (collaboration) in screen space
    for (const [, cursor] of remoteCursors) {
      const screenPos = (cursor.x !== undefined && cursor.y !== undefined)
        ? getScreenPos(cursor.x, cursor.y)
        : { x: cursor.canvasX, y: cursor.canvasY };
      ctx.save();
      // Draw cursor arrow
      ctx.translate(screenPos.x, screenPos.y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(4, 11);
      ctx.lineTo(8, 18);
      ctx.lineTo(11, 16);
      ctx.lineTo(7, 10);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fillStyle = cursor.userColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw name label
      const label = cursor.userName;
      ctx.font = "bold 10px Outfit, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const labelX = 14;
      const labelY = 16;
      ctx.fillStyle = cursor.userColor;
      ctx.beginPath();
      ctx.roundRect(labelX - 4, labelY - 9, textWidth + 8, 14, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, labelX, labelY + 2);
      ctx.restore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMap, selectedSide, tool, agents, remoteCursors]);

  // Keep ref always up-to-date so scheduleRedraw can call the latest version
  redrawImmediateRef.current = redrawImmediate;

  const updateUndoRedo = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const broadcastStrokeUpdate = useCallback((path: CanvasPath, finished: boolean) => {
    if (!current || !isSupabaseConfigured || !channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "draw-stroke",
      payload: {
        path,
        finished,
        userId: myUserId
      }
    });
  }, [current, myUserId]);

  const broadcastAgentUpdate = useCallback((agent: CanvasAgent, dragging: boolean) => {
    if (!current || !isSupabaseConfigured || !channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "drag-agent",
      payload: {
        agent,
        dragging,
        userId: myUserId
      }
    });
  }, [current, myUserId]);

  const broadcastEraseElements = useCallback((erasedPathIds: string[], erasedAgentIds: string[]) => {
    if (!current || !isSupabaseConfigured || !channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "erase-elements",
      payload: {
        erasedPathIds,
        erasedAgentIds,
        userId: myUserId
      }
    });
  }, [current, myUserId]);

  // ── Collaboration: Auto-save with debounce (forward-declared ref for saveStrategyMutation) ──
  const scheduleAutoSaveRef = useRef<() => void>(() => { });
  const scheduleAutoSave = useCallback(() => {
    scheduleAutoSaveRef.current();
  }, []);

  const clearAll = useCallback(() => {
    const oldPaths = [...pathsRef.current];
    const oldAgents = [...agentsRef.current];
    undoStackRef.current.push({ type: 'clear-all', paths: oldPaths, agents: oldAgents });
    redoStackRef.current = [];
    pathsRef.current = [];
    agentsRef.current = [];
    loadedPathIdsRef.current.clear();
    loadedAgentIdsRef.current.clear();
    updateUndoRedo();
    redrawImmediate();
    if (current && isSupabaseConfigured && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "canvas-clear",
        payload: { userId: myUserId }
      });
    }
    scheduleAutoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, myUserId, updateUndoRedo, scheduleAutoSave]);

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (!action) return;

    switch (action.type) {
      case 'add-path': {
        pathsRef.current = pathsRef.current.filter(p => p.id !== action.path.id);
        loadedPathIdsRef.current.delete(action.path.id);
        redoStackRef.current.push(action);
        broadcastEraseElements([action.path.id], []);
        break;
      }
      case 'remove-path': {
        pathsRef.current.splice(action.index, 0, action.path);
        loadedPathIdsRef.current.add(action.path.id);
        redoStackRef.current.push(action);
        broadcastStrokeUpdate(action.path, true);
        break;
      }
      case 'add-agent': {
        agentsRef.current = agentsRef.current.filter(a => a.instanceId !== action.agent.instanceId);
        redoStackRef.current.push(action);
        broadcastEraseElements([], [action.agent.instanceId]);
        break;
      }
      case 'remove-agent': {
        agentsRef.current.splice(action.index, 0, action.agent);
        redoStackRef.current.push(action);
        broadcastAgentUpdate(action.agent, false);
        loadedAgentIdsRef.current.add(action.agent.instanceId);
        break;
      }
      case 'move-agent': {
        const agent = agentsRef.current.find(a => a.instanceId === action.agentId);
        if (agent) {
          agent.x = action.oldX;
          agent.y = action.oldY;
          redoStackRef.current.push(action);
          broadcastAgentUpdate(agent, false);
        }
        break;
      }
      case 'clear-all': {
        pathsRef.current = action.paths;
        agentsRef.current = action.agents;
        redoStackRef.current.push(action);
        break;
      }
    }

    redraw();
    updateUndoRedo();
    scheduleAutoSave();
  }, [redraw, updateUndoRedo, broadcastEraseElements, broadcastStrokeUpdate, broadcastAgentUpdate, scheduleAutoSave]);

  const redo = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (!action) return;

    switch (action.type) {
      case 'add-path': {
        pathsRef.current.push(action.path);
        loadedPathIdsRef.current.add(action.path.id);
        undoStackRef.current.push(action);
        broadcastStrokeUpdate(action.path, true);
        break;
      }
      case 'remove-path': {
        pathsRef.current = pathsRef.current.filter(p => p.id !== action.path.id);
        loadedPathIdsRef.current.delete(action.path.id);
        undoStackRef.current.push(action);
        broadcastEraseElements([action.path.id], []);
        break;
      }
      case 'add-agent': {
        agentsRef.current.push(action.agent);
        undoStackRef.current.push(action);
        broadcastAgentUpdate(action.agent, false);
        loadedAgentIdsRef.current.add(action.agent.instanceId);
        break;
      }
      case 'remove-agent': {
        agentsRef.current = agentsRef.current.filter(a => a.instanceId !== action.agent.instanceId);
        undoStackRef.current.push(action);
        broadcastEraseElements([], [action.agent.instanceId]);
        break;
      }
      case 'move-agent': {
        const agent = agentsRef.current.find(a => a.instanceId === action.agentId);
        if (agent) {
          agent.x = action.newX;
          agent.y = action.newY;
          undoStackRef.current.push(action);
          broadcastAgentUpdate(agent, false);
        }
        break;
      }
      case 'clear-all': {
        pathsRef.current = [];
        agentsRef.current = [];
        loadedPathIdsRef.current.clear();
        loadedAgentIdsRef.current.clear();
        undoStackRef.current.push(action);
        break;
      }
    }

    redraw();
    updateUndoRedo();
    scheduleAutoSave();
  }, [redraw, updateUndoRedo, broadcastEraseElements, broadcastStrokeUpdate, broadcastAgentUpdate, scheduleAutoSave]);

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

  // Returns the minimum distance from point (px,py) to a line segment (ax,ay)-(bx,by)
  const pointToSegmentDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
  };

  // Finds the path closest to (worldX, worldY) within hitRadius (in world units)
  // Skips eraser-type paths and paths fully covered by eraser paths drawn AFTER them
  const findPathAtPoint = (worldX: number, worldY: number, hitRadius: number): CanvasPath | null => {
    let closest: CanvasPath | null = null;
    let closestDist = hitRadius;
    // Search in reverse so topmost (last drawn) path is preferred
    for (let i = pathsRef.current.length - 1; i >= 0; i--) {
      const path = pathsRef.current[i];
      if (path.tool === "eraser" || path.points.length < 2) continue;

      // Check if this path is covered by any eraser drawn AFTER it
      let covered = false;
      for (let k = i + 1; k < pathsRef.current.length; k++) {
        const ep = pathsRef.current[k];
        if (ep.tool !== "eraser" || ep.points.length < 2) continue;
        for (let j = 1; j < ep.points.length; j++) {
          const eraserRadius = (ep.thickness ?? 20) / 2;
          const d = pointToSegmentDist(
            worldX, worldY,
            ep.points[j - 1].x, ep.points[j - 1].y,
            ep.points[j].x, ep.points[j].y
          );
          if (d <= eraserRadius) {
            covered = true;
            break;
          }
        }
        if (covered) break;
      }
      if (covered) continue;

      for (let j = 1; j < path.points.length; j++) {
        const d = pointToSegmentDist(
          worldX, worldY,
          path.points[j - 1].x, path.points[j - 1].y,
          path.points[j].x, path.points[j].y
        );
        if (d < closestDist) {
          closestDist = d;
          closest = path;
          break;
        }
      }
    }
    return closest;
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

    const isMiddleClick = "button" in e && e.button === 1;
    if (isMiddleClick) return;

    const isRightClick = "button" in e && e.button === 2;

    // Left-click on agent with select tool → context menu or drag
    if (!isRightClick && tool === "select") {
      const canvas = canvasRef.current;
      if (canvas) {
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
          agentClickStartRef.current = { x: cx, y: cy };
          draggedAgentRef.current = found;
          draggedAgentOldPosRef.current = { x: found.x, y: found.y };
          return;
        }
      }
    }

    if (isRightClick) {
      panningRef.current = true;
      panStartRef.current = { x: cx - panRef.current.x, y: cy - panRef.current.y };
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = "grabbing";

      // Global listeners so pan continues outside the canvas bounds
      const panMoveHandler = (ev: MouseEvent) => draw(ev as unknown as React.MouseEvent);
      const panUpHandler = () => {
        window.removeEventListener("mousemove", panMoveHandler);
        window.removeEventListener("mouseup", panUpHandler);
        stopDraw();
      };
      window.addEventListener("mousemove", panMoveHandler);
      window.addEventListener("mouseup", panUpHandler);
      return;
    }

    const pos = getPos(e);
    const canvas = canvasRef.current;

    // ── Line Eraser: erase whole path on mousedown ──
    if (canvas && tool === "eraser" && eraserMode === "lines") {
      const mapImg = mapImgRef.current;
      let scale = 1;
      if (mapImg && mapImg.complete) {
        const rotatedW = mapImg.height;
        const rotatedH = mapImg.width;
        scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
      }
      const hitRadius = (eraserSize / 2) / (zoomRef.current * scale);
      const hit = findPathAtPoint(pos.x, pos.y, hitRadius);
      if (hit) {
        const erasedId = hit.id;
        const erasedIdx = pathsRef.current.findIndex(p => p.id === erasedId);
        const erasedPath = pathsRef.current.find(p => p.id === erasedId)!;
        undoStackRef.current.push({ type: 'remove-path', path: erasedPath, index: erasedIdx });
        redoStackRef.current = [];
        pathsRef.current = pathsRef.current.filter(p => p.id !== erasedId);
        if (hoveredPathIdRef.current === erasedId) hoveredPathIdRef.current = null;
        updateUndoRedo();
        redrawImmediate();
        broadcastEraseElements([erasedId], []);
        scheduleAutoSave();
      }
      drawingRef.current = true;
      const moveHandler = (e: MouseEvent) => globalMouseMoveRef.current(e);
      const upHandler = () => globalMouseUpRef.current();
      globalMouseMoveRef.current = (e: MouseEvent) => draw(e as unknown as React.MouseEvent);
      globalMouseUpRef.current = () => {
        window.removeEventListener("mousemove", moveHandler);
        window.removeEventListener("mouseup", upHandler);
        stopDraw();
      };
      window.addEventListener("mousemove", moveHandler);
      window.addEventListener("mouseup", upHandler);
      return;
    }

    if (canvas && tool === "eraser" && eraserMode === "pixels") {
      const rect = canvas.getBoundingClientRect();
      const mouseX = cx - rect.left;
      const mouseY = cy - rect.top;

      const initialCount = agentsRef.current.length;
      const erasedAgents: CanvasAgent[] = [];
      agentsRef.current = agentsRef.current.filter(a => {
        const screenPos = getScreenPos(a.x, a.y);
        const dx = screenPos.x - mouseX;
        const dy = screenPos.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = (18 + eraserSize / 2) * zoomRef.current;
        const keep = distance > threshold;
        if (!keep) {
          erasedAgents.push(a);
        }
        return keep;
      });

      if (agentsRef.current.length < initialCount) {
        for (const agent of erasedAgents) {
          const idx = agentsRef.current.findIndex(a => a.instanceId === agent.instanceId);
          undoStackRef.current.push({ type: 'remove-agent', agent, index: idx < 0 ? agentsRef.current.length : idx });
        }
        redoStackRef.current = [];
        redraw();
        broadcastEraseElements([], erasedAgents.map(a => a.instanceId));
        updateUndoRedo();
        scheduleAutoSave();
      }
    }
    drawingRef.current = true;
    const activeSize = tool === "draw" ? pencilSize : tool === "arrow" ? arrowSize : tool === "eraser" ? eraserSize : 5;
    const newPath = {
      id: Math.random().toString(36).substring(2, 9),
      tool,
      color,
      points: [pos],
      thickness: activeSize,
      createdBy: myUserId
    };
    pathsRef.current.push(newPath);
    activePathIdRef.current = newPath.id;
    loadedPathIdsRef.current.add(newPath.id);
    updateUndoRedo();
    broadcastStrokeUpdate(newPath, false);

    // Attach global listeners so drawing continues outside the canvas bounds.
    // We capture the current ref values so add/remove use the same function reference.
    const moveHandler = (e: MouseEvent) => globalMouseMoveRef.current(e);
    const upHandler = () => globalMouseUpRef.current();
    globalMouseMoveRef.current = (e: MouseEvent) => draw(e as unknown as React.MouseEvent);
    globalMouseUpRef.current = () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
      stopDraw();
    };
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);
  };

  // Stable refs for global listeners
  const globalMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const globalMouseUpRef = useRef<() => void>(() => {});

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

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { canvasX: cx - rect.left, canvasY: cy - rect.top };
    }

    if (panningRef.current) {
      // Update pan ref immediately (no React re-render) for lag-free panning
      const newPan = {
        x: cx - panStartRef.current.x,
        y: cy - panStartRef.current.y
      };
      panRef.current = newPan;
      pendingPanFlushRef.current = true;
      // Schedule a redraw via RAF instead of setState
      if (pendingRedrawRef !== null) cancelAnimationFrame(pendingRedrawRef);
      pendingRedrawRef = requestAnimationFrame(() => {
        pendingRedrawRef = null;
        redrawImmediate();
      });
      return;
    }

    const pos = getPos(e);

    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      // ── Collaboration: Broadcast cursor position ──
      if (isSupabaseConfigured && channelRef.current) {
        const now = Date.now();
        if (now - lastCursorBroadcastTimeRef.current > 80) {
          channelRef.current.send({
            type: "broadcast",
            event: "cursor-move",
            payload: {
              userId: myUserId,
              userName: myUserName,
              userColor: myPlayerColor,
              x: pos.x,
              y: pos.y,
              canvasX: cx - rect.left,
              canvasY: cy - rect.top
            }
          });
          lastCursorBroadcastTimeRef.current = now;
        }
      }

      if (customCursorRef.current) {
        if (tool === "eraser" && !panningRef.current) {
          const r = eraserSize * zoomRef.current;
          customCursorRef.current.style.display = "block";
          customCursorRef.current.style.width = `${r}px`;
          customCursorRef.current.style.height = `${r}px`;
          customCursorRef.current.style.left = `${cx - rect.left}px`;
          customCursorRef.current.style.top = `${cy - rect.top}px`;
        } else {
          customCursorRef.current.style.display = "none";
        }
      }

      if (tool === "select") {
        if (draggedAgentRef.current) {
          canvas.style.cursor = "grabbing";
          if (hoveredAgentRef.current) {
             hoveredAgentRef.current = null;
             setHoverMenuState(prev => ({ ...prev, visible: false }));
          }
        } else {
          const mouseX = cx - rect.left;
          const mouseY = cy - rect.top;
          let foundHoverAgent: CanvasAgent | null = null;
          const isOverAgent = agentsRef.current.some(a => {
            const screenPos = getScreenPos(a.x, a.y);
            const dx = screenPos.x - mouseX;
            const dy = screenPos.y - mouseY;
            const hit = Math.sqrt(dx * dx + dy * dy) <= 18 * zoomRef.current;
            if (hit) foundHoverAgent = a;
            return hit;
          });

          if (foundHoverAgent) {
            if (isAgentDroppedRef.current) {
              // Ignore hover immediately after dropping
            } else {
              if (hoverMenuTimeoutRef.current) clearTimeout(hoverMenuTimeoutRef.current);
              hoverMenuTimeoutRef.current = null;
              if (hoveredAgentRef.current !== foundHoverAgent) {
                hoveredAgentRef.current = foundHoverAgent;
                const screenPos = getScreenPos((foundHoverAgent as CanvasAgent).x, (foundHoverAgent as CanvasAgent).y);
                setHoverMenuState({ 
                  agent: foundHoverAgent, 
                  x: screenPos.x + rect.left, 
                  y: screenPos.y + rect.top, 
                  visible: true 
                });
              }
            }
          } else {
            isAgentDroppedRef.current = false;
            if (!hoverMenuTimeoutRef.current && hoveredAgentRef.current) {
              hoverMenuTimeoutRef.current = setTimeout(() => {
                hoveredAgentRef.current = null;
                setHoverMenuState(prev => ({ ...prev, visible: false }));
                hoverMenuTimeoutRef.current = null;
              }, 300);
            }
          }

          canvas.style.cursor = isOverAgent ? "pointer" : "default";
        }
      } else if (tool === "eraser" && eraserMode === "lines") {
        const mapImg = mapImgRef.current;
        let scale = 1;
        if (mapImg && mapImg.complete) {
          const rotatedW = mapImg.height;
          const rotatedH = mapImg.width;
          scale = Math.min(canvas.width / rotatedW, canvas.height / rotatedH);
        }
        const hitRadius = (eraserSize / 2) / (zoomRef.current * scale);
        const pos2 = getPos(e);
        const hit = findPathAtPoint(pos2.x, pos2.y, hitRadius);
        hoveredPathIdRef.current = hit ? hit.id : null;

        // Check if cursor is over an agent
        const hitAgent = agentsRef.current.find(a => {
          const screenPos = getScreenPos(a.x, a.y);
          const dx = screenPos.x - (cx - canvas.getBoundingClientRect().left);
          const dy = screenPos.y - (cy - canvas.getBoundingClientRect().top);
          return Math.sqrt(dx * dx + dy * dy) <= (18 + eraserSize / 2) * zoomRef.current;
        });

        canvas.style.cursor = (hit || hitAgent) ? "pointer" : "none";

        // If dragging (mousedown held), erase paths and agents under cursor
        if (drawingRef.current) {
          if (hit) {
            const erasedId = hit.id;
            const erasedIdx = pathsRef.current.findIndex(p => p.id === erasedId);
            const erasedPath = pathsRef.current.find(p => p.id === erasedId)!;
            undoStackRef.current.push({ type: 'remove-path', path: erasedPath, index: erasedIdx });
            redoStackRef.current = [];
            pathsRef.current = pathsRef.current.filter(p => p.id !== erasedId);
            hoveredPathIdRef.current = null;
            updateUndoRedo();
            redrawImmediate();
            broadcastEraseElements([erasedId], []);
            scheduleAutoSave();
          }
          if (hitAgent) {
            const agentIdx = agentsRef.current.findIndex(a => a.instanceId === hitAgent.instanceId);
            undoStackRef.current.push({ type: 'remove-agent', agent: hitAgent, index: agentIdx });
            redoStackRef.current = [];
            agentsRef.current = agentsRef.current.filter(a => a.instanceId !== hitAgent.instanceId);
            updateUndoRedo();
            redrawImmediate();
            broadcastEraseElements([], [hitAgent.instanceId]);
            scheduleAutoSave();
          }
        }
      }
    }

    if (drawingRef.current && tool === "eraser" && eraserMode === "pixels" && canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = cx - rect.left;
      const mouseY = cy - rect.top;

      const initialCount = agentsRef.current.length;
      const erasedAgents: CanvasAgent[] = [];
      agentsRef.current = agentsRef.current.filter(a => {
        const screenPos = getScreenPos(a.x, a.y);
        const dx = screenPos.x - mouseX;
        const dy = screenPos.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = (18 + eraserSize / 2) * zoomRef.current;
        const keep = distance > threshold;
        if (!keep) {
          erasedAgents.push(a);
        }
        return keep;
      });

      if (agentsRef.current.length < initialCount) {
        for (const agent of erasedAgents) {
          const idx = agentsRef.current.findIndex(a => a.instanceId === agent.instanceId);
          undoStackRef.current.push({ type: 'remove-agent', agent, index: idx < 0 ? agentsRef.current.length : idx });
        }
        redoStackRef.current = [];
        redraw();
        broadcastEraseElements([], erasedAgents.map(a => a.instanceId));
        updateUndoRedo();
        scheduleAutoSave();
      }
    }

    if (tool === "select") {
      if (draggedAgentRef.current) {
        draggedAgentRef.current.x = pos.x;
        draggedAgentRef.current.y = pos.y;
        redraw();
        const now = Date.now();
        if (now - lastAgentBroadcastTimeRef.current > 80) {
          broadcastAgentUpdate(draggedAgentRef.current, true);
          lastAgentBroadcastTimeRef.current = now;
        }
      }
      return;
    }
    if (!drawingRef.current) {
      return;
    }
    const activePath = pathsRef.current.find(p => p.id === activePathIdRef.current);
    if (!activePath) {
      return;
    }
    activePath.points.push(pos);
    redraw();
    const now = Date.now();
    if (now - lastStrokeBroadcastTimeRef.current > 80) {
      broadcastStrokeUpdate(activePath, false);
      lastStrokeBroadcastTimeRef.current = now;
    }
  };

  const stopDraw = () => {
    if (panningRef.current) {
      panningRef.current = false;
      if (pendingPanFlushRef.current) {
        pendingPanFlushRef.current = false;
        setPan({ ...panRef.current });
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const toolCursor =
          tool === "eraser" ? "none" :
          tool === "select" ? "default" :
          "crosshair";
        canvas.style.cursor = toolCursor;
      }
      return;
    }
    if (tool === "eraser" && eraserMode === "lines") {
      drawingRef.current = false;
      return;
    }
    const wasDrawing = drawingRef.current;
    const wasDragging = !!draggedAgentRef.current;

    if (wasDrawing) {
      drawingRef.current = false;
      const activePath = pathsRef.current.find(p => p.id === activePathIdRef.current);
      if (activePath) {
        undoStackRef.current.push({ type: 'add-path', path: activePath });
        redoStackRef.current = [];
        broadcastStrokeUpdate(activePath, true);
        loadedPathIdsRef.current.add(activePath.id);
        updateUndoRedo();
        scheduleAutoSave();
      }
      activePathIdRef.current = null;
    }

    if (wasDragging && draggedAgentRef.current) {
      const agent = draggedAgentRef.current;
      const oldPos = draggedAgentOldPosRef.current;
      const clickStart = agentClickStartRef.current;
      draggedAgentRef.current = null;
      draggedAgentOldPosRef.current = null;
      agentClickStartRef.current = null;
      const canvas = canvasRef.current;
      if (canvas && tool === "select") {
        canvas.style.cursor = "default";
      }
      if (clickStart && oldPos) {
        const dx = agent.x - oldPos.x;
        const dy = agent.y - oldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 2) {
          isAgentDroppedRef.current = true;
          undoStackRef.current.push({ type: 'move-agent', agentId: agent.instanceId, oldX: oldPos.x, oldY: oldPos.y, newX: agent.x, newY: agent.y });
          redoStackRef.current = [];
          updateUndoRedo();
        } else {
          isAgentDroppedRef.current = false;
          hoveredAgentRef.current = agent;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const screenPos = getScreenPos(agent.x, agent.y);
            setHoverMenuState({
              agent,
              x: screenPos.x + rect.left,
              y: screenPos.y + rect.top,
              visible: true
            });
          }
        }
      }
      broadcastAgentUpdate(agent, false);
      loadedAgentIdsRef.current.add(agent.instanceId);
      scheduleAutoSave();
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
    const newAgent = {
      instanceId: Math.random().toString(36).substring(2, 9),
      id: a.id,
      x: -50 + Math.random() * 100,
      y: -50 + Math.random() * 100,
      team: activeTeam,
      createdBy: myUserId
    };
    undoStackRef.current.push({ type: 'add-agent', agent: newAgent });
    redoStackRef.current = [];
    agentsRef.current.push(newAgent);
    loadedAgentIdsRef.current.add(newAgent.instanceId);
    redraw();
    broadcastAgentUpdate(newAgent, false);
    updateUndoRedo();
    scheduleAutoSave();
    setTool("select");
  };

  const handleAgentDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData("text/plain", agentId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setDragImage(e.currentTarget as Element, 20, 20);
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
      const newAgent = {
        instanceId: Math.random().toString(36).substring(2, 9),
        id: agent.id,
        x: pos.x,
        y: pos.y,
        team: activeTeam,
        createdBy: myUserId
      };
      agentsRef.current.push(newAgent);
      loadedAgentIdsRef.current.add(newAgent.instanceId);
      undoStackRef.current.push({ type: 'add-agent', agent: newAgent });
      redoStackRef.current = [];
      redraw();
      broadcastAgentUpdate(newAgent, false);
      updateUndoRedo();
      scheduleAutoSave();
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
    router.push(`?strategy=${s.id}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (typeof s.canvas_data === "string" ? JSON.parse(s.canvas_data || "{}") : s.canvas_data || {}) as any;
      syncCanvasLocalState(d.paths || [], d.agents || []);

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
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateUndoRedo();
    lastSavedAtRef.current = new Date().toISOString();
    setView("editor");
  };

  // 2. Save Strategy Canvas Mutation
  const saveStrategyMutation = useMutation({
    mutationFn: async (overrideSide?: "attack" | "defense") => {
      if (!current) return;
      const sideToSave = overrideSide || current.side;
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          name: current.name,
          side: sideToSave,
          description: current.description,
          canvas_data: {
            paths: pathsRef.current,
            agents: agentsRef.current,
            clientKnownPathIds: Array.from(loadedPathIdsRef.current),
            clientKnownAgentIds: Array.from(loadedAgentIdsRef.current)
          }
        })
      });
      if (!res.ok) throw new Error("Error saving strategy canvas");
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data && data.updated_at) {
        lastSavedAtRef.current = data.updated_at;
      }
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
    }
  });

  const saveStrategy = useCallback(() => {
    if (saveStrategyMutation.isPending) {
      scheduleAutoSave();
      return;
    }
    saveStrategyMutation.mutate(undefined);
  }, [saveStrategyMutation, scheduleAutoSave]);

  // ── Collaboration: Wire up auto-save ref ──
  useEffect(() => {
    scheduleAutoSaveRef.current = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        if (current) {
          saveStrategy();
        }
      }, 1000);
    };
  }, [current, saveStrategy, scheduleAutoSave]);

  // ── Collaboration: Main real-time useEffect ──
  useEffect(() => {
    if (view !== "editor" || !current || !myUserId) return;

    const strategyId = current.id;

    // ── Supabase Realtime Mode ──
    if (isSupabaseConfigured) {
      const channel = supabase.channel(`strategy:${strategyId}`, {
        config: { presence: { key: myUserId } }
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const users: CollabUser[] = [];
          for (const key of Object.keys(state)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const presences = state[key] as any[];
            if (presences.length > 0) {
              users.push({
                userId: key,
                userName: presences[0].userName || "Anónimo",
                userColor: presences[0].userColor || "#FF4655"
              });
            }
          }
          setCollabUsers(users);
        })
        .on("broadcast", { event: "cursor-move" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          setRemoteCursors(prev => {
            const next = new Map(prev);
            next.set(payload.userId, {
              userId: payload.userId,
              userName: payload.userName,
              userColor: payload.userColor,
              x: payload.x,
              y: payload.y,
              canvasX: payload.canvasX,
              canvasY: payload.canvasY
            });
            return next;
          });
        })
        .on("broadcast", { event: "canvas-update" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          syncCanvasLocalState(payload.paths || [], payload.agents || []);
          redraw();
          updateUndoRedo();
        })
        .on("broadcast", { event: "draw-stroke" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          const remotePath = payload.path;
          if (!remotePath) return;

          const idx = pathsRef.current.findIndex(p => p.id === remotePath.id);
          if (idx !== -1) {
            pathsRef.current[idx] = remotePath;
          } else {
            pathsRef.current.push(remotePath);
          }

          if (payload.finished) {
            loadedPathIdsRef.current.add(remotePath.id);
            updateUndoRedo();
          }
          redraw();
        })
        .on("broadcast", { event: "drag-agent" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          const remoteAgent = payload.agent;
          if (!remoteAgent) return;

          const idx = agentsRef.current.findIndex(a => a.instanceId === remoteAgent.instanceId);
          if (idx !== -1) {
            agentsRef.current[idx] = remoteAgent;
          } else {
            agentsRef.current.push(remoteAgent);
            if (!agentImgsRef.current.has(remoteAgent.id)) {
              const agentObj = findAgent(remoteAgent.id);
              if (agentObj) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = agentObj.displayIcon;
                img.onload = () => {
                  agentImgsRef.current.set(remoteAgent.id, img);
                  redraw();
                };
                agentImgsRef.current.set(remoteAgent.id, img);
              }
            }
          }

          if (!payload.dragging) {
            loadedAgentIdsRef.current.add(remoteAgent.instanceId);
          }
          redraw();
        })
        .on("broadcast", { event: "erase-elements" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          const { erasedPathIds, erasedAgentIds } = payload;

          if (erasedPathIds && erasedPathIds.length > 0) {
            const toRemove = new Set(erasedPathIds);
            pathsRef.current = pathsRef.current.filter(p => !toRemove.has(p.id));
            erasedPathIds.forEach((id: string) => loadedPathIdsRef.current.delete(id));
          }

          if (erasedAgentIds && erasedAgentIds.length > 0) {
            const toRemove = new Set(erasedAgentIds);
            agentsRef.current = agentsRef.current.filter(a => !toRemove.has(a.instanceId));
            erasedAgentIds.forEach((id: string) => loadedAgentIdsRef.current.delete(id));
          }

          redraw();
          updateUndoRedo();
        })
        .on("broadcast", { event: "canvas-clear" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          pathsRef.current = [];
          agentsRef.current = [];
          loadedPathIdsRef.current.clear();
          loadedAgentIdsRef.current.clear();
          redraw();
          updateUndoRedo();
        })
        .on("broadcast", { event: "side-change" }, ({ payload }) => {
          if (!payload || payload.userId === myUserId) return;
          setSelectedSide(payload.side);
          setCurrent(prev => prev ? { ...prev, side: payload.side } : prev);
          redraw();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              userName: myUserName,
              userColor: myPlayerColor,
              online_at: new Date().toISOString()
            });
          }
        });

      channelRef.current = channel;

      return () => {
        channel.untrack();
        supabase.removeChannel(channel);
        channelRef.current = null;
        setCollabUsers([]);
        setRemoteCursors(new Map());
      };
    }

    // ── Polling Fallback Mode ──
    // Heartbeat: register presence every 5s
    const heartbeat = async () => {
      try {
        const res = await fetch("/api/strategies/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategyId })
        });
        if (res.ok) {
          const data = await res.json();
          setCollabUsers((data.users || []).map((u: CollabUser) => ({
            userId: u.userId,
            userName: u.userName,
            userColor: u.userColor
          })));
        }
      } catch { /* ignore */ }
    };
    heartbeat();
    const heartbeatInterval = setInterval(heartbeat, 5000);

    // Poll for remote canvas updates every 4s
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/strategies?id=${strategyId}`);
        if (!res.ok) return;
        const data = await res.json();
        const remote = data.strategy;
        if (!remote) return;
        // Only apply if remote is newer than our last save
        if (lastSavedAtRef.current && remote.updated_at) {
          const remoteTime = new Date(remote.updated_at).getTime();
          const savedTime = new Date(lastSavedAtRef.current).getTime();
          if (remoteTime > savedTime && !drawingRef.current && !draggedAgentRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = (typeof remote.canvas_data === "string" ? JSON.parse(remote.canvas_data || "{}") : remote.canvas_data || {}) as any;
            syncCanvasLocalState(d.paths || [], d.agents || []);
            if (remote.side && remote.side !== selectedSide) {
              setSelectedSide(remote.side);
              setCurrent(prev => prev ? { ...prev, side: remote.side } : prev);
            }
            lastSavedAtRef.current = remote.updated_at;
            redraw();
            updateUndoRedo();
          }
        }
      } catch { /* ignore */ }
    }, 4000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollInterval);
      // Remove presence on leave
      fetch(`/api/strategies/presence?strategyId=${strategyId}`, { method: "DELETE" }).catch(() => { });
      setCollabUsers([]);
      setRemoteCursors(new Map());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, current?.id, myUserId]);

  // ── Collaboration: Clean up remote cursors that go stale ──
  useEffect(() => {
    if (remoteCursors.size === 0) return;
    const timer = setInterval(() => {
      // Just trigger a redraw so cursors stay visible
      if (view === "editor") redraw();
    }, 100);
    return () => clearInterval(timer);
  }, [remoteCursors.size, view, redraw]);

  // 3. Create Strategy Mutation
  const createStratMutation = useMutation({
    mutationFn: async (params?: { name?: string, side?: "attack" | "defense" }) => {
      const finalName = params?.name || newName.trim() || "Nueva Estrategia";
      const finalSide = params?.side || selectedSide;
      if (!selectedMap) {
        throw new Error("Sin mapa seleccionado");
      }
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map_id: selectedMap.id, name: finalName, side: finalSide })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear estrategia");
      return { id: data.id, map_id: selectedMap.id, name: finalName, side: finalSide, description: "" };
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
      openEditor({ id: data.id, map_id: data.map_id, name: data.name, side: data.side, description: "", canvas_data: "{}" });
    }
  });

  const createStrat = (e?: React.MouseEvent) => {
    if (e) {
      let x = 1;
      const existingNames = new Set(strategies.map(s => s.name));
      while (existingNames.has(`Estrategia sin nombre ${x}`)) {
        x++;
      }
      createStratMutation.mutate({ name: `Estrategia sin nombre ${x}`, side: "attack" });
    } else {
      createStratMutation.mutate(undefined);
    }
  };

  const deleteStratMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/strategies?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar estrategia");
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
    }
  });

  const updateStratMutation = useMutation({
    mutationFn: async (strat: Partial<Strategy> & { id: number }) => {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strat)
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return strat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies", selectedMap?.id] });
      setEditingExternalStratId(null);
    }
  });

  const saveExternalConfig = () => {
    if (!editingExternalStratId) return;
    updateStratMutation.mutate({
      id: editingExternalStratId,
      name: configName,
      description: configDescription,
      side: configSide,
      map_id: configMapId
    });
  };

  const colors2 = ["#FF4655", "#3B82F6", "#22C55E", "#EAB308", "#F97316", "#A855F7", "#EC4899", "#FFFFFF"];

  return (
    <div className={`strategies-container-premium ${view === "editor" ? "in-editor" : ""}`}>
      {view === "maps" && (
        <div className="header-premium">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 className="gradient-text-valorant" style={{ fontSize: 32, fontWeight: 900 }}>Centro Táctico</h1>
              <p style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                Selecciona un mapa para ver sus estrategias
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
                  onClick={(e) => createStrat(e)}
                  disabled={createStratMutation.isPending}
                >
                  {createStratMutation.isPending ? "CREANDO..." : "+ NUEVA ESTRATEGIA"}
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
                {(() => {
                  const compositions = getUniqueCompositions(strategies);
                  const compEntries = Array.from(compositions.entries());
                  
                  const filteredStrategies = compositionFilter
                    ? strategies.filter(s => getAllyComposition(s).join(',') === compositionFilter)
                    : strategies;

                  return (
                    <>
                      {compEntries.length > 0 && (
                        <div style={{ marginBottom: 24, flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 3, height: 16, background: "#00d4aa", borderRadius: 2 }} />
                            <h4 style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>
                              Filtrar por Composición
                            </h4>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              onClick={() => setCompositionFilter(null)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                background: !compositionFilter ? "rgba(0, 212, 170, 0.2)" : "rgba(255,255,255,0.05)",
                                border: !compositionFilter ? "1px solid rgba(0, 212, 170, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                                color: !compositionFilter ? "#00d4aa" : "rgba(255,255,255,0.6)",
                                transition: "all 0.2s ease"
                              }}
                            >
                              TODAS ({strategies.length})
                            </button>
                            {compEntries.map(([compKey, strats]) => {
                              const compAgents = compKey.split(',');
                              return (
                                <button
                                  key={compKey}
                                  onClick={() => setCompositionFilter(compositionFilter === compKey ? null : compKey)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 3,
                                    background: compositionFilter === compKey ? "rgba(0, 212, 170, 0.2)" : "rgba(255,255,255,0.05)",
                                    border: compositionFilter === compKey ? "1px solid rgba(0, 212, 170, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                                    color: compositionFilter === compKey ? "#00d4aa" : "rgba(255,255,255,0.6)",
                                    transition: "all 0.2s ease"
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 3 }}>
                                    {compAgents.slice(0, 3).map((agentId, idx) => {
                                      const agent = agents.find(a => a.id === agentId);
                                      if (!agent) return null;
                                      return (
                                        <img
                                          key={`${agentId}-${idx}`}
                                          src={agent.displayIcon}
                                          alt={agent.name}
                                          style={{ width: 20, height: 20, borderRadius: 4 }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                    {compAgents.slice(3, 5).map((agentId, idx) => {
                                      const agent = agents.find(a => a.id === agentId);
                                      if (!agent) return null;
                                      return (
                                        <img
                                          key={`${agentId}-${idx}`}
                                          src={agent.displayIcon}
                                          alt={agent.name}
                                          style={{ width: 20, height: 20, borderRadius: 4 }}
                                        />
                                      );
                                    })}
                                    <span style={{ marginLeft: 2, opacity: 0.7, fontSize: 10 }}>×{strats.length}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(["attack", "defense"] as const).map(side => {
                        const sideStrats = filteredStrategies.filter(s => s.side === side);
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
                              {sideStrats.map(s => {
                                const allyAgents = getAllyAgents(s);
                                return (
                                  <div key={s.id} style={{ position: "relative" }} onMouseLeave={() => setMenuOpenId(null)}>
                                    <div className={`strategy-card-premium ${s.side === "attack" ? "atk" : "def"}`} onClick={() => openEditor(s)}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <h3 className="strategy-card-title-premium" style={{ paddingRight: 30 }}>{s.name}</h3>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                                          <button 
                                            className="tool-btn-premium"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMenuOpenId(menuOpenId === s.id ? null : s.id);
                                            }}
                                            style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: menuOpenId === s.id ? "rgba(255,255,255,0.1)" : "transparent", border: "none", color: "white" }}
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="12" cy="5" r="1.5" />
                                              <circle cx="12" cy="12" r="1.5" />
                                              <circle cx="12" cy="19" r="1.5" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                      {allyAgents.length > 0 && (
                                        <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "center" }}>
                                          {allyAgents.map(ca => {
                                            const agent = agents.find(a => a.id === ca.id);
                                            if (!agent) return null;
                                            return (
                                              <img
                                                key={ca.instanceId}
                                                src={agent.displayIcon}
                                                alt={agent.name}
                                                title={agent.name}
                                                style={{ width: 32, height: 32, borderRadius: 6, border: `2px solid ${ROLE_COLORS[agent.role]}` }}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    {menuOpenId === s.id && (
                                      <div style={{ position: "absolute", top: 40, right: 12, background: "rgba(10, 14, 20, 0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: 6, zIndex: 100, display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 140 }}>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenId(null);
                                            setConfigName(s.name);
                                            setConfigSide(s.side as "attack" | "defense");
                                            setConfigDescription(s.description || "");
                                            setConfigMapId(s.map_id || selectedMap?.id || "");
                                            setEditingExternalStratId(s.id);
                                          }}
                                          style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: "8px 12px", textAlign: "left", borderRadius: 8, fontSize: 12, fontWeight: 700, transition: "all 0.2s ease" }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >
                                          Editar atributos
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenId(null);
                                            if (confirm("¿Seguro que deseas borrar esta estrategia?")) {
                                              deleteStratMutation.mutate(s.id);
                                            }
                                          }}
                                          style={{ background: "transparent", border: "none", color: "#ff4655", cursor: "pointer", padding: "8px 12px", textAlign: "left", borderRadius: 8, fontSize: 12, fontWeight: 700, transition: "all 0.2s ease" }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,70,85,0.1)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                          disabled={deleteStratMutation.isPending}
                                        >
                                          Borrar estrategia
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {!strategiesLoading && filteredStrategies.length === 0 && (
                        <EmptyState message={compositionFilter ? "No hay estrategias con esta composición." : "Aún no hay estrategias creadas para este mapa."} />
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {view === "editor" && !current && (
          <div className="editor-card-premium" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16, background: "rgba(255,255,255,0.02)" }}>
            <Skeleton width="100%" height={64} style={{ borderRadius: 16 }} />
            <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
              <Skeleton width={64} height="100%" style={{ borderRadius: 16 }} />
              <Skeleton width="100%" height="100%" style={{ borderRadius: 16, flex: 1 }} />
            </div>
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
                    <button 
                      className="tool-btn-premium"
                      onClick={() => openConfigModal()}
                      style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "none", color: "white", borderRadius: 4 }}
                      title="Editar atributos"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                      </svg>
                    </button>

                    {collabUsers.length > 1 && (
                      <span style={{
                        fontSize: 8,
                        fontWeight: 900,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(34, 197, 94, 0.15)",
                        color: "#22c55e",
                        border: "1px solid rgba(34, 197, 94, 0.3)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        animation: "pulseGlow 2s infinite"
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Auto-save Status Indicator */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  color: saveStrategyMutation.isPending ? "#eab308" : "#22c55e",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  transition: "all 0.3s ease",
                  userSelect: "none"
                }}>
                  {saveStrategyMutation.isPending ? (
                    <>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        border: "2px solid rgba(234, 179, 8, 0.2)",
                        borderTopColor: "#eab308",
                        animation: "spin 1s linear infinite"
                      }} />
                      <span style={{ color: "#eab308" }}>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22c55e",
                        boxShadow: "0 0 6px #22c55e"
                      }} />
                      <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Guardado</span>
                    </>
                  )}
                </div>

                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

                {/* ── Collaboration: Active Users Presence ── */}
                {collabUsers.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 6 }}>
                    {collabUsers.map((u, i) => (
                      <div
                        key={u.userId}
                        title={`${u.userName}${u.userId === myUserId ? " (tú)" : ""}`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: u.userColor,
                          border: u.userId === myUserId ? "2px solid #fff" : "2px solid rgba(255,255,255,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 900,
                          color: "#fff",
                          textTransform: "uppercase",
                          marginLeft: i > 0 ? -6 : 0,
                          zIndex: collabUsers.length - i,
                          position: "relative",
                          cursor: "default",
                          boxShadow: `0 0 8px ${u.userColor}55`,
                          transition: "all 0.3s ease"
                        }}
                      >
                        {u.userName[0] || "?"}
                        {/* Live pulse dot */}
                        <div style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#22c55e",
                          border: "1.5px solid #0a0e14",
                          animation: "pulseGlow 2s infinite"
                        }} />
                      </div>
                    ))}
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: 0.5,
                      marginLeft: 4,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap"
                    }}>
                      {collabUsers.length === 1 ? "Solo tú" : `${collabUsers.length} editando`}
                    </span>
                  </div>
                )}

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
                    ), "Borrador"]
                  ] as [Tool, React.ReactNode, string][]).map(([t, icon, label]) => (
                    <button key={t} className={`tool-btn-premium ${tool === t ? "active" : ""}`} onClick={() => { setTool(t); hoveredPathIdRef.current = null; }} title={label} style={{ width: '100%', height: 38, justifyContent: 'center' }}>
                      {icon}
                    </button>
                  ))}
                </div>

                {/* Tool-specific params: draw & arrow */}
                {(tool === "draw" || tool === "arrow") && (
                  <>
                    <div className="color-palette-premium-vertical">
                      {colors2.map(c => (
                        <button key={c} className={`color-orb-premium ${color === c ? "active" : ""}`} style={{ background: c, "--orb-glow": c, width: 18, height: 18 } as React.CSSProperties} onClick={() => { setColor(c); setShowColorPicker(false); }}>
                          {color === c && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                        </button>
                      ))}
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase" }}>Grosor</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                        {[2, 5, 10, 18].map(size => {
                          const activeSize = tool === "draw" ? pencilSize : arrowSize;
                          const isActive = activeSize === size;
                          const dotSize = Math.max(4, Math.min(16, size * 0.9));
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => { if (tool === "draw") setPencilSize(size); else setArrowSize(size); }}
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

                {/* Tool-specific params: eraser */}
                {tool === "eraser" && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase" }}>Modo</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                        <button
                          type="button"
                          onClick={() => setEraserMode("pixels")}
                          className={`tool-btn-premium ${eraserMode === "pixels" ? "active" : ""}`}
                          title="Borrar píxeles en un radio"
                          style={{ 
                            width: "100%", 
                            height: 28, 
                            fontSize: 10, 
                            fontWeight: 700, 
                            justifyContent: "center",
                            border: eraserMode !== "pixels" ? "1px solid rgba(255,255,255,0.06)" : undefined
                          }}
                        >
                          Píxeles
                        </button>
                        <button
                          type="button"
                          onClick={() => setEraserMode("lines")}
                          className={`tool-btn-premium ${eraserMode === "lines" ? "active" : ""}`}
                          title="Borrar trazos y agentes enteros"
                          style={{ 
                            width: "100%", 
                            height: 28, 
                            fontSize: 10, 
                            fontWeight: 700, 
                            justifyContent: "center",
                            border: eraserMode !== "lines" ? "1px solid rgba(255,255,255,0.06)" : undefined
                          }}
                        >
                          Trazos
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase" }}>Grosor</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                        {[10, 20, 45, 80].map(size => {
                          const isActive = eraserSize === size;
                          const dotSize = Math.max(4, Math.min(16, size / 4));
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setEraserSize(size)}
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

                {/* Spacer */}
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

                  {/* Borrar Todo */}
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
                      color: "#ff4655",
                      opacity: (pathsRef.current.length > 0 || agentsRef.current.length > 0) ? 1 : 0.35,
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => {
                      if (window.confirm("¿Borrar todo el lienzo? Esta acción no se puede deshacer.")) {
                        clearAll();
                      }
                    }}
                    title="Borrar todo el lienzo"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    <span style={{ fontSize: 8, marginTop: 4, letterSpacing: 0.5, fontWeight: 700 }}>BORRAR TODO</span>
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
              <div className="canvas-wrap-premium" style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
                <canvas ref={canvasRef} style={{ display: "block", cursor: tool === "select" ? "default" : tool === "eraser" ? "none" : "crosshair", touchAction: "none", width: "100%", height: "100%" }}
                  onMouseDown={(e) => { if (hoverMenuState?.visible) setHoverMenuState(prev => ({ ...prev, visible: false })); startDraw(e); }} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={() => { mousePosRef.current = null; hoveredPathIdRef.current = null; if (customCursorRef.current) customCursorRef.current.style.display = "none"; redrawImmediate(); }}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                  onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
                  onContextMenu={e => { e.preventDefault(); if (hoverMenuState?.visible) setHoverMenuState(prev => ({ ...prev, visible: false })); }} />

                <div
                  ref={customCursorRef}
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    border: "1.5px solid rgba(255,255,255,0.8)",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.3) inset, 0 0 0 1px rgba(0,0,0,0.3)",
                    borderRadius: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "none",
                    zIndex: 10,
                  }}
                />

                {/* Tool Guide */}
                <div style={{
                  position: "absolute",
                  top: 24,
                  right: 24,
                  maxWidth: 220,
                  textAlign: "right",
                  pointerEvents: "none",
                  zIndex: 5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    color: "rgba(255,255,255,0.45)"
                  }}>
                    {tool === "select" ? "Seleccionar" :
                     tool === "draw" ? "Lápiz" :
                     tool === "arrow" ? "Vector" :
                     tool === "eraser" ? "Borrador" :
                     tool === "line-eraser" ? "Borrador de clic" : ""}
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                    lineHeight: 1.4,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)"
                  }}>
                    {(() => {
                      const IconLeftClick = (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                          <rect x="5" y="2" width="14" height="20" rx="7" />
                          <path d="M12 2v7" />
                          <path d="M5 9h14" />
                          <path d="M5 9C5 5.13 8.13 2 12 2v7H5z" fill="currentColor" opacity="0.8" stroke="none" />
                        </svg>
                      );
                      const IconRightClick = (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                          <rect x="5" y="2" width="14" height="20" rx="7" />
                          <path d="M12 2v7" />
                          <path d="M5 9h14" />
                          <path d="M19 9C19 5.13 15.87 2 12 2v7h7z" fill="currentColor" opacity="0.8" stroke="none" />
                        </svg>
                      );
                      const MoveIcon = (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                          <polyline points="5 9 2 12 5 15"/>
                          <polyline points="9 5 12 2 15 5"/>
                          <polyline points="19 9 22 12 19 15"/>
                          <polyline points="9 19 12 22 15 19"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <line x1="12" y1="2" x2="12" y2="22"/>
                        </svg>
                      );
                      const Item = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
                        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", textAlign: "left" }}>
                          <div style={{ color: "rgba(255,255,255,0.3)" }}>{icon}</div>
                          <span>{text}</span>
                        </div>
                      );

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {tool === "select" && <Item icon={IconLeftClick} text="Clic izquierdo para arrastrar agentes" />}
                          {tool === "draw" && <Item icon={IconLeftClick} text="Clic izquierdo para dibujar a mano alzada" />}
                          {tool === "arrow" && <Item icon={IconLeftClick} text="Clic izquierdo para dibujar flechas rectas" />}
                          {tool === "eraser" && eraserMode === "pixels" && <Item icon={IconLeftClick} text="Clic izquierdo para eliminar en un radio" />}
                          {tool === "eraser" && eraserMode === "lines" && <Item icon={IconLeftClick} text="Clic izquierdo para borrar trazos o agentes" />}
                          <Item icon={IconRightClick} text="Clic derecho para mover la cámara" />
                        </div>
                      );
                    })()}
                  </div>
                </div>

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
                      onClick={() => {
                        const newSide = "attack";
                        setSelectedSide(newSide);
                        setCurrent(prev => prev ? { ...prev, side: newSide } : prev);
                        saveStrategyMutation.mutate(newSide);
                        if (channelRef.current) {
                          channelRef.current.send({
                            type: "broadcast",
                            event: "side-change",
                            payload: { userId: myUserId, side: newSide }
                          });
                        }
                      }}
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
                      onClick={() => {
                        const newSide = "defense";
                        setSelectedSide(newSide);
                        setCurrent(prev => prev ? { ...prev, side: newSide } : prev);
                        saveStrategyMutation.mutate(newSide);
                        if (channelRef.current) {
                          channelRef.current.send({
                            type: "broadcast",
                            event: "side-change",
                            payload: { userId: myUserId, side: newSide }
                          });
                        }
                      }}
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
              {/* Team toggle */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                <button
                  onClick={() => setActiveTeam("ally")}
                  className={`team-toggle-btn ${activeTeam === "ally" ? "active" : ""}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    background: activeTeam === "ally" ? "rgba(0, 212, 170, 0.08)" : "rgba(255, 255, 255, 0.01)",
                    border: activeTeam === "ally" ? "1px solid rgba(0, 212, 170, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    height: 58,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxSizing: "border-box",
                    color: activeTeam === "ally" ? "#00d4aa" : "rgba(255,255,255,0.35)"
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Aliado</span>
                </button>
                <button
                  onClick={() => setActiveTeam("enemy")}
                  className={`team-toggle-btn ${activeTeam === "enemy" ? "active" : ""}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    background: activeTeam === "enemy" ? "rgba(255, 70, 85, 0.08)" : "rgba(255, 255, 255, 0.01)",
                    border: activeTeam === "enemy" ? "1px solid rgba(255, 70, 85, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    height: 58,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxSizing: "border-box",
                    color: activeTeam === "enemy" ? "#ff4655" : "rgba(255,255,255,0.35)"
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="18" y1="8" x2="23" y2="13" />
                    <line x1="23" y1="8" x2="18" y2="13" />
                  </svg>
                  <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Enemigo</span>
                </button>
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

      {hoverMenuState.agent && (() => {
        const ctxAgent = hoverMenuState.agent;
        let screenX = hoverMenuState.x;
        let screenY = hoverMenuState.y;
        const canvas = canvasRef.current;
        if (canvas) {
          const pos = getScreenPos(ctxAgent.x, ctxAgent.y);
          screenX = pos.x + canvas.getBoundingClientRect().left;
          screenY = pos.y + canvas.getBoundingClientRect().top;
        }
        return (
          <div
            onMouseEnter={() => {
              if (hoverMenuTimeoutRef.current) clearTimeout(hoverMenuTimeoutRef.current);
              hoverMenuTimeoutRef.current = null;
              hoveredAgentRef.current = ctxAgent;
              setHoverMenuState(prev => ({ ...prev, visible: true }));
            }}
            onMouseLeave={() => {
              if (!hoverMenuTimeoutRef.current) {
                hoverMenuTimeoutRef.current = setTimeout(() => {
                  hoveredAgentRef.current = null;
                  setHoverMenuState(prev => ({ ...prev, visible: false }));
                  hoverMenuTimeoutRef.current = null;
                }, 300);
              }
            }}
            style={{
              position: "fixed",
              left: screenX,
              top: screenY,
              zIndex: 10001,
              pointerEvents: hoverMenuState.visible ? "auto" : "none",
              opacity: hoverMenuState.visible ? 1 : 0,
              transform: hoverMenuState.visible ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.95)",
              transition: "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {/* Abilities row - above agent */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -42,
                transform: "translateX(-50%)",
                display: "flex",
                gap: 4
              }}
            >
              {["Q", "E", "C", "X"].map(key => (
                <div
                  key={key}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "rgba(10, 14, 20, 0.9)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.6)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    transition: "all 0.15s ease",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                    e.currentTarget.style.background = "rgba(10, 14, 20, 0.9)";
                  }}
                >
                  {key}
                </div>
              ))}
            </div>

            {/* Delete button - over agent border */}
            <button
              onClick={e => {
                e.stopPropagation();
                const agentIdx = agentsRef.current.findIndex(a => a.instanceId === ctxAgent.instanceId);
                undoStackRef.current.push({ type: 'remove-agent', agent: ctxAgent, index: agentIdx });
                redoStackRef.current = [];
                agentsRef.current = agentsRef.current.filter(a => a.instanceId !== ctxAgent.instanceId);
                updateUndoRedo();
                redraw();
                broadcastEraseElements([], [ctxAgent.instanceId]);
                scheduleAutoSave();
                setHoverMenuState(prev => ({ ...prev, visible: false }));
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: 14,
                transform: "translateX(-50%)",
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(255, 70, 85, 0.9)",
                border: "2px solid rgba(10, 14, 20, 0.8)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(255, 70, 85, 0.5)",
                zIndex: 10001,
                lineHeight: 1,
                padding: 0
              }}
            >
              ×
            </button>
          </div>
        );
      })()}

      {editingExternalStratId && (
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

            <div style={{ marginBottom: 16 }}>
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

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Cambiar Mapa</label>
              <select
                className="input-premium"
                value={configMapId}
                onChange={e => setConfigMapId(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {allMaps.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.activeInRotation ? " ★" : ""}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 4, display: 'block' }}>
                ★ = En rotación activa.
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" style={{ borderRadius: 10 }} onClick={() => setEditingExternalStratId(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ borderRadius: 10, padding: "10px 20px" }} onClick={saveExternalConfig} disabled={updateStratMutation.isPending}>
                {updateStratMutation.isPending ? "Guardando..." : "Guardar"}
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

            <div style={{ marginBottom: 16 }}>
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

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Cambiar Mapa</label>
              <select
                className="input-premium"
                value={configMapId}
                onChange={e => setConfigMapId(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {allMaps.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.activeInRotation ? " ★" : ""}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 4, display: 'block' }}>
                ★ = En rotación activa. Cambiar el mapa no borra el trazado.
              </span>
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
