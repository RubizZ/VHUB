"use client";
import NextImage from "next/image";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentSkillsManager } from "@/components/AgentSkillsManager";
import { useSession } from "next-auth/react";
import { type ValorantMap } from "@/lib/domain/maps";
import {
    ROLE_COLORS,
    type ValorantAgent,
    type AgentRole,
    type AgentSkill,
    type SkillGeometry,
    type DeploymentMechanics,
    type LifetimeMechanics,
    type ResolutionMechanics,
} from "@/lib/domain/agents";
import {
    type ValorantWeapon,
    WEAPON_CATEGORY_LABELS,
} from "@/lib/domain/weapons";
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
    userImage?: string | null;
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
    team?: "ally" | "enemy";
    weaponId?: string;
    activeBuffs?: string[];
    createdBy?: string;
    draggedBy?: string;
}

interface CanvasSkill {
    instanceId: string;
    agentInstanceId: string;
    key: string;
    x: number;
    y: number;
    targetX?: number;
    targetY?: number;
    projectileMode?: "bounce" | "parabola";
    isActive?: boolean;
    pathPoints?: { x: number; y: number }[]; // Para habilidades tipo "groundPath" con controllable
    color: string;
    createdBy?: string;
    unlinked?: boolean;
    customRotation?: number;
    draggedBy?: string;
    deployment?: DeploymentMechanics | null;
    lifetime?: LifetimeMechanics | null;
    resolution?: ResolutionMechanics | null;
}

type UndoAction =
    | { type: "add-path"; path: CanvasPath }
    | { type: "remove-path"; path: CanvasPath; index: number }
    | { type: "add-agent"; agent: CanvasAgent }
    | {
          type: "remove-agent";
          agent: CanvasAgent;
          index: number;
          linkedSkills?: { skill: CanvasSkill; index: number }[];
      }
    | {
          type: "move-agent";
          agentId: string;
          oldX: number;
          oldY: number;
          newX: number;
          newY: number;
      }
    | { type: "add-skill"; skill: CanvasSkill }
    | { type: "remove-skill"; skill: CanvasSkill; index: number }
    | {
          type: "clear-all";
          paths: CanvasPath[];
          agents: CanvasAgent[];
          skills?: CanvasSkill[];
      };

type Tool = "select" | "draw" | "arrow" | "eraser" | "skill" | "calibrate";
type View = "maps" | "strategies" | "editor";

// RAF-based redraw scheduler to avoid calling redraw multiple times per frame
let pendingRedrawRef: number | null = null;

// Helpers to eliminate 'any' casting and safely access discriminated union properties
function getCastRange(
    skill: { deployment?: DeploymentMechanics | null } | undefined,
): number {
    return skill?.deployment && "castRange" in skill.deployment
        ? skill.deployment.castRange || 0
        : 0;
}
function getProjSpeed(
    skill: { deployment?: DeploymentMechanics | null } | undefined,
): number {
    return skill?.deployment && "projectileSpeed" in skill.deployment
        ? skill.deployment.projectileSpeed || 0
        : 0;
}
function getProjMaxDist(
    skill: { deployment?: DeploymentMechanics | null } | undefined,
): number | undefined {
    return skill?.deployment && "projectileMaxDistance" in skill.deployment
        ? skill.deployment.projectileMaxDistance
        : undefined;
}
function getGeomLength(geom: SkillGeometry | undefined): number {
    return geom && "length" in geom ? geom.length || 0 : 0;
}
function getGeomWidth(geom: SkillGeometry | undefined): number {
    return geom && "width" in geom ? geom.width || 0 : 0;
}
function getGeomRadius(geom: SkillGeometry | undefined): number {
    return geom && "radius" in geom ? geom.radius || 0 : 0;
}
function getGeometry(
    skill:
        | {
              deployment?: DeploymentMechanics | null;
              lifetime?: LifetimeMechanics | null;
          }
        | undefined,
): SkillGeometry | undefined {
    if (skill?.lifetime?.geometry) return skill.lifetime.geometry;
    if (skill?.deployment && "geometry" in skill.deployment)
        return skill.deployment.geometry;
    return undefined;
}
function getDeploymentType(
    skill: { deployment?: DeploymentMechanics | null } | undefined,
): string {
    return skill?.deployment?.type || "";
}
function getAoeLength(
    skill: { deployment?: DeploymentMechanics | null } | undefined,
): number {
    // Some old skills might have used length directly. For sweeping projectiles, geometry length is used.
    if (skill?.deployment && "geometry" in skill.deployment) {
        return getGeomLength(skill.deployment.geometry);
    }
    return 0;
}

function getProjRangeAndFixed(skill: {
    deployment?: DeploymentMechanics | null;
    lifetime?: LifetimeMechanics | null;
    unlinked?: boolean;
}) {
    const isProjectileOrLine = [
        "projectile_terminal_aoe",
        "projectile_sweeping",
        "projectile_sweeping",
    ].includes(getDeploymentType(skill) as string);
    let isFixed = isProjectileOrLine;
    if (
        getDeploymentType(skill) === "projectile_terminal_aoe" &&
        skill.deployment &&
        "variableDistance" in skill.deployment &&
        skill.deployment.variableDistance
    ) {
        isFixed = false;
    }
    let maxRange = 0;

    if (
        getDeploymentType(skill) === "projectile_sweeping" &&
        (getProjMaxDist(skill) === 0 || getProjMaxDist(skill) === undefined)
    ) {
        maxRange = getProjSpeed(skill) * (skill?.lifetime?.duration || 0);
    } else {
        maxRange = getProjMaxDist(skill) || 0;
    }

    if (
        [
            "projectile_terminal_aoe",
            "projectile_sweeping",
            "linear_wall",
            "self_mobile_aura",
            "static_deployable",
            "equip_weapon",
            "dash_teleport",
            "self_instant",
        ].includes(skill?.deployment?.type as string) &&
        skill.deployment?.windup &&
        !skill.unlinked
    ) {
        maxRange += skill.deployment?.windup;
    }

    return { maxRange, isFixed };
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return { h: 0, s: 100, l: 50 };
    }

    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h = 0,
        s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function hslToHSV(
    h: number,
    s: number,
    l: number,
): { h: number; s: number; v: number } {
    const l_fraction = l / 100;
    const s_fraction = s / 100;
    const v = l_fraction + s_fraction * Math.min(l_fraction, 1 - l_fraction);
    const newS = v === 0 ? 0 : 2 * (1 - l_fraction / v);
    return {
        h,
        s: Math.round(newS * 100),
        v: Math.round(v * 100),
    };
}

function hsvToHSL(
    h: number,
    s: number,
    v: number,
): { h: number; s: number; l: number } {
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
        l: Math.round(l * 100),
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
    const [selectedMap, setSelectedMap] = useState<
        (ValorantMap & { activeInRotation?: boolean }) | null
    >(null);
    const [current, setCurrent] = useState<Strategy | null>(null);
    const [selectedSide, setSelectedSide] = useState<"attack" | "defense">(
        "attack",
    );
    const [tool, setTool] = useState<Tool>("select");
    const [color, setColor] = useState("#FF4655");
    const [activeTeam, setActiveTeam] = useState<"ally" | "enemy">("ally");

    const [activeRole, setActiveRole] = useState<AgentRole | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [compositionFilter, setCompositionFilter] = useState<string | null>(
        null,
    );
    const [hoverMenuState, setHoverMenuState] = useState<{
        agent: CanvasAgent | null;
        skill: CanvasSkill | null;
        anchor?: "start" | "target";
        x: number;
        y: number;
        visible: boolean;
    }>({ agent: null, skill: null, x: 0, y: 0, visible: false });
    const hoverMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const hoveredAgentRef = useRef<CanvasAgent | null>(null);
    const hoveredSkillRef = useRef<CanvasSkill | null>(null);
    const hoveredSkillAnchorRef = useRef<"start" | "target" | null>(null);
    const isAgentDroppedRef = useRef<boolean>(false);

    // Strategy Settings States
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configName, setConfigName] = useState("");
    const [configSide, setConfigSide] = useState<"attack" | "defense">(
        "attack",
    );
    const [configDescription, setConfigDescription] = useState("");
    const [configMapId, setConfigMapId] = useState("");

    // Brush Size States
    const [pencilSize, setPencilSize] = useState<number>(5);
    const [projectileMode] = useState<"bounce" | "parabola">("bounce");
    const [arrowSize, setArrowSize] = useState<number>(5);
    const [eraserSize, setEraserSize] = useState<number>(20);
    const [eraserMode, setEraserMode] = useState<"pixels" | "lines">("pixels");
    const eraserSizeRef = useRef<number>(20);

    const [calibrateState, setCalibrateState] = useState<{
        step: "start" | "end";
        startPos: { x: number; y: number } | null;
        showModal: boolean;
        distancePx: number;
    }>({ step: "start", startPos: null, showModal: false, distancePx: 0 });
    const [calibrateMetersInput, setCalibrateMetersInput] = useState("");
    const calibrateStateRef = useRef<{
        step: "start" | "end";
        startPos: { x: number; y: number } | null;
    }>({ step: "start", startPos: null });
    const worldMousePosRef = useRef<{ x: number; y: number } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const drawingRef = useRef(false);
    const draggedAgentRef = useRef<CanvasAgent | null>(null);
    const draggedAgentOldPosRef = useRef<{ x: number; y: number } | null>(null);
    const draggedSkillRef = useRef<CanvasSkill | null>(null);
    const draggedSkillOffsetRef = useRef<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });
    const draggedSkillTargetRef = useRef<CanvasSkill | null>(null);
    const draggedSkillPathPointIndexRef = useRef<number | null>(null);
    const isPlacingSecondPointRef = useRef<boolean>(false);
    const isPlacingMultiDisplacementRef = useRef<boolean>(false);
    const draggedSkillRotationRef = useRef<CanvasSkill | null>(null);
    const dragHoveredLinkAgentRef = useRef<CanvasAgent | null>(null);
    const agentClickStartRef = useRef<{ x: number; y: number } | null>(null);
    const pathsRef = useRef<CanvasPath[]>([]);
    const agentsRef = useRef<CanvasAgent[]>([]);
    const skillsRef = useRef<CanvasSkill[]>([]);
    const pendingSkillRef = useRef<{
        agentInstanceId: string;
        skill: AgentSkill;
        color: string;
    } | null>(null);
    const loadedSkillIdsRef = useRef<Set<string>>(new Set());
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
    const [remoteCursors, setRemoteCursors] = useState<
        Map<string, RemoteCursor>
    >(new Map());
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const lastSavedAtRef = useRef<string | null>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastCursorBroadcastTimeRef = useRef<number>(0);
    const lastStrokeBroadcastTimeRef = useRef<number>(0);
    const lastAgentBroadcastTimeRef = useRef<number>(0);
    const lastSkillBroadcastTimeRef = useRef<number>(0);
    const activePathIdRef = useRef<string | null>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const customCursorRef = useRef<HTMLDivElement | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [editingExternalStratId, setEditingExternalStratId] = useState<
        number | null
    >(null);
    const [editingSkillGlobalParams, setEditingSkillGlobalParams] = useState<{
        agentId: string;
        skillKey: string;
    } | null>(null);
    const [createModalState, setCreateModalState] = useState<{
        isOpen: boolean;
        defaultName: string;
        side: "attack" | "defense";
        mapId: string;
    } | null>(null);
    const myUserId = session?.user?.id || "";
    const myUserName = session?.user?.name || "Anónimo";
    const myUserImage = session?.user?.image || null;
    const myPlayerColor =
        (session?.user as { avatarColor?: string })?.avatarColor || "#FF4655";

    useEffect(() => {
        if (isDraggingColor) return;
        let hVal = 0,
            sVal = 100,
            lVal = 50;
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
                updateColor(
                    moveEvent.touches[0].clientX,
                    moveEvent.touches[0].clientY,
                );
            }
        };

        const handleTouchEnd = () => {
            setIsDraggingColor(false);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
        };

        window.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        window.addEventListener("touchend", handleTouchEnd);
    };

    const mapImgRef = useRef<HTMLImageElement | null>(null);
    const agentImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const weaponImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const skillImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const loadedPathIdsRef = useRef<Set<string>>(new Set());
    const loadedAgentIdsRef = useRef<Set<string>>(new Set());
    const mousePosRef = useRef<{ canvasX: number; canvasY: number } | null>(
        null,
    );
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
    const { data: strategiesData, isLoading: strategiesLoading } = useQuery<{
        strategies: Strategy[];
    }>({
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
    const { data: mapsData, isLoading: mapsLoading } = useQuery<{
        maps: (ValorantMap & { activeInRotation?: boolean })[];
    }>({
        queryKey: ["maps"],
        queryFn: async () => {
            const res = await fetch("/api/maps");
            if (!res.ok) throw new Error("Error loading maps");
            return res.json();
        },
    });

    const allMaps = mapsData?.maps || [];
    const mapsInRotation = allMaps.filter((m) => m.activeInRotation);
    const mapsOutOfRotation = allMaps.filter((m) => !m.activeInRotation);

    // 1.5 Query Agents
    const { data: lightAgentsData, isLoading: lightAgentsLoading } = useQuery<{
        agents: ValorantAgent[];
    }>({
        queryKey: ["agents", "light"],
        queryFn: async () => {
            const res = await fetch("/api/agents/light");
            if (!res.ok) throw new Error("Error loading light agents");
            return res.json();
        },
    });

    const { data: agentsData, isLoading: fullAgentsLoading } = useQuery<{
        agents: ValorantAgent[];
    }>({
        queryKey: ["agents", "full"],
        queryFn: async () => {
            const res = await fetch("/api/agents");
            if (!res.ok) throw new Error("Error loading agents");
            return res.json();
        },
        enabled: view === "editor",
    });

    const { data: weaponsData, isLoading: weaponsLoading } = useQuery<{
        weapons: ValorantWeapon[];
    }>({
        queryKey: ["weapons"],
        queryFn: async () => {
            const res = await fetch("/api/weapons");
            if (!res.ok) throw new Error("Error loading weapons");
            return res.json();
        },
        staleTime: 3600 * 1000,
    });

    const weapons = weaponsData?.weapons || [];
    const findWeapon = (id: string) => weapons.find((w) => w.uuid === id);

    const agents =
        view === "editor"
            ? agentsData?.agents || []
            : lightAgentsData?.agents || [];
    const agentsLoading =
        view === "editor" ? fullAgentsLoading : lightAgentsLoading;

    const findAgent = useCallback(
        (id: string) => {
            return agents.find((a) => a.id === id);
        },
        [agents],
    );

    const getAgentsByRole = useCallback(
        (role: AgentRole) => {
            return agents.filter((a) => a.role === role);
        },
        [agents],
    );

    const getAllyAgents = useCallback((strategy: Strategy): CanvasAgent[] => {
        const canvasData = strategy.canvas_data as {
            agents?: CanvasAgent[];
        } | null;
        if (!canvasData?.agents) return [];
        return canvasData.agents.filter((a) => a.team === "ally").slice(0, 5);
    }, []);

    const getAllyComposition = useCallback(
        (strategy: Strategy): string[] => {
            const allyAgents = getAllyAgents(strategy);
            return allyAgents.map((a) => a.id);
        },
        [getAllyAgents],
    );

    const getUniqueCompositions = useCallback(
        (strats: Strategy[]): Map<string, Strategy[]> => {
            const compMap = new Map<string, Strategy[]>();
            for (const s of strats) {
                const comp = getAllyComposition(s);
                if (comp.length === 0) continue;
                const key = comp.join(",");
                if (!compMap.has(key)) {
                    compMap.set(key, []);
                }
                compMap.get(key)!.push(s);
            }
            return compMap;
        },
        [getAllyComposition],
    );

    const hydrateSkills = useCallback(
        (
            skillsList: CanvasSkill[],
            canvasAgents: CanvasAgent[] = agentsRef.current,
        ) => {
            let modified = false;
            skillsList.forEach((s) => {
                const canvasAgent = canvasAgents.find(
                    (a) => a.instanceId === s.agentInstanceId,
                );
                if (!canvasAgent) return;
                const globalAgent = agents.find((a) => a.id === canvasAgent.id);
                if (!globalAgent) return;
                const globalSkill = globalAgent.skills?.find(
                    (sk) => sk.key === s.key,
                );
                if (!globalSkill) return;

                if (
                    JSON.stringify(s.deployment) !==
                        JSON.stringify(globalSkill.deployment) ||
                    JSON.stringify(s.lifetime) !==
                        JSON.stringify(globalSkill.lifetime) ||
                    JSON.stringify(s.resolution) !==
                        JSON.stringify(globalSkill.resolution)
                ) {
                    s.deployment = globalSkill.deployment;
                    s.lifetime = globalSkill.lifetime;
                    s.resolution = globalSkill.resolution;
                    modified = true;
                }
            });
            return modified;
        },
        [agents],
    );

    const syncCanvasLocalState = useCallback(
        (
            paths: CanvasPath[],
            agentsList: CanvasAgent[],
            skillsList: CanvasSkill[] = [],
        ) => {
            const sanitizedPaths = paths.map((p) => ({
                ...p,
                id: p.id || Math.random().toString(36).substring(2, 9),
            }));
            const sanitizedAgents = agentsList.map((a) => ({
                ...a,
                instanceId:
                    a.instanceId || Math.random().toString(36).substring(2, 9),
            }));
            const sanitizedSkills = skillsList.map((s) => ({
                ...s,
                instanceId:
                    s.instanceId || Math.random().toString(36).substring(2, 9),
            }));

            hydrateSkills(sanitizedSkills, sanitizedAgents);

            pathsRef.current = sanitizedPaths;
            agentsRef.current = sanitizedAgents;
            skillsRef.current = sanitizedSkills;

            loadedPathIdsRef.current = new Set(sanitizedPaths.map((p) => p.id));
            loadedAgentIdsRef.current = new Set(
                sanitizedAgents.map((a) => a.instanceId),
            );
            loadedSkillIdsRef.current = new Set(
                sanitizedSkills.map((s) => s.instanceId),
            );
        },
        [],
    );

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
            const newMap = allMaps.find((m) => m.id === configMapId);
            if (newMap) {
                setSelectedMap(newMap);
                // Reset map image so the useEffect reloads it
                mapImgRef.current = null;
            }
        }
        setCurrent({
            ...current,
            name: configName,
            description: configDescription,
            side: configSide,
            map_id: configMapId || current.map_id,
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
            fetch(`/api/strategies?id=${stratParam}`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.strategy) {
                        const s = data.strategy;
                        const foundMap = allMaps.find((m) => m.id === s.map_id);
                        if (foundMap) {
                            setSelectedMap(foundMap);
                            openEditor(s);
                        }
                    }
                });
        } else {
            const mapParam = searchParams.get("map");
            if (mapParam) {
                const foundMap = allMaps.find(
                    (m) =>
                        m.id.toLowerCase() === mapParam.toLowerCase() ||
                        m.name.toLowerCase() === mapParam.toLowerCase(),
                );
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
    }, [
        selectedMap,
        selectedSide,
        tool,
        agents,
        zoom,
        pan,
        pencilSize,
        arrowSize,
        eraserSize,
        remoteCursors,
    ]);

    useEffect(() => {
        if (agents.length === 0) return;
        if (hydrateSkills(skillsRef.current)) {
            redraw();
        }
    }, [agents, hydrateSkills, redraw]);

    // The actual drawing function that reads from refs (no stale closures for pan/zoom)
    const redrawImmediate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Ensure canvas resolution matches its display size before drawing
        if (canvas.parentElement) {
            const pw = canvas.parentElement.clientWidth;
            const ph = canvas.parentElement.clientHeight;
            if (
                pw > 0 &&
                ph > 0 &&
                (canvas.width !== pw || canvas.height !== ph)
            ) {
                canvas.width = pw;
                canvas.height = ph;
            }
        }

        const ctx = ctxRef.current;
        if (!ctx || canvas.width <= 0 || canvas.height <= 0) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0a0e14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const mapImg = mapImgRef.current;
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        const currentSide = selectedSide;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const currentTool = tool;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const currentEraserSize = eraserSizeRef.current;

        if (!(mapImg && mapImg.complete)) {
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.font = "bold 60px Outfit, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
                (selectedMap?.name || "").toUpperCase(),
                canvas.width / 2,
                canvas.height / 2,
            );
            ctx.textAlign = "start";
        }

        const baseAngle = ((selectedMap?.rotationOffset || 0) * Math.PI) / 180;
        const angle =
            (currentSide === "attack" ? Math.PI / 2 : -Math.PI / 2) + baseAngle;

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
        ctx.translate(
            canvas.width / 2 + currentPan.x,
            canvas.height / 2 + currentPan.y,
        );
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
        if (
            pathCanvas.width !== canvas.width ||
            pathCanvas.height !== canvas.height
        ) {
            pathCanvas.width = canvas.width;
            pathCanvas.height = canvas.height;
        }
        const pCtx = pathCanvas.getContext("2d");
        if (pCtx) {
            pCtx.clearRect(0, 0, pathCanvas.width, pathCanvas.height);
            pCtx.save();
            pCtx.translate(
                canvas.width / 2 + currentPan.x,
                canvas.height / 2 + currentPan.y,
            );
            pCtx.scale(currentZoom, currentZoom);
            pCtx.rotate(angle);
            pCtx.scale(scale, scale);

            for (const path of pathsRef.current) {
                if (path.points.length < 2) continue;
                pCtx.beginPath();
                pCtx.strokeStyle = path.color;
                pCtx.lineWidth =
                    (path.thickness !== undefined
                        ? path.thickness
                        : path.tool === "eraser"
                          ? 20
                          : 5) / scale;
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

                    const arrowAngle = Math.atan2(
                        last.y - refPoint.y,
                        last.x - refPoint.x,
                    );

                    pCtx.save();
                    pCtx.translate(last.x, last.y);
                    pCtx.rotate(arrowAngle);
                    pCtx.scale(1 / scale, 1 / scale);

                    const arrowScale =
                        (path.thickness !== undefined ? path.thickness : 5) / 5;
                    pCtx.beginPath();
                    pCtx.strokeStyle = path.color;
                    pCtx.lineWidth =
                        path.thickness !== undefined ? path.thickness : 5;
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
        ctx.translate(
            canvas.width / 2 + currentPan.x,
            canvas.height / 2 + currentPan.y,
        );
        ctx.scale(currentZoom, currentZoom);
        ctx.rotate(angle);
        ctx.scale(scale, scale);

        // Draw Skills
        const skillsToRender = [...skillsRef.current];
        if (pendingSkillRef.current && worldMousePosRef.current) {
            const pSkill = pendingSkillRef.current;
            const agentObj = agentsRef.current.find(
                (a) => a.instanceId === pSkill.agentInstanceId,
            );

            let startX = worldMousePosRef.current.x;
            let startY = worldMousePosRef.current.y;

            const mToPx = selectedMap?.pixelsPerMeter || 20;

            let maxPreviewRange = 0;
            if (["dash_teleport"].includes(getDeploymentType(pSkill.skill))) {
                const { maxRange } = getProjRangeAndFixed(pSkill.skill);
                maxPreviewRange = maxRange;
                if (
                    ["map_target_aoe", "two_point_barrier"].includes(
                        getDeploymentType(pSkill.skill),
                    )
                ) {
                    maxPreviewRange =
                        ("castRange" in (pSkill.skill.deployment || {})
                            ? getCastRange(pSkill.skill)
                            : 0) || 0;
                }
            } else if (
                ["map_target_aoe", "two_point_barrier"].includes(
                    getDeploymentType(pSkill.skill),
                )
            ) {
                maxPreviewRange =
                    ("castRange" in (pSkill.skill.deployment || {})
                        ? getCastRange(pSkill.skill)
                        : 0) || 0;
            }

            if (maxPreviewRange > 0 && agentObj) {
                const maxPx = maxPreviewRange * mToPx;
                ctx.save();
                ctx.beginPath();
                ctx.arc(agentObj.x, agentObj.y, maxPx, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                ctx.lineWidth = 2 / scale;
                ctx.setLineDash([4 / scale, 4 / scale]);
                ctx.stroke();
                ctx.restore();
            }

            let playerToMouseAngle = 0;
            if (
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(getDeploymentType(pSkill.skill) as string) &&
                agentObj
            ) {
                startX = agentObj.x;
                startY = agentObj.y;
                playerToMouseAngle = Math.atan2(
                    worldMousePosRef.current.y - startY,
                    worldMousePosRef.current.x - startX,
                );

                if (pSkill.skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                }
            } else if (
                ["map_target_aoe", "two_point_barrier"].includes(
                    getDeploymentType(pSkill.skill),
                ) &&
                agentObj
            ) {
                const maxRange =
                    ("castRange" in (pSkill.skill.deployment || {})
                        ? getCastRange(pSkill.skill)
                        : 0) || 0;
                if (maxRange > 0) {
                    const maxPx = maxRange * mToPx;
                    const dist = Math.sqrt(
                        (worldMousePosRef.current.x - agentObj.x) ** 2 +
                            (worldMousePosRef.current.y - agentObj.y) ** 2,
                    );
                    if (dist > maxPx) {
                        const angle = Math.atan2(
                            worldMousePosRef.current.y - agentObj.y,
                            worldMousePosRef.current.x - agentObj.x,
                        );
                        startX = agentObj.x + Math.cos(angle) * maxPx;
                        startY = agentObj.y + Math.sin(angle) * maxPx;
                    }
                }
            }

            let initTargetX: number | undefined = undefined;
            let initTargetY: number | undefined = undefined;
            const isProj =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    getDeploymentType(pSkill.skill),
                ) ||
                ["dash_teleport"].includes(getDeploymentType(pSkill.skill)) ||
                !!["linear_wall"].includes(getDeploymentType(pSkill.skill));
            const isGeomWithTarget =
                !isProj &&
                pSkill.skill.deployment &&
                ([
                    "linear_wall",
                    "projectile_sweeping",
                    "two_point_barrier",
                ].includes(getDeploymentType(pSkill.skill)) ||
                    getDeploymentType(pSkill.skill) === "autonomous_entity");

            if (isGeomWithTarget || isProj) {
                const length = getAoeLength(pSkill.skill) * mToPx;

                if (
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(getDeploymentType(pSkill.skill)) &&
                    agentObj
                ) {
                    const sa = playerToMouseAngle;
                    if (false) {
                        const maxLen =
                            (0 /* no max length */ ||
                                getAoeLength(pSkill.skill) ||
                                0) * mToPx;
                        const dx = (worldMousePosRef.current?.x || 0) - startX;
                        const dy = (worldMousePosRef.current?.y || 0) - startY;
                        let dist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        dist = Math.max(0, Math.min(dist, maxLen));
                        initTargetX = startX + Math.cos(sa) * dist;
                        initTargetY = startY + Math.sin(sa) * dist;
                    } else if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(pSkill.skill);
                        let tX = worldMousePosRef.current.x;
                        let tY = worldMousePosRef.current.y;

                        if (maxRange > 0) {
                            const maxPx = maxRange * mToPx;
                            const dx = tX - agentObj.x;
                            const dy = tY - agentObj.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (projIsFixed || dist > maxPx) {
                                const angle = Math.atan2(dy, dx);
                                tX = agentObj.x + Math.cos(angle) * maxPx;
                                tY = agentObj.y + Math.sin(angle) * maxPx;
                            }
                        }

                        const dx = tX - startX;
                        const dy = tY - startY;
                        const projDist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        if (projDist <= 0.1) {
                            initTargetX = startX + Math.cos(sa) * 0.1;
                            initTargetY = startY + Math.sin(sa) * 0.1;
                        } else {
                            initTargetX = tX;
                            initTargetY = tY;
                        }
                    } else {
                        initTargetX = startX + Math.cos(sa) * length;
                        initTargetY = startY + Math.sin(sa) * length;
                    }
                } else {
                    // ground spawn: enforce maxCastRange if set
                    if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(pSkill.skill);
                        if (maxRange > 0) {
                            const maxPx = maxRange * mToPx;
                            const spawnLen = maxPx > 0 ? maxPx : 10 * mToPx;
                            let angle = 0;
                            if (agentObj) {
                                angle = Math.atan2(
                                    worldMousePosRef.current.y - agentObj.y,
                                    worldMousePosRef.current.x - agentObj.x,
                                );
                            }
                            initTargetX = startX + Math.cos(angle) * spawnLen;
                            initTargetY = startY + Math.sin(angle) * spawnLen;
                        } else {
                            initTargetX = worldMousePosRef.current.x;
                            initTargetY = worldMousePosRef.current.y;
                        }
                    } else if (false) {
                        initTargetX =
                            startX +
                            (0 /* no min length */ ||
                                getAoeLength(pSkill.skill) ||
                                0) *
                                mToPx;
                        initTargetY = startY;
                    } else {
                        initTargetX = startX + length;
                        initTargetY = startY;
                    }
                }
            }

            skillsToRender.push({
                instanceId: "preview",
                agentInstanceId: pSkill.agentInstanceId,
                key: pSkill.skill.key,
                x: startX,
                y: startY,
                targetX: initTargetX,
                targetY: initTargetY,
                color: pSkill.color,
                deployment: pSkill.skill.deployment,
                lifetime: pSkill.skill.lifetime,
                resolution: pSkill.skill.resolution,
            } as CanvasSkill);
        }

        for (const skill of skillsToRender) {
            ctx.save();
            ctx.translate(skill.x, skill.y);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isTwoPoint = ["two_point_barrier"].includes(
                getDeploymentType(skill),
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isActivatable = false;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isActive = skill.isActive;

            const agent = agentsRef.current.find(
                (a) => a.instanceId === skill.agentInstanceId,
            );
            const agentData = agent ? findAgent(agent.id) : null;
            const imgKey = agentData
                ? `${agentData.id}-${skill.key}`
                : skill.key;

            let sImg = skillImgsRef.current.get(imgKey);
            if (!sImg) {
                const skillData = agentData?.skills?.find(
                    (s) => s.key === skill.key,
                );
                if (skillData?.displayIcon) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = skillData.displayIcon;
                    img.onload = () => {
                        skillImgsRef.current.set(imgKey, img);
                        redraw();
                    };
                    skillImgsRef.current.set(imgKey, img);
                    sImg = img;
                }
            }

            const isControllablePath =
                ["linear_wall"].includes(getDeploymentType(skill)) ||
                false; /* no controllable flag yet */
            if (
                isControllablePath &&
                skill.pathPoints &&
                skill.pathPoints.length > 0
            ) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                for (let i = 1; i < skill.pathPoints.length; i++) {
                    ctx.lineTo(
                        skill.pathPoints[i].x - skill.x,
                        skill.pathPoints[i].y - skill.y,
                    );
                }
                ctx.strokeStyle = skill.color;
                ctx.lineWidth = 3 / scale;
                ctx.globalAlpha = 0.8;
                ctx.setLineDash([8 / scale, 6 / scale]);
                ctx.stroke();
                ctx.setLineDash([]);

                if (sImg && sImg.complete) {
                    const lastPt =
                        skill.pathPoints[skill.pathPoints.length - 1];
                    ctx.save();
                    ctx.translate(lastPt.x - skill.x, lastPt.y - skill.y);
                    ctx.rotate(-angle);
                    ctx.drawImage(sImg, -10, -10, 20, 20);
                    ctx.restore();
                }
                ctx.restore();
                continue;
            }

            const geom = getGeometry(skill) || { type: "none" };
            if (!geom) {
                ctx.restore();
                continue;
            }

            ctx.fillStyle = skill.color;
            ctx.strokeStyle = skill.color;

            let baseAlpha = skill.instanceId === "preview" ? 0.25 : 0.5;
            let strokeAlpha = skill.instanceId === "preview" ? 0.4 : 0.8;
            if (false && skill.instanceId !== "preview") {
                baseAlpha = 1;
                strokeAlpha = 1;
            }
            ctx.globalAlpha = baseAlpha;

            // Assuming 1 meter = 20 canvas units approximately (or calibrated value)
            const mToPx = selectedMap?.pixelsPerMeter || 20;

            ctx.save();

            const hasGroundPath = !!["linear_wall"].includes(
                getDeploymentType(skill),
            );
            const isProj =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    getDeploymentType(skill),
                ) ||
                ["dash_teleport"].includes(getDeploymentType(skill)) ||
                hasGroundPath;

            if (
                isProj &&
                skill.targetX !== undefined &&
                skill.targetY !== undefined
            ) {
                const tx = skill.targetX - skill.x;
                const ty = skill.targetY - skill.y;
                const dist = Math.sqrt(tx * tx + ty * ty);

                if (geom.type !== "curve") {
                    const isGroundPathWithArea = hasGroundPath;

                    if (isGroundPathWithArea) {
                        const gpWidth =
                            (0 /* no width on boolean */ || 1) * mToPx;
                        ctx.save();
                        ctx.rotate(Math.atan2(ty, tx));
                        ctx.beginPath();
                        ctx.rect(0, -gpWidth / 2, dist, gpWidth);
                        ctx.fillStyle = skill.color;
                        ctx.globalAlpha = baseAlpha * 0.4;
                        ctx.fill();
                        ctx.globalAlpha = strokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.strokeStyle = skill.color;
                        ctx.save();
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();

                        if (skill.unlinked) {
                            ctx.save();
                            ctx.clip(); // Ensure arrows don't bleed out of the rect

                            ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                            ctx.lineWidth = 3 / scale;
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";

                            const spacingPx = 40 / scale;
                            const numArrows = Math.max(
                                1,
                                Math.floor(dist / spacingPx),
                            );
                            const spacing = dist / (numArrows + 1);
                            const arrowSize = Math.min(
                                gpWidth * 0.25,
                                12 / scale,
                            );

                            ctx.beginPath();
                            for (let i = 1; i <= numArrows; i++) {
                                const cx = i * spacing;
                                ctx.moveTo(cx - arrowSize, -arrowSize);
                                ctx.lineTo(cx, 0);
                                ctx.lineTo(cx - arrowSize, arrowSize);
                            }
                            ctx.stroke();
                            ctx.restore();
                        }

                        ctx.restore();
                    } else if (
                        ["dash_teleport"].includes(getDeploymentType(skill))
                    ) {
                        const isTeleportToPos = getCastRange(skill) > 0;
                        const maxDisplacements = 0 || 1;

                        const pts = [{ x: 0, y: 0 }];
                        if (
                            maxDisplacements > 1 &&
                            skill.pathPoints &&
                            skill.pathPoints.length > 0
                        ) {
                            for (let i = 1; i < skill.pathPoints.length; i++) {
                                pts.push({
                                    x: skill.pathPoints[i].x - skill.x,
                                    y: skill.pathPoints[i].y - skill.y,
                                });
                            }
                        }
                        if (
                            maxDisplacements === 1 ||
                            !skill.pathPoints ||
                            (skill.instanceId ===
                                draggedSkillTargetRef.current?.instanceId &&
                                (isPlacingSecondPointRef.current ||
                                    isPlacingMultiDisplacementRef.current))
                        ) {
                            // Draw preview circle around the current origin before pushing the new target
                            if (
                                skill.instanceId ===
                                    draggedSkillTargetRef.current?.instanceId &&
                                pts.length > 0
                            ) {
                                const currentOrigin = pts[pts.length - 1];
                                let { maxRange } = getProjRangeAndFixed(skill);
                                if (
                                    [
                                        "map_target_aoe",
                                        "two_point_barrier",
                                    ].includes(getDeploymentType(skill))
                                ) {
                                    maxRange = getCastRange(skill);
                                }
                                if (maxRange > 0) {
                                    const mToPx =
                                        selectedMap?.pixelsPerMeter || 20;
                                    const maxPx = maxRange * mToPx;
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.arc(
                                        currentOrigin.x,
                                        currentOrigin.y,
                                        maxPx,
                                        0,
                                        Math.PI * 2,
                                    );
                                    ctx.strokeStyle =
                                        "rgba(255, 255, 255, 0.3)";
                                    ctx.lineWidth = 2 / scale;
                                    ctx.setLineDash([4 / scale, 4 / scale]);
                                    ctx.stroke();
                                    ctx.restore();
                                }
                            }
                            pts.push({ x: tx, y: ty });
                        }

                        for (let j = 0; j < pts.length - 1; j++) {
                            const p1 = pts[j];
                            const p2 = pts[j + 1];
                            const segmentDist = Math.sqrt(
                                (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2,
                            );

                            ctx.beginPath();
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.strokeStyle = skill.color;

                            if (isTeleportToPos) {
                                ctx.lineWidth = 1 / scale;
                                ctx.globalAlpha = 0.4;
                                ctx.setLineDash([4 / scale, 8 / scale]);
                                ctx.stroke();
                                ctx.setLineDash([]);

                                ctx.beginPath();
                                ctx.arc(p2.x, p2.y, 6 / scale, 0, Math.PI * 2);
                                ctx.fillStyle = skill.color;
                                ctx.globalAlpha = 0.6;
                                ctx.fill();

                                const agentId = agentsRef.current.find(
                                    (a) =>
                                        a.instanceId === skill.agentInstanceId,
                                )?.id;
                                const aImg = agentId
                                    ? agentImgsRef.current.get(agentId)
                                    : null;
                                if (aImg && aImg.complete) {
                                    ctx.save();
                                    ctx.translate(p2.x, p2.y);
                                    ctx.beginPath();
                                    ctx.arc(0, 0, 14 / scale, 0, Math.PI * 2);
                                    ctx.clip();
                                    ctx.globalAlpha = 0.5;
                                    ctx.drawImage(
                                        aImg,
                                        -14 / scale,
                                        -14 / scale,
                                        28 / scale,
                                        28 / scale,
                                    );
                                    ctx.restore();
                                }
                            } else {
                                ctx.lineWidth = 3 / scale;
                                ctx.globalAlpha = 0.8;
                                ctx.setLineDash([8 / scale, 8 / scale]);
                                ctx.stroke();
                                ctx.setLineDash([]);

                                ctx.save();
                                ctx.translate(p1.x, p1.y);
                                ctx.rotate(
                                    Math.atan2(p2.y - p1.y, p2.x - p1.x),
                                );
                                ctx.strokeStyle = skill.color;
                                ctx.lineWidth = 3 / scale;
                                ctx.lineCap = "round";
                                ctx.lineJoin = "round";
                                const spacingPx = 30 / scale;
                                const numArrows = Math.max(
                                    1,
                                    Math.floor(segmentDist / spacingPx),
                                );
                                const spacing = segmentDist / (numArrows + 1);
                                const arrowSize = 8 / scale;
                                ctx.beginPath();
                                for (let i = 1; i <= numArrows; i++) {
                                    const acx = i * spacing;
                                    ctx.moveTo(acx - arrowSize, -arrowSize);
                                    ctx.lineTo(acx, 0);
                                    ctx.lineTo(acx - arrowSize, arrowSize);
                                }
                                ctx.stroke();
                                ctx.restore();
                            }
                        }
                    } else if (
                        getDeploymentType(skill) === "projectile_sweeping"
                    ) {
                        // Draw sweep projectile rectangle from start to end (NOT translated to endpoint)
                        const sweepDist = Math.sqrt(tx * tx + ty * ty);
                        const sweepAngle = Math.atan2(ty, tx);

                        let sweepWidth = 0;
                        if (geom.type === "circle") {
                            sweepWidth =
                                (geom.radius !== undefined
                                    ? geom.radius
                                    : getGeomWidth(geom) / 2) *
                                2 *
                                mToPx;
                        } else if (
                            geom.type === "rectangle" ||
                            geom.type === "line"
                        ) {
                            sweepWidth = getGeomWidth(geom) * mToPx;
                        } else if (geom.type === "trapezoid") {
                            sweepWidth = getGeomWidth(geom) * mToPx;
                        }

                        if (sweepWidth > 0) {
                            ctx.save();
                            ctx.rotate(sweepAngle);

                            ctx.beginPath();
                            ctx.moveTo(0, -sweepWidth / 2);
                            ctx.lineTo(sweepDist, -sweepWidth / 2);
                            ctx.lineTo(sweepDist, sweepWidth / 2);
                            ctx.lineTo(0, sweepWidth / 2);
                            ctx.closePath();
                            ctx.fill();
                            ctx.globalAlpha = strokeAlpha;
                            ctx.lineWidth = 4 / scale;
                            ctx.save();
                            ctx.clip();
                            ctx.stroke();
                            ctx.restore();

                            // Draw arrows if unlinked
                            if (skill.unlinked) {
                                ctx.save();
                                ctx.clip();
                                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                                ctx.lineWidth = 3 / scale;
                                ctx.lineCap = "round";
                                ctx.lineJoin = "round";

                                const spacingPx = 40 / scale;
                                const numArrows = Math.max(
                                    1,
                                    Math.floor(sweepDist / spacingPx),
                                );
                                const spacing = sweepDist / (numArrows + 1);
                                const arrowSize = Math.min(
                                    sweepWidth * 0.25,
                                    12 / scale,
                                );

                                ctx.beginPath();
                                for (let i = 1; i <= numArrows; i++) {
                                    const cx = i * spacing;
                                    ctx.moveTo(cx - arrowSize, -arrowSize);
                                    ctx.lineTo(cx, 0);
                                    ctx.lineTo(cx - arrowSize, arrowSize);
                                }
                                ctx.stroke();
                                ctx.restore();
                            }
                            ctx.globalAlpha = baseAlpha;

                            ctx.restore();
                        }
                        // DON'T translate for sweep projectiles - they're already fully rendered
                    } else {
                        // Dashed line for other projectiles and narrow ground paths
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(tx, ty);
                        ctx.strokeStyle = skill.color;
                        ctx.lineWidth = 2 / scale;
                        ctx.globalAlpha = 0.6;
                        ctx.setLineDash([6 / scale, 6 / scale]);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        ctx.translate(tx, ty);
                    }
                }
            }

            if (skill.lifetime) {
                if (geom.type === "none") {
                    // No geometry shape — just a small circle around the icon
                    ctx.beginPath();
                    const noneRadius = 12 / scale;
                    ctx.arc(0, 0, noneRadius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.globalAlpha = strokeAlpha;
                    ctx.lineWidth = 4 / scale;
                    ctx.save();
                    ctx.clip();
                    ctx.stroke();
                    ctx.restore();
                } else if (
                    geom.type === "circle" &&
                    getDeploymentType(skill) !== "projectile_sweeping"
                ) {
                    ctx.beginPath();
                    const radius =
                        (geom.radius !== undefined
                            ? geom.radius
                            : getGeomWidth(geom) / 2) * mToPx;
                    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                    ctx.fill();

                    ctx.globalAlpha = strokeAlpha;
                    ctx.lineWidth = 4 / scale;
                    ctx.save();
                    ctx.clip();
                    ctx.stroke();
                    ctx.restore();
                } else if (
                    getDeploymentType(skill) === "projectile_sweeping" &&
                    skill.targetX !== undefined &&
                    skill.targetY !== undefined
                ) {
                    // Draw sweep projectile area from start to end point (BEFORE translate)
                    ctx.save();
                    const sweepDist = Math.sqrt(
                        (skill.targetX - skill.x) ** 2 +
                            (skill.targetY - skill.y) ** 2,
                    );
                    const sweepAngle = Math.atan2(
                        skill.targetY - skill.y,
                        skill.targetX - skill.x,
                    );
                    ctx.rotate(sweepAngle);

                    let sweepWidth = 0;
                    if (geom.type === "circle") {
                        sweepWidth =
                            (geom.radius !== undefined
                                ? geom.radius
                                : getGeomWidth(geom) / 2) *
                            2 *
                            mToPx;
                    } else if (
                        geom.type === "rectangle" ||
                        geom.type === "line"
                    ) {
                        sweepWidth = getGeomWidth(geom) * mToPx;
                    } else if (geom.type === "trapezoid") {
                        sweepWidth = getGeomWidth(geom) * mToPx;
                    }

                    ctx.fillStyle = skill.color;
                    ctx.strokeStyle = skill.color;
                    let sweepBaseAlpha =
                        skill.instanceId === "preview" ? 0.25 : 0.5;
                    let sweepStrokeAlpha =
                        skill.instanceId === "preview" ? 0.4 : 0.8;
                    ctx.globalAlpha = sweepBaseAlpha;

                    if (sweepWidth > 0) {
                        ctx.beginPath();
                        ctx.moveTo(0, -sweepWidth / 2);
                        ctx.lineTo(sweepDist, -sweepWidth / 2);
                        ctx.lineTo(sweepDist, sweepWidth / 2);
                        ctx.lineTo(0, sweepWidth / 2);
                        ctx.closePath();
                        ctx.fill();
                        ctx.globalAlpha = sweepStrokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.save();
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();

                        // Draw arrows if unlinked
                        if (skill.unlinked) {
                            ctx.save();
                            ctx.clip();
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                            ctx.lineWidth = 3 / scale;
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";

                            const spacingPx = 40 / scale;
                            const numArrows = Math.max(
                                1,
                                Math.floor(sweepDist / spacingPx),
                            );
                            const spacing = sweepDist / (numArrows + 1);
                            const arrowSize = Math.min(
                                sweepWidth * 0.25,
                                12 / scale,
                            );

                            ctx.beginPath();
                            for (let i = 1; i <= numArrows; i++) {
                                const cx = i * spacing;
                                ctx.moveTo(cx - arrowSize, -arrowSize);
                                ctx.lineTo(cx, 0);
                                ctx.lineTo(cx - arrowSize, arrowSize);
                            }
                            ctx.stroke();
                            ctx.restore();
                        }
                        ctx.globalAlpha = sweepBaseAlpha;
                    }

                    ctx.restore();
                    // DON'T translate for sweep projectiles - they render the full area, not at the endpoint
                } else if (
                    (geom.type === "rectangle" ||
                        geom.type === "cone" ||
                        geom.type === "trapezoid" ||
                        geom.type === "line" ||
                        (geom.type === "circle" &&
                            getDeploymentType(skill) !==
                                "projectile_sweeping")) &&
                    getDeploymentType(skill) !== "projectile_sweeping"
                ) {
                    ctx.save();
                    if (
                        skill.targetX !== undefined &&
                        skill.targetY !== undefined
                    ) {
                        const sa = Math.atan2(
                            skill.targetY - skill.y,
                            skill.targetX - skill.x,
                        );
                        ctx.rotate(sa);
                    } else if (skill.customRotation !== undefined) {
                        ctx.rotate(skill.customRotation);
                    }

                    let baseLength = 0;
                    if (getDeploymentType(skill)) {
                        if (
                            geom.type === "rectangle" ||
                            geom.type === "cone" ||
                            geom.type === "trapezoid" ||
                            geom.type === "line"
                        ) {
                            baseLength = getGeomLength(geom);
                        }
                    }

                    let length = baseLength * mToPx;

                    if (
                        skill.targetX !== undefined &&
                        skill.targetY !== undefined
                    ) {
                        const dist = Math.sqrt(
                            (skill.targetX - skill.x) ** 2 +
                                (skill.targetY - skill.y) ** 2,
                        );

                        if (
                            getDeploymentType(skill) === "two_point_barrier" ||
                            getDeploymentType(skill) === "linear_wall"
                        ) {
                            length = dist;
                        }
                    }

                    let width = 0;
                    if (
                        geom.type === "rectangle" ||
                        geom.type === "line" ||
                        geom.type === "trapezoid"
                    ) {
                        width = getGeomWidth(geom) * mToPx;
                    }

                    ctx.beginPath();
                    if (geom.type === "cone") {
                        const halfAngleRad =
                            geom.angle !== undefined
                                ? ((geom.angle / 2) * Math.PI) / 180
                                : Math.atan2(width / 2, length);
                        ctx.moveTo(0, 0);
                        ctx.arc(0, 0, length, -halfAngleRad, halfAngleRad);
                        ctx.closePath();
                    } else if (geom.type === "trapezoid") {
                        const endWidth =
                            (geom.endWidth !== undefined
                                ? geom.endWidth
                                : getGeomWidth(geom) * 0.5) * mToPx;
                        ctx.moveTo(0, -width / 2);
                        ctx.lineTo(length, -endWidth / 2);
                        ctx.lineTo(length, endWidth / 2);
                        ctx.lineTo(0, width / 2);
                        ctx.closePath();
                    } else if (geom.type === "line") {
                        ctx.moveTo(0, 0);
                        ctx.lineTo(length, 0);
                    } else {
                        ctx.rect(0, -width / 2, length, width);
                    }

                    if (geom.type === "line") {
                        ctx.lineWidth = Math.max(width, 2 / scale);
                        ctx.stroke();
                    } else if (geom.type === "trapezoid") {
                        ctx.fill();
                        ctx.save();
                        ctx.clip();
                        ctx.beginPath();
                        const endWidth =
                            (geom.endWidth !== undefined
                                ? geom.endWidth
                                : getGeomWidth(geom) * 0.5) * mToPx;
                        if (width >= endWidth) {
                            // Longer base is at start (x=0). Hide it, draw the end line and laterals
                            ctx.moveTo(0, -width / 2);
                            ctx.lineTo(length, -endWidth / 2);
                            ctx.lineTo(length, endWidth / 2);
                            ctx.lineTo(0, width / 2);
                        } else {
                            // Longer base is at end (x=length). Hide it, draw the start line and laterals
                            ctx.moveTo(length, -endWidth / 2);
                            ctx.lineTo(0, -width / 2);
                            ctx.lineTo(0, width / 2);
                            ctx.lineTo(length, endWidth / 2);
                        }
                        ctx.globalAlpha = strokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.stroke();
                        ctx.restore();
                        ctx.globalAlpha = baseAlpha;
                    } else {
                        ctx.fill();
                        ctx.globalAlpha = strokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.save();
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();
                        ctx.globalAlpha = baseAlpha;
                    }

                    const isFreePlaced =
                        ["map_target_aoe", "two_point_barrier"].includes(
                            getDeploymentType(skill),
                        ) ||
                        (skill.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(skill)));
                    const hasDirection =
                        (skill.targetX !== undefined &&
                            skill.targetY !== undefined) ||
                        skill.customRotation !== undefined;

                    if (isFreePlaced && hasDirection) {
                        ctx.save();
                        ctx.clip(); // Ensure arrows don't bleed out of the cone/trapezoid

                        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                        ctx.lineWidth = 3 / scale;
                        ctx.lineCap = "round";
                        ctx.lineJoin = "round";

                        const spacingPx = 40 / scale;
                        const numArrows = Math.max(
                            1,
                            Math.floor(length / spacingPx),
                        );
                        const spacing = length / (numArrows + 1);
                        const arrowSize = Math.min(width * 0.25, 12 / scale);

                        ctx.beginPath();
                        for (let i = 1; i <= numArrows; i++) {
                            const cx = i * spacing;
                            ctx.moveTo(cx - arrowSize, -arrowSize);
                            ctx.lineTo(cx, 0);
                            ctx.lineTo(cx - arrowSize, arrowSize);
                        }
                        ctx.stroke();
                        ctx.restore();
                    }

                    ctx.restore();
                } else if (getDeploymentType(skill) === "projectile_sweeping") {
                    // Preview circle for sweep projectile without target
                    ctx.save();
                    let sweepWidth = 0;
                    if (geom.type === "circle") {
                        sweepWidth =
                            (geom.radius !== undefined
                                ? geom.radius
                                : getGeomWidth(geom) / 2) *
                            2 *
                            mToPx;
                    } else if (
                        geom.type === "rectangle" ||
                        geom.type === "line"
                    ) {
                        sweepWidth = getGeomWidth(geom) * mToPx;
                    } else if (geom.type === "trapezoid") {
                        sweepWidth = getGeomWidth(geom) * mToPx;
                    }

                    if (sweepWidth > 0) {
                        ctx.beginPath();
                        ctx.arc(0, 0, sweepWidth / 2, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.globalAlpha = strokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.save();
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();
                        ctx.globalAlpha = baseAlpha;
                    }
                    ctx.restore();
                }
            }

            if (
                skill.resolution?.geometry &&
                skill.resolution.geometry.type !== "none"
            ) {
                const rGeom = skill.resolution.geometry;
                ctx.save();

                if (
                    skill.targetX !== undefined &&
                    skill.targetY !== undefined
                ) {
                    if (["dash_teleport"].includes(getDeploymentType(skill))) {
                        ctx.translate(
                            skill.targetX - skill.x,
                            skill.targetY - skill.y,
                        );
                    }
                    ctx.rotate(
                        Math.atan2(
                            skill.targetY - skill.y,
                            skill.targetX - skill.x,
                        ),
                    );
                } else if (skill.customRotation !== undefined) {
                    ctx.rotate(skill.customRotation);
                }

                ctx.fillStyle = skill.color;
                ctx.strokeStyle = skill.color;
                ctx.globalAlpha = baseAlpha;

                if (rGeom.type === "circle") {
                    ctx.beginPath();
                    const radius =
                        (rGeom.radius !== undefined
                            ? rGeom.radius
                            : getGeomWidth(rGeom) / 2) * mToPx;
                    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.globalAlpha = strokeAlpha;
                    ctx.lineWidth = 4 / scale;
                    ctx.save();
                    ctx.clip();
                    ctx.stroke();
                    ctx.restore();
                } else if (
                    rGeom.type === "rectangle" ||
                    rGeom.type === "cone" ||
                    rGeom.type === "trapezoid" ||
                    rGeom.type === "line"
                ) {
                    const rLength = getGeomLength(rGeom) * mToPx;
                    const rWidth = getGeomWidth(rGeom) * mToPx;
                    ctx.beginPath();
                    if (rGeom.type === "cone") {
                        const halfAngleRad =
                            rGeom.angle !== undefined
                                ? ((rGeom.angle / 2) * Math.PI) / 180
                                : Math.atan2(rWidth / 2, rLength);
                        ctx.moveTo(0, 0);
                        ctx.arc(0, 0, rLength, -halfAngleRad, halfAngleRad);
                        ctx.closePath();
                    } else if (rGeom.type === "trapezoid") {
                        const endWidth =
                            rGeom.endWidth !== undefined
                                ? rGeom.endWidth
                                : rWidth * 0.5;
                        ctx.moveTo(0, -rWidth / 2);
                        ctx.lineTo(rLength, -endWidth / 2);
                        ctx.lineTo(rLength, endWidth / 2);
                        ctx.lineTo(0, rWidth / 2);
                        ctx.closePath();
                    } else if (rGeom.type === "line") {
                        ctx.moveTo(0, 0);
                        ctx.lineTo(rLength, 0);
                    } else {
                        ctx.rect(0, -rWidth / 2, rLength, rWidth);
                    }
                    if (rGeom.type === "line") {
                        ctx.lineWidth = Math.max(rWidth, 2 / scale);
                        ctx.stroke();
                    } else {
                        ctx.fill();
                        ctx.globalAlpha = strokeAlpha;
                        ctx.lineWidth = 4 / scale;
                        ctx.save();
                        ctx.clip();
                        ctx.stroke();
                        ctx.restore();
                    }
                }
                ctx.restore();
            }

            ctx.restore();

            const isHovered =
                hoveredSkillRef.current?.instanceId === skill.instanceId;
            const isDragged =
                draggedSkillRef.current?.instanceId === skill.instanceId ||
                draggedSkillTargetRef.current?.instanceId ===
                    skill.instanceId ||
                draggedSkillRotationRef.current?.instanceId ===
                    skill.instanceId;
            const showHandles = isHovered || isDragged;

            if (
                sImg &&
                sImg.complete &&
                !["linear_wall"].includes(getDeploymentType(skill)) &&
                !false /* no controllable flag yet */ &&
                !showHandles
            ) {
                let cxImg = 0;
                let cyImg = 0;
                const isProj =
                    ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                        getDeploymentType(skill),
                    ) || ["linear_wall"].includes(getDeploymentType(skill));
                const isTeleport =
                    ["dash_teleport"].includes(getDeploymentType(skill)) ||
                    skill.lifetime?.recollectable;
                if (
                    (isProj || isTeleport) &&
                    skill.targetX !== undefined &&
                    skill.targetY !== undefined
                ) {
                    cxImg = skill.targetX - skill.x;
                    cyImg = skill.targetY - skill.y;
                } else {
                    const geom = getGeometry(skill) || { type: "none" };
                    if (
                        geom &&
                        (geom.type === "rectangle" ||
                            geom.type === "cone" ||
                            geom.type === "trapezoid" ||
                            geom.type === "curve" ||
                            geom.type === "line")
                    ) {
                        const tX =
                            skill.targetX !== undefined
                                ? skill.targetX - skill.x
                                : 0;
                        const tY =
                            skill.targetY !== undefined
                                ? skill.targetY - skill.y
                                : 0;

                        if (
                            ["two_point_barrier"].includes(
                                getDeploymentType(skill),
                            )
                        ) {
                            const mToPx = selectedMap?.pixelsPerMeter || 20;
                            const length = getGeomLength(geom) * mToPx;
                            const angleToTarget = Math.atan2(tY, tX);
                            cxImg = Math.cos(angleToTarget) * (length / 2);
                            cyImg = Math.sin(angleToTarget) * (length / 2);
                        } else {
                            cxImg = tX / 2;
                            cyImg = tY / 2;
                        }
                    }
                }

                ctx.save();
                ctx.translate(cxImg, cyImg);
                ctx.rotate(-angle);
                const imgS = 15 / scale;
                ctx.globalAlpha = skill.instanceId === "preview" ? 0.3 : 0.6;
                // Use a blending mode to help it integrate with the skill color below it
                ctx.globalCompositeOperation = "luminosity";
                ctx.drawImage(sImg, -imgS / 2, -imgS / 2, imgS, imgS);
                // Reset composite operation to draw it again with normal blending for the colored parts
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = skill.instanceId === "preview" ? 0.2 : 0.4;
                ctx.drawImage(sImg, -imgS / 2, -imgS / 2, imgS, imgS);
                ctx.restore();
            }

            let isBaseHovered = false;
            let isTargetHovered = false;
            let hoveredPathPointIndex = -1;

            if (isHovered && mousePosRef.current && !isDragged) {
                const mx = mousePosRef.current.canvasX;
                const my = mousePosRef.current.canvasY;
                const baseScreen = getScreenPos(skill.x, skill.y);
                if (
                    Math.sqrt(
                        (baseScreen.x - mx) ** 2 + (baseScreen.y - my) ** 2,
                    ) <=
                    12 * currentZoom
                ) {
                    isBaseHovered = true;
                }
                if (
                    skill.targetX !== undefined &&
                    skill.targetY !== undefined
                ) {
                    const targetScreen = getScreenPos(
                        skill.targetX,
                        skill.targetY,
                    );
                    if (
                        Math.sqrt(
                            (targetScreen.x - mx) ** 2 +
                                (targetScreen.y - my) ** 2,
                        ) <=
                        12 * currentZoom
                    ) {
                        isTargetHovered = true;
                    }
                }

                if (skill.pathPoints && skill.pathPoints.length > 2) {
                    for (let i = 1; i < skill.pathPoints.length - 1; i++) {
                        const ptScreen = getScreenPos(
                            skill.pathPoints[i].x,
                            skill.pathPoints[i].y,
                        );
                        if (
                            Math.sqrt(
                                (ptScreen.x - mx) ** 2 + (ptScreen.y - my) ** 2,
                            ) <=
                            12 * currentZoom
                        ) {
                            hoveredPathPointIndex = i;
                        }
                    }
                }

                // Fallback: if skill is hovered but neither anchor is distinctly hovered, hover the base
                if (
                    !isBaseHovered &&
                    !isTargetHovered &&
                    hoveredPathPointIndex === -1
                )
                    isBaseHovered = true;
            }

            const isTeleportFlag =
                ["dash_teleport"].includes(getDeploymentType(skill)) ||
                skill.lifetime?.recollectable;
            const isProjFlag =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    getDeploymentType(skill),
                ) || ["linear_wall"].includes(getDeploymentType(skill));
            const isOriginDestSkill =
                (isProjFlag || isTeleportFlag) &&
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(getDeploymentType(skill)) &&
                skill.targetX !== undefined &&
                skill.targetY !== undefined;

            // Draw handles if not preview and is hovered or dragged
            if (
                skill.instanceId !== "preview" &&
                (showHandles || isOriginDestSkill)
            ) {
                const anchorR = 10 / scale;

                const isLinkedSkill =
                    !skill.unlinked &&
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(getDeploymentType(skill));

                // Add a subtle hover glow for base anchor
                if (isBaseHovered && !isLinkedSkill) {
                    ctx.beginPath();
                    ctx.arc(0, 0, anchorR + 4 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                    ctx.fill();
                }

                // Draw a small draggable handle at the center
                ctx.beginPath();
                ctx.arc(0, 0, anchorR, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                ctx.fill();
                ctx.strokeStyle =
                    isBaseHovered && !isLinkedSkill ? "#fff" : skill.color;
                ctx.lineWidth =
                    (isBaseHovered && !isLinkedSkill ? 3 : 2) / scale;
                ctx.stroke();

                if (showHandles && !isLinkedSkill) {
                    ctx.save();
                    ctx.rotate(-angle);
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1.5 / scale;
                    ctx.beginPath();
                    const crossL = 6 / scale;
                    const arrowL = 2.5 / scale;
                    // Up
                    ctx.moveTo(0, -2 / scale);
                    ctx.lineTo(0, -crossL);
                    ctx.lineTo(-arrowL, -crossL + arrowL);
                    ctx.moveTo(0, -crossL);
                    ctx.lineTo(arrowL, -crossL + arrowL);
                    // Down
                    ctx.moveTo(0, 2 / scale);
                    ctx.lineTo(0, crossL);
                    ctx.lineTo(-arrowL, crossL - arrowL);
                    ctx.moveTo(0, crossL);
                    ctx.lineTo(arrowL, crossL - arrowL);
                    // Left
                    ctx.moveTo(-2 / scale, 0);
                    ctx.lineTo(-crossL, 0);
                    ctx.lineTo(-crossL + arrowL, -arrowL);
                    ctx.moveTo(-crossL, 0);
                    ctx.lineTo(-crossL + arrowL, arrowL);
                    // Right
                    ctx.moveTo(2 / scale, 0);
                    ctx.lineTo(crossL, 0);
                    ctx.lineTo(crossL - arrowL, -arrowL);
                    ctx.moveTo(crossL, 0);
                    ctx.lineTo(crossL - arrowL, arrowL);
                    ctx.stroke();
                    ctx.restore();
                }

                // Draw another handle at the target if it exists
                if (
                    showHandles &&
                    skill.targetX !== undefined &&
                    skill.targetY !== undefined
                ) {
                    const tx = skill.targetX - skill.x;
                    const ty = skill.targetY - skill.y;

                    ctx.save();
                    ctx.translate(tx, ty);
                    ctx.rotate(Math.atan2(ty, tx));

                    if (isTargetHovered) {
                        ctx.beginPath();
                        ctx.arc(0, 0, 8 / scale + 4 / scale, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                        ctx.fill();
                    }

                    // Draw the base anchor circle
                    ctx.beginPath();
                    ctx.arc(0, 0, 8 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                    ctx.fill();
                    ctx.strokeStyle = isTargetHovered ? "#fff" : skill.color;
                    ctx.lineWidth = (isTargetHovered ? 3 : 2) / scale;
                    ctx.stroke();

                    // Draw rotation indicator (curved arc on the right with arrows)
                    const r = 14 / scale;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, -Math.PI / 5, Math.PI / 5);
                    ctx.strokeStyle = isTargetHovered
                        ? "#fff"
                        : "rgba(255,255,255,0.7)";
                    ctx.lineWidth = 2 / scale;
                    ctx.lineCap = "round";
                    ctx.stroke();

                    const arrowSize = 4 / scale;

                    // Top arrow tip
                    const topX = Math.cos(-Math.PI / 5) * r;
                    const topY = Math.sin(-Math.PI / 5) * r;
                    ctx.beginPath();
                    ctx.moveTo(topX - arrowSize * 0.5, topY + arrowSize);
                    ctx.lineTo(topX, topY);
                    ctx.lineTo(topX + arrowSize, topY + arrowSize * 0.5);
                    ctx.stroke();

                    // Bottom arrow tip
                    const botX = Math.cos(Math.PI / 5) * r;
                    const botY = Math.sin(Math.PI / 5) * r;
                    ctx.beginPath();
                    ctx.moveTo(botX - arrowSize * 0.5, botY - arrowSize);
                    ctx.lineTo(botX, botY);
                    ctx.lineTo(botX + arrowSize, botY - arrowSize * 0.5);
                    ctx.stroke();

                    ctx.restore();
                }

                // Draw handles for intermediate path points
                if (
                    showHandles &&
                    skill.pathPoints &&
                    skill.pathPoints.length > 2
                ) {
                    for (let i = 1; i < skill.pathPoints.length - 1; i++) {
                        const pt = skill.pathPoints[i];
                        const prevPt = skill.pathPoints[i - 1];
                        const tx = pt.x - skill.x;
                        const ty = pt.y - skill.y;
                        const angleFromPrev = Math.atan2(
                            pt.y - prevPt.y,
                            pt.x - prevPt.x,
                        );

                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.rotate(angleFromPrev);

                        const isPtHovered = hoveredPathPointIndex === i;

                        if (isPtHovered) {
                            ctx.beginPath();
                            ctx.arc(
                                0,
                                0,
                                8 / scale + 4 / scale,
                                0,
                                Math.PI * 2,
                            );
                            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                            ctx.fill();
                        }

                        // Draw the base anchor circle
                        ctx.beginPath();
                        ctx.arc(0, 0, 8 / scale, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                        ctx.fill();
                        ctx.strokeStyle = isPtHovered ? "#fff" : skill.color;
                        ctx.lineWidth = (isPtHovered ? 3 : 2) / scale;
                        ctx.stroke();

                        // Draw rotation indicator
                        const r = 14 / scale;
                        ctx.beginPath();
                        ctx.arc(0, 0, r, -Math.PI / 5, Math.PI / 5);
                        ctx.strokeStyle = isPtHovered
                            ? "#fff"
                            : "rgba(255,255,255,0.7)";
                        ctx.lineWidth = 2 / scale;
                        ctx.lineCap = "round";
                        ctx.stroke();

                        const arrowSize = 4 / scale;

                        // Top arrow tip
                        const topX = Math.cos(-Math.PI / 5) * r;
                        const topY = Math.sin(-Math.PI / 5) * r;
                        ctx.beginPath();
                        ctx.moveTo(topX - arrowSize * 0.5, topY + arrowSize);
                        ctx.lineTo(topX, topY);
                        ctx.lineTo(topX + arrowSize, topY + arrowSize * 0.5);
                        ctx.stroke();

                        // Bottom arrow tip
                        const botX = Math.cos(Math.PI / 5) * r;
                        const botY = Math.sin(Math.PI / 5) * r;
                        ctx.beginPath();
                        ctx.moveTo(botX - arrowSize * 0.5, botY - arrowSize);
                        ctx.lineTo(botX, botY);
                        ctx.lineTo(botX + arrowSize, botY - arrowSize * 0.5);
                        ctx.stroke();

                        ctx.restore();
                    }
                }
            }
            // Draw out-of-range warning for ground skills
            if (
                ["map_target_aoe", "two_point_barrier"].includes(
                    getDeploymentType(skill),
                ) &&
                ("castRange" in (skill.deployment || {})
                    ? getCastRange(skill)
                    : 0) &&
                !skill.unlinked &&
                skill.instanceId !== "preview"
            ) {
                const agentObj = agentsRef.current.find(
                    (a) => a.instanceId === skill.agentInstanceId,
                );
                if (agentObj) {
                    const mToPx = selectedMap?.pixelsPerMeter || 20;
                    const maxPx = getCastRange(skill) * mToPx;
                    const dist = Math.sqrt(
                        (skill.x - agentObj.x) ** 2 +
                            (skill.y - agentObj.y) ** 2,
                    );
                    if (dist > maxPx + 1) {
                        // 1px epsilon
                        ctx.save();
                        ctx.translate(0, -20 / scale); // Position above the anchor
                        ctx.rotate(-angle); // Keep upright

                        // Draw warning triangle
                        const size = 12 / scale;
                        ctx.beginPath();
                        ctx.moveTo(0, -size);
                        ctx.lineTo(size, size * 0.8);
                        ctx.lineTo(-size, size * 0.8);
                        ctx.closePath();
                        ctx.fillStyle = "#ff4655";
                        ctx.fill();
                        ctx.strokeStyle = "#111";
                        ctx.lineWidth = 2 / scale;
                        ctx.stroke();

                        // Draw exclamation mark
                        ctx.fillStyle = "#fff";
                        ctx.font = `bold ${14 / scale}px sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("!", 0, size * 0.2);

                        ctx.restore();
                    }
                }
            }

            ctx.restore();
        }

        for (const a of agentsRef.current) {
            let img = agentImgsRef.current.get(a.id);
            const agent = findAgent(a.id);

            // --- Draw Range Circles ---
            const isDraggedAgent =
                draggedAgentRef.current?.instanceId === a.instanceId;
            let shouldDrawRange = false;
            let rangeToDraw = 0;
            const mToPx = selectedMap?.pixelsPerMeter || 20;

            const activeSkill =
                draggedSkillRef.current || draggedSkillTargetRef.current;
            if (
                activeSkill &&
                activeSkill.agentInstanceId === a.instanceId &&
                (!activeSkill.unlinked || isPlacingSecondPointRef.current)
            ) {
                const isGroundSpawn = [
                    "map_target_aoe",
                    "two_point_barrier",
                ].includes(getDeploymentType(activeSkill));
                const isDraggingTarget =
                    draggedSkillTargetRef.current?.instanceId ===
                    activeSkill.instanceId;
                if (isGroundSpawn || isDraggingTarget) {
                    const { maxRange } = getProjRangeAndFixed(activeSkill);
                    if (maxRange > 0) {
                        shouldDrawRange = true;
                        rangeToDraw = maxRange;
                    }
                }
            } else if (isDraggedAgent) {
                const hasSkillNearLimit = skillsRef.current.some((s) => {
                    if (
                        s.agentInstanceId === a.instanceId &&
                        !s.unlinked &&
                        ["map_target_aoe", "two_point_barrier"].includes(
                            getDeploymentType(s),
                        )
                    ) {
                        const maxRange = getCastRange(s);
                        if (maxRange > 0) {
                            const dist = Math.sqrt(
                                (s.x - a.x) ** 2 + (s.y - a.y) ** 2,
                            );
                            if (dist > maxRange * mToPx * 0.8) return true;
                        }
                    }
                    return false;
                });

                if (hasSkillNearLimit) {
                    skillsRef.current.forEach((s) => {
                        if (
                            s.agentInstanceId === a.instanceId &&
                            !s.unlinked &&
                            ["map_target_aoe", "two_point_barrier"].includes(
                                getDeploymentType(s),
                            )
                        ) {
                            const maxRange = getCastRange(s);
                            if (maxRange > 0) {
                                ctx.save();
                                ctx.beginPath();
                                ctx.arc(
                                    a.x,
                                    a.y,
                                    maxRange * mToPx,
                                    0,
                                    Math.PI * 2,
                                );
                                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                                ctx.lineWidth = 2 / scale;
                                ctx.setLineDash([4 / scale, 4 / scale]);
                                ctx.stroke();
                                ctx.restore();
                            }
                        }
                    });
                }
            }

            if (shouldDrawRange && rangeToDraw > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(a.x, a.y, rangeToDraw * mToPx, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 2 / scale;
                ctx.setLineDash([4 / scale, 4 / scale]);
                ctx.stroke();
                ctx.restore();
            }

            if (!img && agent && agent.displayIcon) {
                const newImg = new Image();
                newImg.crossOrigin = "anonymous";
                newImg.src = agent.displayIcon;
                newImg.onload = () => {
                    agentImgsRef.current.set(a.id, newImg);
                    redraw();
                };
                agentImgsRef.current.set(a.id, newImg);
                img = newImg;
            }

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

                const isHoveredAgent =
                    hoveredAgentRef.current?.instanceId === a.instanceId;
                const isDragHoveredAgent =
                    dragHoveredLinkAgentRef.current?.instanceId ===
                    a.instanceId;
                const isDraggedAgent =
                    draggedAgentRef.current?.instanceId === a.instanceId;

                if (isDraggedAgent) {
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.lineWidth = 3.5;
                    ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
                    ctx.shadowBlur = 6;
                } else if (isHoveredAgent || isDragHoveredAgent) {
                    ctx.strokeStyle =
                        a.team === "enemy" ? "#ff4655" : "#3b82f6";
                    ctx.lineWidth = 4.5;
                } else {
                    ctx.strokeStyle =
                        a.team === "enemy" ? "#ff4655" : "#3b82f6";
                    ctx.lineWidth = 2.5;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
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

            if (a.activeBuffs && a.activeBuffs.length > 0) {
                a.activeBuffs.forEach((buffKey, idx) => {
                    const skill = agent?.skills?.find((s) => s.key === buffKey);
                    if (skill && skill.displayIcon) {
                        const imgKey = `${agent!.id}-${skill.key}`;
                        const sImg = skillImgsRef.current.get(imgKey);
                        if (sImg && sImg.complete) {
                            ctx.save();
                            const offset =
                                (idx - (a.activeBuffs!.length - 1) / 2) * 20;
                            ctx.translate(offset, -28);

                            // Glowing aura ring
                            ctx.shadowColor = "rgba(0, 212, 170, 0.8)";
                            ctx.shadowBlur = 8;
                            ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                            ctx.strokeStyle = "rgba(0, 212, 170, 0.8)";
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.arc(0, 0, 9, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.stroke();

                            ctx.shadowBlur = 0; // reset shadow for image
                            ctx.drawImage(sImg, -7, -7, 14, 14);
                            ctx.restore();
                        } else if (!skillImgsRef.current.has(imgKey)) {
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.src = skill.displayIcon;
                            img.onload = () => {
                                skillImgsRef.current.set(imgKey, img);
                                redraw();
                            };
                            skillImgsRef.current.set(imgKey, img);
                        }
                    }
                });
            }

            if (a.weaponId) {
                if (a.weaponId.startsWith("skill:")) {
                    const skillKey = a.weaponId.split(":")[1];
                    const skill = agent?.skills?.find(
                        (s) => s.key === skillKey,
                    );
                    if (skill) {
                        ctx.save();
                        ctx.translate(0, 26); // position below the agent circle

                        const isAlt = skillKey.includes("_alt");
                        const w = 24;
                        const h = 16;

                        if (skill.displayIcon) {
                            const imgKey = `${agent!.id}-${skill.key}`;
                            const sImg = skillImgsRef.current.get(imgKey);
                            if (sImg && sImg.complete) {
                                const imgW = isAlt ? 14 : 18;
                                const imgH = isAlt ? 14 : 18;

                                ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                                ctx.strokeStyle = isAlt
                                    ? "rgba(0, 212, 170, 0.5)"
                                    : "rgba(255, 255, 255, 0.2)";
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                ctx.roundRect(-w / 2, -h / 2, w, h, 4);
                                ctx.fill();
                                ctx.stroke();

                                ctx.drawImage(
                                    sImg,
                                    -imgW / 2,
                                    -imgH / 2,
                                    imgW,
                                    imgH,
                                );

                                ctx.fillStyle = isAlt
                                    ? "rgba(0, 212, 170, 0.9)"
                                    : "rgba(255, 255, 255, 0.8)";
                                ctx.font = "900 6px Outfit, sans-serif";
                                ctx.textAlign = "right";
                                ctx.textBaseline = "bottom";
                                const text = isAlt
                                    ? `↳${skillKey.replace("_alt", "").toUpperCase()}`
                                    : skillKey.toUpperCase() === "PASSIVE"
                                      ? "P"
                                      : skillKey.toUpperCase();
                                ctx.fillText(text, w / 2 - 2, h / 2 - 1);
                            } else if (!skillImgsRef.current.has(imgKey)) {
                                const img = new Image();
                                img.crossOrigin = "anonymous";
                                img.src = skill.displayIcon;
                                img.onload = () => {
                                    skillImgsRef.current.set(imgKey, img);
                                    redraw();
                                };
                                skillImgsRef.current.set(imgKey, img);
                            }
                        } else {
                            ctx.fillStyle = "rgba(10, 14, 20, 0.9)";
                            ctx.strokeStyle = isAlt
                                ? "rgba(0, 212, 170, 0.5)"
                                : "rgba(255, 255, 255, 0.2)";
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.roundRect(-w / 2, -h / 2, w, h, 4);
                            ctx.fill();
                            ctx.stroke();

                            ctx.fillStyle = isAlt
                                ? "rgba(0, 212, 170, 0.9)"
                                : "rgba(255, 255, 255, 0.8)";
                            ctx.font = "900 9px Outfit, sans-serif";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            const text = isAlt
                                ? `↳${skillKey.replace("_alt", "").toUpperCase()}`
                                : skillKey.toUpperCase();
                            ctx.fillText(text, 0, 1);
                        }

                        ctx.restore();
                    }
                } else {
                    const w = findWeapon(a.weaponId);
                    if (w?.killStreamIcon) {
                        const wImg = weaponImgsRef.current.get(a.weaponId);
                        if (wImg && wImg.complete) {
                            ctx.save();
                            ctx.translate(0, 24);

                            const aspect = wImg.width / wImg.height;
                            const h = 10;
                            const w_scaled = h * aspect;

                            ctx.shadowColor = "rgba(0,0,0,0.9)";
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetY = 1;

                            ctx.drawImage(
                                wImg,
                                -w_scaled / 2,
                                -h / 2,
                                w_scaled,
                                h,
                            );
                            ctx.restore();
                        } else if (!weaponImgsRef.current.has(a.weaponId)) {
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.src = w.killStreamIcon;
                            img.onload = () => {
                                weaponImgsRef.current.set(a.weaponId!, img);
                                redraw();
                            };
                            weaponImgsRef.current.set(a.weaponId, img);
                        }
                    }
                }
            }

            ctx.restore();
        }
        ctx.restore();

        // 4. Custom Eraser Circle cursor is now handled natively via DOM for 0 lag.
        // 4b. Line-eraser highlight disabled (no preview)

        // --- Draw Calibration Line ---
        if (
            tool === "calibrate" &&
            calibrateStateRef.current.step === "end" &&
            calibrateStateRef.current.startPos &&
            worldMousePosRef.current
        ) {
            ctx.save();
            ctx.translate(
                canvas.width / 2 + currentPan.x,
                canvas.height / 2 + currentPan.y,
            );
            ctx.scale(currentZoom, currentZoom);
            ctx.rotate(angle);
            ctx.scale(scale, scale);

            ctx.beginPath();
            ctx.moveTo(
                calibrateStateRef.current.startPos.x,
                calibrateStateRef.current.startPos.y,
            );
            ctx.lineTo(worldMousePosRef.current.x, worldMousePosRef.current.y);
            ctx.strokeStyle = "#ff4655";
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.stroke();

            const dx =
                worldMousePosRef.current.x -
                calibrateStateRef.current.startPos.x;
            const dy =
                worldMousePosRef.current.y -
                calibrateStateRef.current.startPos.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);
            const mToPx = selectedMap?.pixelsPerMeter || 20;
            const meters = (distPx / mToPx).toFixed(1);

            ctx.translate(
                worldMousePosRef.current.x,
                worldMousePosRef.current.y,
            );
            ctx.rotate(-angle);
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.fillRect(10 / scale, 10 / scale, 90 / scale, 24 / scale);
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${12 / scale}px sans-serif`;
            ctx.fillText(
                `${Math.round(distPx)}px (${meters}m)`,
                15 / scale,
                26 / scale,
            );
            ctx.restore();
        }

        // 4. Draw other users' cursors (Collaboration)
        ctx.save();
        for (const cursor of Array.from(remoteCursors.values())) {
            const screenPos =
                cursor.x !== undefined && cursor.y !== undefined
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
    }, [selectedMap, selectedSide, tool, agents, remoteCursors]);

    // Keep ref always up-to-date so scheduleRedraw can call the latest version
    redrawImmediateRef.current = redrawImmediate;

    const updateUndoRedo = useCallback(() => {
        setCanUndo(undoStackRef.current.length > 0);
        setCanRedo(redoStackRef.current.length > 0);
    }, []);

    const broadcastStrokeUpdate = useCallback(
        (path: CanvasPath, finished: boolean) => {
            if (!current || !isSupabaseConfigured || !channelRef.current)
                return;
            channelRef.current.send({
                type: "broadcast",
                event: "draw-stroke",
                payload: {
                    path,
                    finished,
                    userId: myUserId,
                },
            });
        },
        [current, myUserId],
    );

    const broadcastAgentUpdate = useCallback(
        (agent: CanvasAgent, dragging: boolean) => {
            if (!current || !isSupabaseConfigured || !channelRef.current)
                return;
            channelRef.current.send({
                type: "broadcast",
                event: "drag-agent",
                payload: {
                    agent,
                    dragging,
                    userId: myUserId,
                },
            });
        },
        [current, myUserId],
    );

    const broadcastSkillUpdate = useCallback(
        (skill: CanvasSkill, dragging: boolean) => {
            if (!current || !isSupabaseConfigured || !channelRef.current)
                return;
            channelRef.current.send({
                type: "broadcast",
                event: "drag-skill",
                payload: {
                    skill,
                    dragging,
                    userId: myUserId,
                },
            });
        },
        [current, myUserId],
    );

    const broadcastEraseElements = useCallback(
        (
            erasedPathIds: string[],
            erasedAgentIds: string[],
            erasedSkillIds: string[] = [],
        ) => {
            if (!current || !isSupabaseConfigured || !channelRef.current)
                return;
            channelRef.current.send({
                type: "broadcast",
                event: "erase-elements",
                payload: {
                    erasedPathIds,
                    erasedAgentIds,
                    erasedSkillIds,
                    userId: myUserId,
                },
            });
        },
        [current, myUserId],
    );

    // ── Collaboration: Auto-save with debounce (forward-declared ref for saveStrategyMutation) ──
    const scheduleAutoSaveRef = useRef<() => void>(() => {});
    const scheduleAutoSave = useCallback(() => {
        scheduleAutoSaveRef.current();
    }, []);

    const clearAll = useCallback(() => {
        const oldPaths = [...pathsRef.current];
        const oldAgents = [...agentsRef.current];
        const oldSkills = [...skillsRef.current];
        undoStackRef.current.push({
            type: "clear-all",
            paths: oldPaths,
            agents: oldAgents,
            skills: oldSkills,
        });
        redoStackRef.current = [];
        pathsRef.current = [];
        agentsRef.current = [];
        skillsRef.current = [];
        updateUndoRedo();
        redrawImmediate();
        if (current && isSupabaseConfigured && channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "canvas-clear",
                payload: { userId: myUserId },
            });
        }
        scheduleAutoSave();
    }, [current, myUserId, updateUndoRedo, scheduleAutoSave]);

    const undo = useCallback(() => {
        const action = undoStackRef.current.pop();
        if (!action) return;

        switch (action.type) {
            case "add-path": {
                pathsRef.current = pathsRef.current.filter(
                    (p) => p.id !== action.path.id,
                );
                redoStackRef.current.push(action);
                broadcastEraseElements([action.path.id], []);
                break;
            }
            case "remove-path": {
                pathsRef.current.splice(action.index, 0, action.path);
                loadedPathIdsRef.current.add(action.path.id);
                redoStackRef.current.push(action);
                broadcastStrokeUpdate(action.path, true);
                break;
            }
            case "add-agent": {
                agentsRef.current = agentsRef.current.filter(
                    (a) => a.instanceId !== action.agent.instanceId,
                );
                redoStackRef.current.push(action);
                broadcastEraseElements([], [action.agent.instanceId]);
                break;
            }
            case "remove-agent": {
                agentsRef.current.splice(action.index, 0, action.agent);
                if (action.linkedSkills) {
                    action.linkedSkills.forEach((ls) => {
                        skillsRef.current.splice(ls.index, 0, ls.skill);
                        loadedSkillIdsRef.current.add(ls.skill.instanceId);
                    });
                }
                redoStackRef.current.push(action);
                broadcastAgentUpdate(action.agent, false);
                if (action.linkedSkills) {
                    action.linkedSkills.forEach((ls) =>
                        broadcastSkillUpdate(ls.skill, false),
                    );
                }
                loadedAgentIdsRef.current.add(action.agent.instanceId);
                break;
            }
            case "move-agent": {
                const agent = agentsRef.current.find(
                    (a) => a.instanceId === action.agentId,
                );
                if (agent) {
                    agent.x = action.oldX;
                    agent.y = action.oldY;
                    redoStackRef.current.push(action);
                    broadcastAgentUpdate(agent, false);
                }
                break;
            }
            case "add-skill": {
                skillsRef.current = skillsRef.current.filter(
                    (s) => s.instanceId !== action.skill.instanceId,
                );
                redoStackRef.current.push(action);
                broadcastEraseElements([], [], [action.skill.instanceId]);
                break;
            }
            case "remove-skill": {
                skillsRef.current.splice(action.index, 0, action.skill);
                loadedSkillIdsRef.current.add(action.skill.instanceId);
                redoStackRef.current.push(action);
                broadcastSkillUpdate(action.skill, false);
                break;
            }
            case "clear-all": {
                pathsRef.current = action.paths;
                agentsRef.current = action.agents;
                if (action.skills) skillsRef.current = action.skills;
                redoStackRef.current.push(action);
                break;
            }
        }

        redraw();
        updateUndoRedo();
        scheduleAutoSave();
    }, [
        redraw,
        updateUndoRedo,
        broadcastEraseElements,
        broadcastStrokeUpdate,
        broadcastAgentUpdate,
        scheduleAutoSave,
    ]);

    const redo = useCallback(() => {
        const action = redoStackRef.current.pop();
        if (!action) return;

        switch (action.type) {
            case "add-path": {
                pathsRef.current.push(action.path);
                loadedPathIdsRef.current.add(action.path.id);
                undoStackRef.current.push(action);
                broadcastStrokeUpdate(action.path, true);
                break;
            }
            case "remove-path": {
                pathsRef.current = pathsRef.current.filter(
                    (p) => p.id !== action.path.id,
                );
                undoStackRef.current.push(action);
                broadcastEraseElements([action.path.id], []);
                break;
            }
            case "add-agent": {
                agentsRef.current.push(action.agent);
                undoStackRef.current.push(action);
                broadcastAgentUpdate(action.agent, false);
                loadedAgentIdsRef.current.add(action.agent.instanceId);
                break;
            }
            case "remove-agent": {
                agentsRef.current = agentsRef.current.filter(
                    (a) => a.instanceId !== action.agent.instanceId,
                );
                if (action.linkedSkills) {
                    const skillIds = new Set(
                        action.linkedSkills.map((ls) => ls.skill.instanceId),
                    );
                    skillsRef.current = skillsRef.current.filter(
                        (s) => !skillIds.has(s.instanceId),
                    );
                }
                undoStackRef.current.push(action);
                const skillIds = action.linkedSkills
                    ? action.linkedSkills.map((ls) => ls.skill.instanceId)
                    : [];
                broadcastEraseElements([], [action.agent.instanceId], skillIds);
                break;
            }
            case "move-agent": {
                const agent = agentsRef.current.find(
                    (a) => a.instanceId === action.agentId,
                );
                if (agent) {
                    agent.x = action.newX;
                    agent.y = action.newY;
                    undoStackRef.current.push(action);
                    broadcastAgentUpdate(agent, false);
                }
                break;
            }
            case "add-skill": {
                skillsRef.current.push(action.skill);
                loadedSkillIdsRef.current.add(action.skill.instanceId);
                undoStackRef.current.push(action);
                broadcastSkillUpdate(action.skill, false);
                break;
            }
            case "remove-skill": {
                skillsRef.current = skillsRef.current.filter(
                    (s) => s.instanceId !== action.skill.instanceId,
                );
                undoStackRef.current.push(action);
                broadcastEraseElements([], [], [action.skill.instanceId]);
                break;
            }
            case "clear-all": {
                pathsRef.current = [];
                agentsRef.current = [];
                skillsRef.current = [];
                undoStackRef.current.push(action);
                break;
            }
        }

        redraw();
        updateUndoRedo();
        scheduleAutoSave();
    }, [
        redraw,
        updateUndoRedo,
        broadcastEraseElements,
        broadcastStrokeUpdate,
        broadcastAgentUpdate,
        scheduleAutoSave,
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (
                    (isPlacingSecondPointRef.current ||
                        isPlacingMultiDisplacementRef.current) &&
                    draggedSkillTargetRef.current
                ) {
                    const sId = draggedSkillTargetRef.current.instanceId;
                    skillsRef.current = skillsRef.current.filter(
                        (s) => s.instanceId !== sId,
                    );
                    undoStackRef.current.pop();
                    isPlacingSecondPointRef.current = false;
                    isPlacingMultiDisplacementRef.current = false;
                    draggedSkillTargetRef.current = null;
                    setTool("select");
                    redrawImmediate();
                    broadcastEraseElements([], [], [sId]);
                }
            }
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
        // Redraw when view or current changes
        redraw();
    }, [view, current]);

    useEffect(() => {
        redraw();
    }, [zoom, pan, redraw]);

    const getScreenPos = (mx: number, my: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const baseAngle = ((selectedMap?.rotationOffset || 0) * Math.PI) / 180;
        const angle =
            (selectedSide === "attack" ? Math.PI / 2 : -Math.PI / 2) +
            baseAngle;

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

        const screenX =
            canvas.width / 2 + panRef.current.x + x_rot2 * zoomRef.current;
        const screenY =
            canvas.height / 2 + panRef.current.y + y_rot2 * zoomRef.current;

        return { x: screenX, y: screenY };
    };

    const getPos = (
        e: React.MouseEvent | React.TouchEvent | React.DragEvent,
    ) => {
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

        const baseAngle = ((selectedMap?.rotationOffset || 0) * Math.PI) / 180;
        const angle =
            (selectedSide === "attack" ? Math.PI / 2 : -Math.PI / 2) +
            baseAngle;
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
    const pointToSegmentDist = (
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number,
    ): number => {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
        const t = Math.max(
            0,
            Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq),
        );
        return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
    };

    const isSkillHit = (
        s: CanvasSkill,
        mouseX: number,
        mouseY: number,
        pos: { x: number; y: number },
    ): boolean => {
        const isLinked =
            !s.unlinked &&
            [
                "projectile_terminal_aoe",
                "projectile_sweeping",
                "linear_wall",
                "self_mobile_aura",
                "static_deployable",
                "autonomous_entity",
                "equip_weapon",
                "dash_teleport",
                "self_instant",
            ].includes(getDeploymentType(s));
        if (!isLinked) {
            const screenPos = getScreenPos(s.x, s.y);
            if (
                Math.sqrt(
                    (screenPos.x - mouseX) ** 2 + (screenPos.y - mouseY) ** 2,
                ) <=
                12 * zoomRef.current
            )
                return true;
        }

        if (s.targetX !== undefined && s.targetY !== undefined) {
            const targetScreenPos = getScreenPos(s.targetX, s.targetY);
            if (
                Math.sqrt(
                    (targetScreenPos.x - mouseX) ** 2 +
                        (targetScreenPos.y - mouseY) ** 2,
                ) <=
                12 * zoomRef.current
            )
                return true;
        }

        if (s.pathPoints && s.pathPoints.length > 2) {
            for (let i = 1; i < s.pathPoints.length - 1; i++) {
                const ptScreen = getScreenPos(
                    s.pathPoints[i].x,
                    s.pathPoints[i].y,
                );
                const pdx = ptScreen.x - mouseX;
                const pdy = ptScreen.y - mouseY;
                if (Math.sqrt(pdx * pdx + pdy * pdy) <= 12 * zoomRef.current) {
                    return true;
                }
            }
        }

        if (!s.deployment) return false;
        const mToPx = selectedMap?.pixelsPerMeter || 20;
        const geom = getGeometry(s) || { type: "none" };

        const isProj =
            ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                getDeploymentType(s),
            ) ||
            ["dash_teleport"].includes(getDeploymentType(s)) ||
            !!["linear_wall"].includes(getDeploymentType(s));
        let drawOriginX = s.x;
        let drawOriginY = s.y;
        if (
            isProj &&
            s.targetX !== undefined &&
            s.targetY !== undefined &&
            geom.type !== "curve"
        ) {
            drawOriginX = s.targetX;
            drawOriginY = s.targetY;
        }

        const wdx = pos.x - drawOriginX;
        const wdy = pos.y - drawOriginY;

        if (geom.type === "none") {
            return Math.sqrt(wdx * wdx + wdy * wdy) <= 12 / zoomRef.current;
        } else if (geom.type === "circle") {
            if (isProj && s.targetX !== undefined && s.targetY !== undefined) {
                // For projectiles, the circle is usually a large AoE indicator.
                // We already check the target anchor (and image) above, so skip the huge circle hit detection.
                return false;
            }
            const radius =
                (geom.type === "circle" && geom.radius !== undefined
                    ? geom.radius
                    : getGeomWidth(geom) / 2) * mToPx;
            return Math.sqrt(wdx * wdx + wdy * wdy) <= radius;
        } else if (
            geom.type === "rectangle" ||
            geom.type === "cone" ||
            geom.type === "trapezoid"
        ) {
            const width = getGeomWidth(geom) * mToPx;
            let length = getGeomLength(geom) * mToPx;
            if (false && s.targetX !== undefined && s.targetY !== undefined) {
                length = Math.sqrt(
                    ((s.targetX || 0) - s.x) ** 2 +
                        ((s.targetY || 0) - s.y) ** 2,
                );
            }
            const angle =
                s.targetX !== undefined && s.targetY !== undefined
                    ? Math.atan2(s.targetY - s.y, s.targetX - s.x)
                    : 0;
            const localX = wdx * Math.cos(-angle) - wdy * Math.sin(-angle);
            const localY = wdx * Math.sin(-angle) + wdy * Math.cos(-angle);
            return (
                localX >= 0 && localX <= length && Math.abs(localY) <= width / 2
            );
        } else if (
            geom.type === "curve" &&
            s.targetX !== undefined &&
            s.targetY !== undefined
        ) {
            const midX = s.x + (s.targetX - s.x) / 2;
            const midY = s.y + (s.targetY - s.y) / 2;
            const screenMid = getScreenPos(midX, midY);
            if (
                Math.sqrt(
                    (screenMid.x - mouseX) ** 2 + (screenMid.y - mouseY) ** 2,
                ) <=
                20 * zoomRef.current
            )
                return true;
        }
        return false;
    };

    // Finds the path closest to (worldX, worldY) within hitRadius (in world units)
    // Skips eraser-type paths and paths fully covered by eraser paths drawn AFTER them
    const findPathAtPoint = (
        worldX: number,
        worldY: number,
        hitRadius: number,
    ): CanvasPath | null => {
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
                        worldX,
                        worldY,
                        ep.points[j - 1].x,
                        ep.points[j - 1].y,
                        ep.points[j].x,
                        ep.points[j].y,
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
                    worldX,
                    worldY,
                    path.points[j - 1].x,
                    path.points[j - 1].y,
                    path.points[j].x,
                    path.points[j].y,
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

    const startDraw = (
        e: React.MouseEvent | React.TouchEvent | React.DragEvent,
    ) => {
        if (
            isPlacingMultiDisplacementRef.current &&
            draggedSkillTargetRef.current
        ) {
            const confirmedSkill = draggedSkillTargetRef.current;
            const maxDisplacements = 0 || 1;

            if (
                confirmedSkill.targetX !== undefined &&
                confirmedSkill.targetY !== undefined
            ) {
                confirmedSkill.pathPoints!.push({
                    x: confirmedSkill.targetX,
                    y: confirmedSkill.targetY,
                });
            }

            if (confirmedSkill.pathPoints!.length <= maxDisplacements) {
                // Keep the mode active for the next dash target
                redrawImmediate();
                return;
            }

            // Finished multi-displacement
            isPlacingMultiDisplacementRef.current = false;
            draggedSkillTargetRef.current = null;
            broadcastSkillUpdate(confirmedSkill, false);
            redrawImmediate();
            updateUndoRedo();
            scheduleAutoSave();
            return;
        }

        if (isPlacingSecondPointRef.current && draggedSkillTargetRef.current) {
            // Confirm second point placement
            const confirmedSkill = draggedSkillTargetRef.current;
            isPlacingSecondPointRef.current = false;
            draggedSkillTargetRef.current = null;
            broadcastSkillUpdate(confirmedSkill, false);
            redrawImmediate();
            updateUndoRedo();
            scheduleAutoSave();
            return;
        }

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
        const pos = getPos(e);

        // Left-click on agent with select tool → context menu or drag
        if (!isRightClick && tool === "select") {
            const canvas = canvasRef.current;
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = cx - rect.left;
                const mouseY = cy - rect.top;
                const found = [...agentsRef.current].reverse().find((a) => {
                    if (a.draggedBy && a.draggedBy !== myUserId) return false;
                    const hasDraggedLinkedSkill = skillsRef.current.some(
                        (s) =>
                            s.agentInstanceId === a.instanceId &&
                            !s.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(s) as string) &&
                            s.draggedBy &&
                            s.draggedBy !== myUserId,
                    );
                    if (hasDraggedLinkedSkill) return false;
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

                let foundSkillRot: CanvasSkill | null = null;
                let foundSkillPathPointIndex: number | null = null;
                const foundSkillTarget = [...skillsRef.current]
                    .reverse()
                    .find((s) => {
                        if (s.draggedBy && s.draggedBy !== myUserId)
                            return false;
                        const linkedAgent =
                            !s.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(s) as string)
                                ? agentsRef.current.find(
                                      (a) => a.instanceId === s.agentInstanceId,
                                  )
                                : null;
                        if (
                            linkedAgent &&
                            linkedAgent.draggedBy &&
                            linkedAgent.draggedBy !== myUserId
                        )
                            return false;
                        if (s.targetX === undefined || s.targetY === undefined)
                            return false;

                        if (
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                            ].includes(getDeploymentType(s)) &&
                            (getDeploymentType(s) === "cross" ||
                                [
                                    "linear_wall",
                                    "projectile_sweeping",
                                    "two_point_barrier",
                                ].includes(getDeploymentType(s)) ||
                                getDeploymentType(s) === "autonomous_entity" ||
                                getDeploymentType(s) === "trapezoid")
                        ) {
                            const rotAngle =
                                s.customRotation !== undefined
                                    ? s.customRotation
                                    : Math.atan2(
                                          s.targetY - s.y,
                                          s.targetX - s.x,
                                      );

                            let scale = 1;
                            const mapImg = mapImgRef.current;
                            if (mapImg && mapImg.complete) {
                                scale = Math.min(
                                    canvas.width / mapImg.height,
                                    canvas.height / mapImg.width,
                                );
                            }
                            const rotDist = 30 / scale;
                            const rx = s.targetX + Math.cos(rotAngle) * rotDist;
                            const ry = s.targetY + Math.sin(rotAngle) * rotDist;
                            const screenPos = getScreenPos(rx, ry);
                            if (
                                Math.sqrt(
                                    (screenPos.x - mouseX) ** 2 +
                                        (screenPos.y - mouseY) ** 2,
                                ) <=
                                12 * zoomRef.current
                            ) {
                                foundSkillRot = s;
                            }
                        }

                        if (s.pathPoints && s.pathPoints.length > 2) {
                            for (let i = 1; i < s.pathPoints.length - 1; i++) {
                                const ptScreen = getScreenPos(
                                    s.pathPoints[i].x,
                                    s.pathPoints[i].y,
                                );
                                const pdx = ptScreen.x - mouseX;
                                const pdy = ptScreen.y - mouseY;
                                if (
                                    Math.sqrt(pdx * pdx + pdy * pdy) <=
                                    12 * zoomRef.current
                                ) {
                                    foundSkillPathPointIndex = i;
                                    return true;
                                }
                            }
                        }

                        const screenPos = getScreenPos(s.targetX, s.targetY);
                        const dx = screenPos.x - mouseX;
                        const dy = screenPos.y - mouseY;
                        return (
                            Math.sqrt(dx * dx + dy * dy) <= 12 * zoomRef.current
                        );
                    });

                if (foundSkillRot) {
                    draggedSkillRotationRef.current = foundSkillRot;
                    return;
                }
                if (foundSkillTarget) {
                    draggedSkillTargetRef.current = foundSkillTarget;
                    draggedSkillPathPointIndexRef.current =
                        foundSkillPathPointIndex;
                    return;
                }

                const foundSkill = [...skillsRef.current]
                    .reverse()
                    .find((s) => {
                        if (s.draggedBy && s.draggedBy !== myUserId)
                            return false;
                        const linkedAgent =
                            !s.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(s) as string)
                                ? agentsRef.current.find(
                                      (a) => a.instanceId === s.agentInstanceId,
                                  )
                                : null;
                        if (
                            linkedAgent &&
                            linkedAgent.draggedBy &&
                            linkedAgent.draggedBy !== myUserId
                        )
                            return false;
                        return isSkillHit(s, mouseX, mouseY, pos);
                    });
                if (foundSkill) {
                    const isLinked =
                        !foundSkill.unlinked &&
                        [
                            "projectile_terminal_aoe",
                            "projectile_sweeping",
                            "linear_wall",
                            "self_mobile_aura",
                            "static_deployable",
                            "autonomous_entity",
                            "equip_weapon",
                            "dash_teleport",
                            "self_instant",
                        ].includes(getDeploymentType(foundSkill));
                    if (!isLinked) {
                        draggedSkillRef.current = foundSkill;
                        draggedSkillOffsetRef.current = {
                            x: foundSkill.x - pos.x,
                            y: foundSkill.y - pos.y,
                        };
                    }
                    return;
                }

                // In Sandbox mode, we no longer process activatable skills via clicks.
                // They are just static props like any other anchor/smoke.
            }
        }

        if (isRightClick) {
            panningRef.current = true;
            panStartRef.current = {
                x: cx - panRef.current.x,
                y: cy - panRef.current.y,
            };
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = "grabbing";

            // Global listeners so pan continues outside the canvas bounds
            const panMoveHandler = (ev: MouseEvent) =>
                draw(ev as unknown as React.MouseEvent);
            const panUpHandler = () => {
                window.removeEventListener("mousemove", panMoveHandler);
                window.removeEventListener("mouseup", panUpHandler);
                stopDraw();
            };
            window.addEventListener("mousemove", panMoveHandler);
            window.addEventListener("mouseup", panUpHandler);
            return;
        }

        const canvas = canvasRef.current;

        // ── Line Eraser: erase whole path on mousedown ──
        if (canvas && tool === "eraser" && eraserMode === "lines") {
            const mapImg = mapImgRef.current;
            let scale = 1;
            if (mapImg && mapImg.complete) {
                const rotatedW = mapImg.height;
                const rotatedH = mapImg.width;
                scale = Math.min(
                    canvas.width / rotatedW,
                    canvas.height / rotatedH,
                );
            }
            const hitRadius = eraserSize / 2 / (zoomRef.current * scale);
            const hit = findPathAtPoint(pos.x, pos.y, hitRadius);

            const hitAgent = agentsRef.current.find((a) => {
                const screenPos = getScreenPos(a.x, a.y);
                const dx =
                    screenPos.x - (cx - canvas.getBoundingClientRect().left);
                const dy =
                    screenPos.y - (cy - canvas.getBoundingClientRect().top);
                return (
                    Math.sqrt(dx * dx + dy * dy) <=
                    (18 + eraserSize / 2) * zoomRef.current
                );
            });

            const hitSkill = skillsRef.current.find((s) => {
                const screenPos = getScreenPos(s.x, s.y);
                const dx =
                    screenPos.x - (cx - canvas.getBoundingClientRect().left);
                const dy =
                    screenPos.y - (cy - canvas.getBoundingClientRect().top);
                return (
                    Math.sqrt(dx * dx + dy * dy) <=
                    (12 + eraserSize / 2) * zoomRef.current
                );
            });

            if (hit) {
                const erasedId = hit.id;
                const erasedIdx = pathsRef.current.findIndex(
                    (p) => p.id === erasedId,
                );
                const erasedPath = pathsRef.current.find(
                    (p) => p.id === erasedId,
                )!;
                undoStackRef.current.push({
                    type: "remove-path",
                    path: erasedPath,
                    index: erasedIdx,
                });
                redoStackRef.current = [];
                pathsRef.current = pathsRef.current.filter(
                    (p) => p.id !== erasedId,
                );
                if (hoveredPathIdRef.current === erasedId)
                    hoveredPathIdRef.current = null;
                updateUndoRedo();
                redrawImmediate();
                broadcastEraseElements([erasedId], []);
                scheduleAutoSave();
            }
            if (hitAgent) {
                const agentIdx = agentsRef.current.findIndex(
                    (a) => a.instanceId === hitAgent.instanceId,
                );
                const linkedSkills: { skill: CanvasSkill; index: number }[] =
                    [];
                skillsRef.current.forEach((s, idx) => {
                    if (
                        s.agentInstanceId === hitAgent.instanceId &&
                        !s.unlinked
                    )
                        linkedSkills.push({ skill: s, index: idx });
                });
                undoStackRef.current.push({
                    type: "remove-agent",
                    agent: hitAgent,
                    index: agentIdx,
                    linkedSkills,
                });
                redoStackRef.current = [];
                agentsRef.current = agentsRef.current.filter(
                    (a) => a.instanceId !== hitAgent.instanceId,
                );
                if (linkedSkills.length > 0) {
                    const skillIds = new Set(
                        linkedSkills.map((ls) => ls.skill.instanceId),
                    );
                    skillsRef.current = skillsRef.current.filter(
                        (s) => !skillIds.has(s.instanceId),
                    );
                }
                updateUndoRedo();
                redrawImmediate();
                const deletedSkillIds = Array.from(
                    new Set(linkedSkills.map((ls) => ls.skill.instanceId)),
                );
                broadcastEraseElements(
                    [],
                    [hitAgent.instanceId],
                    deletedSkillIds,
                );
                scheduleAutoSave();
            }
            if (hitSkill) {
                const skillIdx = skillsRef.current.findIndex(
                    (s) => s.instanceId === hitSkill.instanceId,
                );
                undoStackRef.current.push({
                    type: "remove-skill",
                    skill: hitSkill,
                    index: skillIdx,
                });
                redoStackRef.current = [];
                skillsRef.current = skillsRef.current.filter(
                    (s) => s.instanceId !== hitSkill.instanceId,
                );
                updateUndoRedo();
                redrawImmediate();
                broadcastEraseElements([], [], [hitSkill.instanceId]);
                scheduleAutoSave();
            }
            drawingRef.current = true;
            const moveHandler = (e: MouseEvent) =>
                globalMouseMoveRef.current(e);
            const upHandler = () => globalMouseUpRef.current();
            globalMouseMoveRef.current = (e: MouseEvent) =>
                draw(e as unknown as React.MouseEvent);
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
            agentsRef.current = agentsRef.current.filter((a) => {
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
                    const idx = agentsRef.current.findIndex(
                        (a) => a.instanceId === agent.instanceId,
                    );
                    undoStackRef.current.push({
                        type: "remove-agent",
                        agent,
                        index: idx < 0 ? agentsRef.current.length : idx,
                    });
                }
                redoStackRef.current = [];
                redraw();
                broadcastEraseElements(
                    [],
                    erasedAgents.map((a) => a.instanceId),
                );
                updateUndoRedo();
                scheduleAutoSave();
            }
        }
        if (pendingSkillRef.current) {
            const {
                agentInstanceId,
                skill,
                color: skillColor,
            } = pendingSkillRef.current;
            const agentObj = agentsRef.current.find(
                (a) => a.instanceId === agentInstanceId,
            );

            let startX = pos.x;
            let startY = pos.y;

            const mToPx = selectedMap?.pixelsPerMeter || 20;

            let playerToMouseAngle = 0;
            if (
                ["dash_teleport"].includes(getDeploymentType(skill)) &&
                agentObj
            ) {
                startX = agentObj.x;
                startY = agentObj.y;
                playerToMouseAngle = Math.atan2(pos.y - startY, pos.x - startX);
                if (
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(getDeploymentType(skill)) &&
                    skill.deployment?.windup
                ) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                }
            } else if (
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(getDeploymentType(skill)) &&
                agentObj
            ) {
                startX = agentObj.x;
                startY = agentObj.y;
                playerToMouseAngle = Math.atan2(pos.y - startY, pos.x - startX);

                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        (skill.deployment?.windup || 0) *
                        mToPx;
                }
            } else if (
                ["map_target_aoe", "two_point_barrier"].includes(
                    getDeploymentType(skill),
                ) &&
                agentObj
            ) {
                const maxRange = getCastRange(skill);
                if (maxRange > 0) {
                    const maxPx = maxRange * mToPx;
                    const dist = Math.sqrt(
                        (pos.x - agentObj.x) ** 2 + (pos.y - agentObj.y) ** 2,
                    );
                    if (dist > maxPx) {
                        const angle = Math.atan2(
                            pos.y - agentObj.y,
                            pos.x - agentObj.x,
                        );
                        startX = agentObj.x + Math.cos(angle) * maxPx;
                        startY = agentObj.y + Math.sin(angle) * maxPx;
                    }
                }
            }

            let initTargetX: number | undefined = undefined;
            let initTargetY: number | undefined = undefined;
            const isProj =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    getDeploymentType(skill),
                ) ||
                ["dash_teleport"].includes(getDeploymentType(skill)) ||
                !!["linear_wall"].includes(getDeploymentType(skill));
            const isGeomWithTarget =
                !isProj &&
                skill.deployment &&
                ([
                    "linear_wall",
                    "projectile_sweeping",
                    "two_point_barrier",
                ].includes(getDeploymentType(skill)) ||
                    getDeploymentType(skill) === "autonomous_entity" ||
                    [
                        "linear_wall",
                        "projectile_sweeping",
                        "two_point_barrier",
                    ].includes(getDeploymentType(skill)));

            if (isGeomWithTarget || isProj) {
                const length = getAoeLength(skill) * mToPx;

                if (
                    ["dash_teleport"].includes(getDeploymentType(skill)) &&
                    agentObj
                ) {
                    const sa = playerToMouseAngle;
                    let { maxRange, isFixed: projIsFixed } =
                        getProjRangeAndFixed(skill);
                    if (
                        [
                            "map_target_aoe",
                            "two_point_barrier",
                            "dash_teleport",
                        ].includes(getDeploymentType(skill))
                    ) {
                        maxRange = getCastRange(skill);
                        projIsFixed = false;
                    }
                    let tX = pos.x;
                    let tY = pos.y;

                    if (maxRange > 0) {
                        const maxPx = maxRange * mToPx;
                        const dx = tX - startX;
                        const dy = tY - startY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (projIsFixed || dist > maxPx) {
                            const angle = Math.atan2(dy, dx);
                            tX = startX + Math.cos(angle) * maxPx;
                            tY = startY + Math.sin(angle) * maxPx;
                        }
                    }
                    initTargetX = tX;
                    initTargetY = tY;
                } else if (
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(getDeploymentType(skill)) &&
                    agentObj
                ) {
                    const sa = playerToMouseAngle;
                    if (false) {
                        const maxLen =
                            (0 /* no max length */ ||
                                getAoeLength(skill) ||
                                0) * mToPx;
                        const dx = pos.x - startX;
                        const dy = pos.y - startY;
                        let dist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        dist = Math.max(0, Math.min(dist, maxLen));
                        initTargetX = startX + Math.cos(sa) * dist;
                        initTargetY = startY + Math.sin(sa) * dist;
                    } else if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(skill);
                        let tX = pos.x;
                        let tY = pos.y;

                        if (maxRange > 0) {
                            const maxPx = maxRange * mToPx;
                            const dx = tX - agentObj.x;
                            const dy = tY - agentObj.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (projIsFixed || dist > maxPx) {
                                const angle = Math.atan2(dy, dx);
                                tX = agentObj.x + Math.cos(angle) * maxPx;
                                tY = agentObj.y + Math.sin(angle) * maxPx;
                            }
                        }

                        const dx = tX - startX;
                        const dy = tY - startY;
                        const projDist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        if (projDist <= 0.1) {
                            initTargetX = startX + Math.cos(sa) * 0.1;
                            initTargetY = startY + Math.sin(sa) * 0.1;
                        } else {
                            initTargetX = tX;
                            initTargetY = tY;
                        }
                    } else {
                        initTargetX = startX + Math.cos(sa) * length;
                        initTargetY = startY + Math.sin(sa) * length;
                    }
                } else {
                    // ground spawn: enforce maxCastRange if set
                    if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(skill);
                        const maxPx = maxRange * mToPx;
                        const spawnLen = maxPx > 0 ? maxPx : 10 * mToPx;
                        let angle = 0;
                        if (agentObj) {
                            angle = Math.atan2(
                                pos.y - agentObj.y,
                                pos.x - agentObj.x,
                            );
                        }
                        initTargetX = startX + Math.cos(angle) * spawnLen;
                        initTargetY = startY + Math.sin(angle) * spawnLen;
                    } else if (false) {
                        initTargetX =
                            pos.x +
                            (0 /* no min length */ ||
                                getAoeLength(skill) ||
                                0) *
                                mToPx;
                        initTargetY = pos.y;
                    } else {
                        initTargetX = pos.x + length;
                        initTargetY = pos.y;
                    }
                }
            }

            // For two-point deployment skills, always set initial target at mouse position
            // so the user can aim with the mouse before the second click
            if (
                ["two_point_barrier"].includes(
                    getDeploymentType(skill) as string,
                )
            ) {
                initTargetX = pos.x;
                initTargetY = pos.y;
            }

            const newSkill: CanvasSkill = {
                instanceId: Math.random().toString(36).substring(2, 9),
                agentInstanceId,
                key: skill.key,
                x: startX,
                y: startY,
                targetX: initTargetX,
                targetY: initTargetY,
                deployment: skill.deployment,
                lifetime: skill.lifetime,
                resolution: skill.resolution,
                projectileMode: [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                ].includes(getDeploymentType(skill) as string)
                    ? projectileMode
                    : undefined,
                pathPoints:
                    ["linear_wall"].includes(
                        getDeploymentType(skill) as string,
                    ) || false /* no controllable flag yet */
                        ? [
                              { x: startX, y: startY },
                              {
                                  x: initTargetX ?? pos.x,
                                  y: initTargetY ?? pos.y,
                              },
                          ]
                        : undefined,
                color: skillColor,
                createdBy: myUserId,
                unlinked:
                    ["map_target_aoe", "two_point_barrier"].includes(
                        getDeploymentType(skill),
                    ) ||
                    !![
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                    ].includes(getDeploymentType(skill)) ||
                    !!["linear_wall"].includes(getDeploymentType(skill)),
            };

            skillsRef.current.push(newSkill);
            loadedSkillIdsRef.current.add(newSkill.instanceId);
            undoStackRef.current.push({ type: "add-skill", skill: newSkill });
            redoStackRef.current = [];

            if (
                ["equip_weapon"].includes(getDeploymentType(skill)) &&
                agentObj
            ) {
                agentObj.weaponId = "skill:" + skill.key;
            }

            drawingRef.current = true;
            pendingSkillRef.current = null;
            if (
                initTargetX !== undefined &&
                ["map_target_aoe", "two_point_barrier"].includes(
                    getDeploymentType(skill),
                ) &&
                !["dash_teleport", "self_instant"].includes(
                    getDeploymentType(skill),
                )
            ) {
                draggedSkillTargetRef.current = newSkill;
                isPlacingSecondPointRef.current = true;
            } else if (0 && 0 > 1) {
                draggedSkillTargetRef.current = newSkill;
                isPlacingMultiDisplacementRef.current = true;
                // Initialize pathPoints with the first committed dash target!
                newSkill.pathPoints = [
                    { x: startX, y: startY },
                    ...(initTargetX !== undefined && initTargetY !== undefined
                        ? [{ x: initTargetX, y: initTargetY }]
                        : []),
                ];
            } else {
                setTool("select");
            }

            updateUndoRedo();
            redrawImmediate();
            scheduleAutoSave();

            const moveHandler = (e: MouseEvent) =>
                globalMouseMoveRef.current(e);
            const upHandler = () => globalMouseUpRef.current();
            globalMouseMoveRef.current = (e: MouseEvent) =>
                draw(e as unknown as React.MouseEvent);
            globalMouseUpRef.current = () => {
                window.removeEventListener("mousemove", moveHandler);
                window.removeEventListener("mouseup", upHandler);
                stopDraw();
            };
            window.addEventListener("mousemove", moveHandler);
            window.addEventListener("mouseup", upHandler);
            return;
        }

        if (tool === "calibrate") {
            if (calibrateStateRef.current.step === "start") {
                calibrateStateRef.current = { step: "end", startPos: pos };
                drawingRef.current = true;
                const moveHandler = (e: MouseEvent) =>
                    globalMouseMoveRef.current(e);
                const upHandler = () => globalMouseUpRef.current();
                globalMouseMoveRef.current = (e: MouseEvent) =>
                    draw(e as unknown as React.MouseEvent);
                globalMouseUpRef.current = () => {
                    window.removeEventListener("mousemove", moveHandler);
                    window.removeEventListener("mouseup", upHandler);
                    stopDraw();
                };
                window.addEventListener("mousemove", moveHandler);
                window.addEventListener("mouseup", upHandler);
            } else if (
                calibrateStateRef.current.step === "end" &&
                calibrateStateRef.current.startPos
            ) {
                const dx = pos.x - calibrateStateRef.current.startPos.x;
                const dy = pos.y - calibrateStateRef.current.startPos.y;
                const distPx = Math.sqrt(dx * dx + dy * dy);
                calibrateStateRef.current = { step: "start", startPos: null };
                if (distPx > 5) {
                    setCalibrateState({
                        step: "start",
                        startPos: null,
                        showModal: true,
                        distancePx: distPx,
                    });
                }
                redrawImmediate();
            }
            return;
        }

        drawingRef.current = true;
        const activeSize =
            tool === "draw"
                ? pencilSize
                : tool === "arrow"
                  ? arrowSize
                  : tool === "eraser"
                    ? eraserSize
                    : 5;
        const newPath = {
            id: Math.random().toString(36).substring(2, 9),
            tool,
            color,
            points: [pos],
            thickness: activeSize,
            createdBy: myUserId,
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
        globalMouseMoveRef.current = (e: MouseEvent) =>
            draw(e as unknown as React.MouseEvent);
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
            mousePosRef.current = {
                canvasX: cx - rect.left,
                canvasY: cy - rect.top,
            };
        }

        if (panningRef.current) {
            // Update pan ref immediately (no React re-render) for lag-free panning
            const newPan = {
                x: cx - panStartRef.current.x,
                y: cy - panStartRef.current.y,
            };
            panRef.current = newPan;
            pendingPanFlushRef.current = true;
            // Schedule a redraw via RAF instead of setState
            if (pendingRedrawRef !== null)
                cancelAnimationFrame(pendingRedrawRef);
            pendingRedrawRef = requestAnimationFrame(() => {
                pendingRedrawRef = null;
                redrawImmediate();
            });
            return;
        }

        const pos = getPos(e);
        worldMousePosRef.current = pos;

        if (tool === "calibrate" && calibrateStateRef.current.step === "end") {
            redrawImmediate();
        }

        if (pendingSkillRef.current) {
            redrawImmediate();
        }

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
                            canvasY: cy - rect.top,
                        },
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
                    customCursorRef.current.style.transform = `translate3d(${cx - rect.left}px, ${cy - rect.top}px, 0) translate(-50%, -50%)`;
                } else {
                    customCursorRef.current.style.display = "none";
                }
            }

            if (tool === "select") {
                if (isPlacingSecondPointRef.current) {
                    canvas.style.cursor = "crosshair";
                } else if (
                    draggedAgentRef.current ||
                    draggedSkillRef.current ||
                    draggedSkillTargetRef.current ||
                    draggedSkillRotationRef.current
                ) {
                    if (
                        draggedSkillTargetRef.current ||
                        draggedSkillRotationRef.current
                    ) {
                        canvas.style.cursor = "grabbing";
                    } else {
                        let cursorStyle = "grabbing";
                        dragHoveredLinkAgentRef.current = null;
                        if (draggedSkillRef.current) {
                            const skill = draggedSkillRef.current;
                            if (
                                skill.unlinked &&
                                [
                                    "projectile_terminal_aoe",
                                    "projectile_sweeping",
                                    "linear_wall",
                                    "self_mobile_aura",
                                    "static_deployable",
                                    "autonomous_entity",
                                    "equip_weapon",
                                    "dash_teleport",
                                    "self_instant",
                                ].includes(getDeploymentType(skill))
                            ) {
                                const originalCreator = agentsRef.current.find(
                                    (a) =>
                                        a.instanceId === skill.agentInstanceId,
                                );
                                if (originalCreator) {
                                    const mToPx =
                                        selectedMap?.pixelsPerMeter || 20;
                                    let linkableHoveredAgent = null;
                                    for (
                                        let i = agentsRef.current.length - 1;
                                        i >= 0;
                                        i--
                                    ) {
                                        const agent = agentsRef.current[i];
                                        const dist = Math.sqrt(
                                            (agent.x - pos.x) ** 2 +
                                                (agent.y - pos.y) ** 2,
                                        );
                                        if (dist < 2.5 * mToPx) {
                                            linkableHoveredAgent = agent;
                                            break;
                                        }
                                    }
                                    if (linkableHoveredAgent) {
                                        if (
                                            linkableHoveredAgent.id ===
                                            originalCreator.id
                                        ) {
                                            cursorStyle = "copy";
                                            dragHoveredLinkAgentRef.current =
                                                linkableHoveredAgent;
                                        } else {
                                            cursorStyle = "not-allowed";
                                        }
                                    }
                                }
                            }
                        }
                        canvas.style.cursor = cursorStyle;
                    }
                    if (hoveredAgentRef.current || hoveredSkillRef.current) {
                        hoveredAgentRef.current = null;
                        hoveredSkillRef.current = null;
                        setHoverMenuState((prev) => ({
                            ...prev,
                            visible: false,
                        }));
                    }
                } else {
                    const mouseX = cx - rect.left;
                    const mouseY = cy - rect.top;
                    let foundHoverAgent: CanvasAgent | null = null;
                    const isOverAgent = agentsRef.current.some((a) => {
                        if (a.draggedBy && a.draggedBy !== myUserId)
                            return false;
                        const hasDraggedLinkedSkill = skillsRef.current.some(
                            (s) =>
                                s.agentInstanceId === a.instanceId &&
                                !s.unlinked &&
                                [
                                    "projectile_terminal_aoe",
                                    "projectile_sweeping",
                                    "linear_wall",
                                    "self_mobile_aura",
                                    "static_deployable",
                                    "autonomous_entity",
                                    "equip_weapon",
                                    "dash_teleport",
                                    "self_instant",
                                ].includes(getDeploymentType(s) as string) &&
                                s.draggedBy &&
                                s.draggedBy !== myUserId,
                        );
                        if (hasDraggedLinkedSkill) return false;
                        const screenPos = getScreenPos(a.x, a.y);
                        const dx = screenPos.x - mouseX;
                        const dy = screenPos.y - mouseY;
                        const hit =
                            Math.sqrt(dx * dx + dy * dy) <=
                            18 * zoomRef.current;
                        if (hit) foundHoverAgent = a;
                        return hit;
                    });

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    let foundHoverSkillTarget: CanvasSkill | null = null;
                    const isOverSkillTarget = skillsRef.current.some((s) => {
                        if (s.draggedBy && s.draggedBy !== myUserId)
                            return false;
                        const linkedAgent =
                            !s.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(s) as string)
                                ? agentsRef.current.find(
                                      (a) => a.instanceId === s.agentInstanceId,
                                  )
                                : null;
                        if (
                            linkedAgent &&
                            linkedAgent.draggedBy &&
                            linkedAgent.draggedBy !== myUserId
                        )
                            return false;
                        if (s.targetX === undefined || s.targetY === undefined)
                            return false;
                        const screenPos = getScreenPos(s.targetX, s.targetY);
                        const dx = screenPos.x - mouseX;
                        const dy = screenPos.y - mouseY;
                        const hit =
                            Math.sqrt(dx * dx + dy * dy) <=
                            12 * zoomRef.current;
                        if (hit) foundHoverSkillTarget = s;
                        return hit;
                    });

                    let foundHoverSkill: CanvasSkill | null = null;
                    const isOverSkill = skillsRef.current.some((s) => {
                        if (s.draggedBy && s.draggedBy !== myUserId)
                            return false;
                        const linkedAgent =
                            !s.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(s) as string)
                                ? agentsRef.current.find(
                                      (a) => a.instanceId === s.agentInstanceId,
                                  )
                                : null;
                        if (
                            linkedAgent &&
                            linkedAgent.draggedBy &&
                            linkedAgent.draggedBy !== myUserId
                        )
                            return false;
                        const hit = isSkillHit(s, mouseX, mouseY, pos);
                        if (hit) foundHoverSkill = s;
                        return hit;
                    });

                    if (foundHoverAgent || foundHoverSkill) {
                        if (hoverMenuTimeoutRef.current)
                            clearTimeout(hoverMenuTimeoutRef.current);
                        hoverMenuTimeoutRef.current = null;

                        if (foundHoverAgent) {
                            if (hoveredAgentRef.current !== foundHoverAgent) {
                                hoveredAgentRef.current = foundHoverAgent;
                                hoveredSkillRef.current = null;
                                const screenPos = getScreenPos(
                                    (foundHoverAgent as CanvasAgent).x,
                                    (foundHoverAgent as CanvasAgent).y,
                                );
                                setHoverMenuState({
                                    agent: foundHoverAgent,
                                    skill: null,
                                    x: screenPos.x + rect.left,
                                    y: screenPos.y + rect.top,
                                    visible: true,
                                });
                                redrawImmediate();
                            }
                        } else if (foundHoverSkill) {
                            const fSkill = foundHoverSkill as CanvasSkill;
                            let menuX = fSkill.x;
                            let menuY = fSkill.y;
                            let anchor: "start" | "target" = "start";

                            if (
                                fSkill.targetX !== undefined &&
                                fSkill.targetY !== undefined
                            ) {
                                const screenStart = getScreenPos(
                                    fSkill.x,
                                    fSkill.y,
                                );
                                const screenTarget = getScreenPos(
                                    fSkill.targetX,
                                    fSkill.targetY,
                                );
                                const distStart = Math.sqrt(
                                    (screenStart.x - mouseX) ** 2 +
                                        (screenStart.y - mouseY) ** 2,
                                );
                                const distTarget = Math.sqrt(
                                    (screenTarget.x - mouseX) ** 2 +
                                        (screenTarget.y - mouseY) ** 2,
                                );

                                if (distTarget < distStart) {
                                    menuX = fSkill.targetX;
                                    menuY = fSkill.targetY;
                                    anchor = "target";
                                }
                            }

                            if (
                                hoveredSkillRef.current !== foundHoverSkill ||
                                hoveredSkillAnchorRef.current !== anchor
                            ) {
                                hoveredSkillRef.current = foundHoverSkill;
                                hoveredSkillAnchorRef.current = anchor;
                                hoveredAgentRef.current = null;

                                const screenPos = getScreenPos(menuX, menuY);

                                setHoverMenuState({
                                    agent: null,
                                    skill: foundHoverSkill,
                                    anchor: anchor,
                                    x: screenPos.x + rect.left,
                                    y: screenPos.y + rect.top,
                                    visible: true,
                                });
                                redrawImmediate();
                            } else {
                                redrawImmediate();
                            }
                        }
                    } else {
                        isAgentDroppedRef.current = false;
                        if (hoveredSkillRef.current) {
                            redrawImmediate();
                        }
                        if (
                            !hoverMenuTimeoutRef.current &&
                            (hoveredAgentRef.current || hoveredSkillRef.current)
                        ) {
                            hoverMenuTimeoutRef.current = setTimeout(() => {
                                hoveredAgentRef.current = null;
                                hoveredSkillRef.current = null;
                                setHoverMenuState((prev) => ({
                                    ...prev,
                                    visible: false,
                                }));
                                hoverMenuTimeoutRef.current = null;
                                redrawImmediate();
                            }, 300);
                        }
                    }

                    if (isOverSkillTarget) {
                        canvas.style.cursor = "grab";
                    } else if (isOverAgent) {
                        canvas.style.cursor = "grab";
                    } else if (isOverSkill && foundHoverSkill) {
                        const fs = foundHoverSkill as CanvasSkill;
                        const isLinked =
                            !fs.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(getDeploymentType(fs));
                        canvas.style.cursor = isLinked ? "pointer" : "grab";
                    } else {
                        canvas.style.cursor = "default";
                    }
                }
            } else if (tool === "eraser" && eraserMode === "lines") {
                const mapImg = mapImgRef.current;
                let scale = 1;
                if (mapImg && mapImg.complete) {
                    const rotatedW = mapImg.height;
                    const rotatedH = mapImg.width;
                    scale = Math.min(
                        canvas.width / rotatedW,
                        canvas.height / rotatedH,
                    );
                }
                const hitRadius = eraserSize / 2 / (zoomRef.current * scale);
                const pos2 = getPos(e);
                const hit = findPathAtPoint(pos2.x, pos2.y, hitRadius);
                hoveredPathIdRef.current = hit ? hit.id : null;

                // Check if cursor is over an agent
                const hitAgent = agentsRef.current.find((a) => {
                    const screenPos = getScreenPos(a.x, a.y);
                    const dx =
                        screenPos.x -
                        (cx - canvas.getBoundingClientRect().left);
                    const dy =
                        screenPos.y - (cy - canvas.getBoundingClientRect().top);
                    return (
                        Math.sqrt(dx * dx + dy * dy) <=
                        (18 + eraserSize / 2) * zoomRef.current
                    );
                });

                // Check if cursor is over a skill
                const hitSkill = skillsRef.current.find((s) => {
                    const screenPos = getScreenPos(s.x, s.y);
                    const dx =
                        screenPos.x -
                        (cx - canvas.getBoundingClientRect().left);
                    const dy =
                        screenPos.y - (cy - canvas.getBoundingClientRect().top);
                    return (
                        Math.sqrt(dx * dx + dy * dy) <=
                        (12 + eraserSize / 2) * zoomRef.current
                    );
                });

                canvas.style.cursor =
                    hit || hitAgent || hitSkill ? "pointer" : "none";

                // If dragging (mousedown held), erase paths and agents under cursor
                if (drawingRef.current) {
                    if (hit) {
                        const erasedId = hit.id;
                        const erasedIdx = pathsRef.current.findIndex(
                            (p) => p.id === erasedId,
                        );
                        const erasedPath = pathsRef.current.find(
                            (p) => p.id === erasedId,
                        )!;
                        undoStackRef.current.push({
                            type: "remove-path",
                            path: erasedPath,
                            index: erasedIdx,
                        });
                        redoStackRef.current = [];
                        pathsRef.current = pathsRef.current.filter(
                            (p) => p.id !== erasedId,
                        );
                        hoveredPathIdRef.current = null;
                        updateUndoRedo();
                        redrawImmediate();
                        broadcastEraseElements([erasedId], []);
                        scheduleAutoSave();
                    }
                    if (hitAgent) {
                        const agentIdx = agentsRef.current.findIndex(
                            (a) => a.instanceId === hitAgent.instanceId,
                        );
                        const linkedSkills: {
                            skill: CanvasSkill;
                            index: number;
                        }[] = [];
                        skillsRef.current.forEach((s, idx) => {
                            if (
                                s.agentInstanceId === hitAgent.instanceId &&
                                !s.unlinked
                            )
                                linkedSkills.push({ skill: s, index: idx });
                        });
                        undoStackRef.current.push({
                            type: "remove-agent",
                            agent: hitAgent,
                            index: agentIdx,
                            linkedSkills,
                        });
                        redoStackRef.current = [];
                        agentsRef.current = agentsRef.current.filter(
                            (a) => a.instanceId !== hitAgent.instanceId,
                        );
                        if (linkedSkills.length > 0) {
                            const skillIds = new Set(
                                linkedSkills.map((ls) => ls.skill.instanceId),
                            );
                            skillsRef.current = skillsRef.current.filter(
                                (s) => !skillIds.has(s.instanceId),
                            );
                        }
                        updateUndoRedo();
                        redrawImmediate();
                        broadcastEraseElements([], [hitAgent.instanceId]);
                        scheduleAutoSave();
                    }
                    if (hitSkill) {
                        const skillIdx = skillsRef.current.findIndex(
                            (s) => s.instanceId === hitSkill.instanceId,
                        );
                        undoStackRef.current.push({
                            type: "remove-skill",
                            skill: hitSkill,
                            index: skillIdx,
                        });
                        redoStackRef.current = [];
                        skillsRef.current = skillsRef.current.filter(
                            (s) => s.instanceId !== hitSkill.instanceId,
                        );
                        updateUndoRedo();
                        redrawImmediate();
                        scheduleAutoSave();
                    }
                }
            }
        }

        if (
            drawingRef.current &&
            tool === "eraser" &&
            eraserMode === "pixels" &&
            canvas
        ) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = cx - rect.left;
            const mouseY = cy - rect.top;

            const initialCount = agentsRef.current.length;
            const erasedAgents: CanvasAgent[] = [];
            agentsRef.current = agentsRef.current.filter((a) => {
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
                    const idx = agentsRef.current.findIndex(
                        (a) => a.instanceId === agent.instanceId,
                    );
                    undoStackRef.current.push({
                        type: "remove-agent",
                        agent,
                        index: idx < 0 ? agentsRef.current.length : idx,
                    });
                }
                redoStackRef.current = [];
                redraw();
                broadcastEraseElements(
                    [],
                    erasedAgents.map((a) => a.instanceId),
                );
                updateUndoRedo();
                scheduleAutoSave();
            }

            const initialSkillsCount = skillsRef.current.length;
            const erasedSkills: CanvasSkill[] = [];
            skillsRef.current = skillsRef.current.filter((s) => {
                const screenPos = getScreenPos(s.x, s.y);
                const dx = screenPos.x - mouseX;
                const dy = screenPos.y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const threshold = (12 + eraserSize / 2) * zoomRef.current;
                const keep = distance > threshold;
                if (!keep) {
                    erasedSkills.push(s);
                }
                return keep;
            });

            if (skillsRef.current.length < initialSkillsCount) {
                const deletedSkillIds: string[] = [];
                for (const skill of erasedSkills) {
                    const idx = skillsRef.current.findIndex(
                        (s) => s.instanceId === skill.instanceId,
                    );
                    undoStackRef.current.push({
                        type: "remove-skill",
                        skill,
                        index: idx < 0 ? skillsRef.current.length : idx,
                    });
                    deletedSkillIds.push(skill.instanceId);
                }
                redoStackRef.current = [];
                redraw();
                updateUndoRedo();
                broadcastEraseElements([], [], deletedSkillIds);
                scheduleAutoSave();
            }
        }

        // Handle rotation anchor dragging regardless of tool state lag
        if (draggedSkillTargetRef.current) {
            const skill = draggedSkillTargetRef.current;
            const geom = getGeometry(skill) || { type: "none" };
            const isChargeable = false;
            const mToPx = selectedMap?.pixelsPerMeter || 20;

            let agentObj = null;
            let isLinked =
                !skill.unlinked &&
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(getDeploymentType(skill));
            if (isLinked) {
                agentObj = agentsRef.current.find(
                    (a) => a.instanceId === skill.agentInstanceId,
                );
                if (!agentObj) isLinked = false;
            }

            let originX = skill.x;
            let originY = skill.y;
            let sa = 0;

            if (isLinked && agentObj) {
                originX = agentObj.x;
                originY = agentObj.y;
                sa = Math.atan2(pos.y - originY, pos.x - originX);
                if (
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(getDeploymentType(skill)) &&
                    skill.deployment?.windup
                ) {
                    skill.x =
                        originX +
                        Math.cos(sa) * skill.deployment.windup * mToPx;
                    skill.y =
                        originY +
                        Math.sin(sa) * skill.deployment.windup * mToPx;
                } else {
                    skill.x = originX;
                    skill.y = originY;
                }
            } else {
                sa = Math.atan2(pos.y - originY, pos.x - originX);
            }

            const maxDisplacements = 0 || 1;
            const draggedPtIdx = draggedSkillPathPointIndexRef.current;

            if (
                maxDisplacements > 1 &&
                skill.pathPoints &&
                skill.pathPoints.length > 0
            ) {
                if (isPlacingMultiDisplacementRef.current) {
                    originX = skill.pathPoints[skill.pathPoints.length - 1].x;
                    originY = skill.pathPoints[skill.pathPoints.length - 1].y;
                } else {
                    if (draggedPtIdx !== null) {
                        originX = skill.pathPoints[draggedPtIdx - 1].x;
                        originY = skill.pathPoints[draggedPtIdx - 1].y;
                    } else if (skill.pathPoints.length >= 2) {
                        originX =
                            skill.pathPoints[skill.pathPoints.length - 2].x;
                        originY =
                            skill.pathPoints[skill.pathPoints.length - 2].y;
                    }
                }
                sa = Math.atan2(pos.y - originY, pos.x - originX);
            }

            const isProj =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    getDeploymentType(skill),
                ) ||
                ["linear_wall"].includes(getDeploymentType(skill)) ||
                ["dash_teleport"].includes(getDeploymentType(skill));

            if (
                geom &&
                !isProj &&
                (geom.type === "rectangle" ||
                    geom.type === "cone" ||
                    geom.type === "trapezoid" ||
                    geom.type === "line")
            ) {
                if (
                    ["two_point_barrier"].includes(
                        skill.deployment?.type as string,
                    )
                ) {
                    const agentObj = agentsRef.current.find(
                        (a) => a.instanceId === skill.agentInstanceId,
                    );
                    let tX = pos.x;
                    let tY = pos.y;

                    // Directional skills: limit the second point by maxCastRange from the agent (when spawning or when linked)
                    if (
                        ["two_point_barrier"].includes(
                            skill.deployment?.type as string,
                        ) &&
                        agentObj &&
                        (isPlacingSecondPointRef.current || !skill.unlinked)
                    ) {
                        const maxRange = [
                            "map_target_aoe",
                            "two_point_barrier",
                        ].includes(skill.deployment?.type as string)
                            ? ("castRange" in (skill.deployment || {})
                                  ? getCastRange(skill)
                                  : 0) || 0
                            : 0;
                        if (maxRange > 0) {
                            const maxPx = maxRange * mToPx;

                            // When dragging the second point and linked, also correct the first point if it's out of range
                            if (
                                !isPlacingSecondPointRef.current &&
                                !skill.unlinked &&
                                draggedSkillTargetRef.current?.instanceId ===
                                    skill.instanceId
                            ) {
                                // Check if first point is out of range
                                const dx1 = skill.x - agentObj.x;
                                const dy1 = skill.y - agentObj.y;
                                const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

                                if (dist1 > maxPx) {
                                    // Move first point closer to agent while maintaining direction
                                    const angle1 = Math.atan2(dy1, dx1);
                                    skill.x =
                                        agentObj.x + Math.cos(angle1) * maxPx;
                                    skill.y =
                                        agentObj.y + Math.sin(angle1) * maxPx;
                                }
                            }

                            // Now limit second point by maxCastRange from agent
                            const dx = tX - agentObj.x;
                            const dy = tY - agentObj.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > maxPx) {
                                const angle = Math.atan2(dy, dx);
                                tX = agentObj.x + Math.cos(angle) * maxPx;
                                tY = agentObj.y + Math.sin(angle) * maxPx;
                            }
                        }
                    }

                    // Limit the second point by geom.length from the first point (skill.x/y) for all two-point skills
                    const maxGeomLen = getGeomLength(geom) * mToPx;
                    if (maxGeomLen > 0) {
                        const dx = tX - skill.x;
                        const dy = tY - skill.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > maxGeomLen) {
                            const angle = Math.atan2(dy, dx);
                            tX = skill.x + Math.cos(angle) * maxGeomLen;
                            tY = skill.y + Math.sin(angle) * maxGeomLen;
                        }
                    }
                    skill.targetX = tX;
                    skill.targetY = tY;
                } else if (!isChargeable) {
                    const length = getGeomLength(geom) * mToPx;
                    skill.targetX = skill.x + Math.cos(sa) * length;
                    skill.targetY = skill.y + Math.sin(sa) * length;
                } else {
                    const maxLen =
                        (0 /* no max length */ || getGeomLength(geom) || 0) *
                        mToPx;
                    const dx = pos.x - skill.x;
                    const dy = pos.y - skill.y;
                    let dist = dx * Math.cos(sa) + dy * Math.sin(sa);
                    dist = Math.max(0, Math.min(dist, maxLen));
                    skill.targetX = skill.x + Math.cos(sa) * dist;
                    skill.targetY = skill.y + Math.sin(sa) * dist;
                }
            } else {
                let { maxRange, isFixed: projIsFixed } =
                    getProjRangeAndFixed(skill);

                if (
                    [
                        "dash_teleport",
                        "map_target_aoe",
                        "two_point_barrier",
                    ].includes(skill.deployment?.type as string)
                ) {
                    maxRange =
                        ("castRange" in (skill.deployment || {})
                            ? getCastRange(skill)
                            : 0) || 0;
                    projIsFixed = false;
                }

                let tX = pos.x;
                let tY = pos.y;

                if (maxRange > 0) {
                    const maxPx = maxRange * mToPx;
                    const dx = pos.x - originX;
                    const dy = pos.y - originY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (projIsFixed || dist > maxPx) {
                        tX = originX + Math.cos(sa) * maxPx;
                        tY = originY + Math.sin(sa) * maxPx;
                    }
                }

                if (isLinked && agentObj) {
                    const dx = tX - skill.x;
                    const dy = tY - skill.y;
                    const projDist = dx * Math.cos(sa) + dy * Math.sin(sa);
                    if (projDist <= 0.1) {
                        tX = skill.x + Math.cos(sa) * 0.1;
                        tY = skill.y + Math.sin(sa) * 0.1;
                    }
                }

                const draggedPtIdx = draggedSkillPathPointIndexRef.current;
                if (draggedPtIdx !== null && skill.pathPoints) {
                    const dx = tX - skill.pathPoints[draggedPtIdx].x;
                    const dy = tY - skill.pathPoints[draggedPtIdx].y;
                    for (
                        let j = draggedPtIdx;
                        j < skill.pathPoints.length;
                        j++
                    ) {
                        skill.pathPoints[j].x += dx;
                        skill.pathPoints[j].y += dy;
                    }
                    skill.targetX =
                        skill.pathPoints[skill.pathPoints.length - 1].x;
                    skill.targetY =
                        skill.pathPoints[skill.pathPoints.length - 1].y;
                } else {
                    skill.targetX = tX;
                    skill.targetY = tY;
                    if (
                        skill.pathPoints &&
                        !isPlacingMultiDisplacementRef.current
                    ) {
                        skill.pathPoints[skill.pathPoints.length - 1] = {
                            x: tX,
                            y: tY,
                        };
                    }
                }
            }

            if (
                ["linear_wall"].includes(skill.deployment?.type as string) ||
                false /* no controllable flag yet */
            ) {
                if (!skill.pathPoints)
                    skill.pathPoints = [{ x: skill.x, y: skill.y }];
                skill.pathPoints.push({ x: pos.x, y: pos.y });
            }

            redrawImmediate();
            const now = Date.now();
            if (now - lastSkillBroadcastTimeRef.current > 80) {
                broadcastSkillUpdate(skill, true);
                lastSkillBroadcastTimeRef.current = now;
            }
            return;
        }

        if (tool === "select") {
            if (draggedAgentRef.current) {
                const dx = pos.x - draggedAgentRef.current.x;
                const dy = pos.y - draggedAgentRef.current.y;

                draggedAgentRef.current.x = pos.x;
                draggedAgentRef.current.y = pos.y;

                skillsRef.current.forEach((skill) => {
                    if (
                        skill.agentInstanceId ===
                            draggedAgentRef.current?.instanceId &&
                        !skill.unlinked &&
                        [
                            "projectile_terminal_aoe",
                            "projectile_sweeping",
                            "linear_wall",
                            "self_mobile_aura",
                            "static_deployable",
                            "autonomous_entity",
                            "equip_weapon",
                            "dash_teleport",
                            "self_instant",
                        ].includes(skill.deployment?.type as string)
                    ) {
                        skill.x += dx;
                        skill.y += dy;

                        const pFlagForInf =
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                            ].includes(skill.deployment?.type as string) ||
                            ["linear_wall"].includes(
                                skill.deployment?.type as string,
                            );
                        const isInfiniteProj =
                            pFlagForInf &&
                            (!getProjMaxDist(skill) ||
                                getProjMaxDist(skill) === 0);
                        const isFixed = isInfiniteProj;
                        if (!isFixed) {
                            if (skill.targetX !== undefined)
                                skill.targetX += dx;
                            if (skill.targetY !== undefined)
                                skill.targetY += dy;
                            if (skill.pathPoints) {
                                skill.pathPoints.forEach((pt) => {
                                    pt.x += dx;
                                    pt.y += dy;
                                });
                            }
                        }
                    }
                });
                redraw();
                const now = Date.now();
                if (now - lastAgentBroadcastTimeRef.current > 80) {
                    broadcastAgentUpdate(draggedAgentRef.current, true);
                    skillsRef.current.forEach((skill) => {
                        if (
                            skill.agentInstanceId ===
                                draggedAgentRef.current?.instanceId &&
                            !skill.unlinked &&
                            [
                                "projectile_terminal_aoe",
                                "projectile_sweeping",
                                "linear_wall",
                                "self_mobile_aura",
                                "static_deployable",
                                "autonomous_entity",
                                "equip_weapon",
                                "dash_teleport",
                                "self_instant",
                            ].includes(skill.deployment?.type as string)
                        ) {
                            broadcastSkillUpdate(skill, true);
                        }
                    });
                    lastAgentBroadcastTimeRef.current = now;
                }
            } else if (draggedSkillRef.current) {
                const newX = pos.x + draggedSkillOffsetRef.current.x;
                const newY = pos.y + draggedSkillOffsetRef.current.y;

                let clampedX = newX;
                let clampedY = newY;

                const skill = draggedSkillRef.current;
                let agentObj = null;
                if (skill.agentInstanceId && !skill.unlinked) {
                    agentObj = agentsRef.current.find(
                        (a) => a.instanceId === skill.agentInstanceId,
                    );
                }

                if (
                    ["map_target_aoe", "two_point_barrier"].includes(
                        skill.deployment?.type as string,
                    ) &&
                    agentObj
                ) {
                    const maxRange =
                        ("castRange" in (skill.deployment || {})
                            ? getCastRange(skill)
                            : 0) || 0;
                    if (maxRange > 0) {
                        const mToPx = selectedMap?.pixelsPerMeter || 20;
                        const maxPx = maxRange * mToPx;
                        const dx = newX - agentObj.x;
                        const dy = newY - agentObj.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > maxPx) {
                            const angle = Math.atan2(dy, dx);
                            clampedX = agentObj.x + Math.cos(angle) * maxPx;
                            clampedY = agentObj.y + Math.sin(angle) * maxPx;
                        }
                    }
                }

                const dx = clampedX - draggedSkillRef.current.x;
                const dy = clampedY - draggedSkillRef.current.y;

                draggedSkillRef.current.x = clampedX;
                draggedSkillRef.current.y = clampedY;
                if (
                    draggedSkillRef.current.targetX !== undefined &&
                    draggedSkillRef.current.targetY !== undefined
                ) {
                    draggedSkillRef.current.targetX += dx;
                    draggedSkillRef.current.targetY += dy;

                    if (!draggedSkillRef.current.unlinked && agentObj) {
                        // Target point is restricted by agent range for directional skills and projectiles.
                        // Cables restrict their target point to the first point (maintained during drag).
                        if (
                            !(
                                ["linear_wall", "two_point_barrier"].includes(
                                    getDeploymentType(draggedSkillRef.current),
                                ) &&
                                getDeploymentType(draggedSkillRef.current) !==
                                    "linear_wall"
                            )
                        ) {
                            const maxRange = [
                                "map_target_aoe",
                                "two_point_barrier",
                            ].includes(
                                draggedSkillRef.current.deployment
                                    ?.type as string,
                            )
                                ? getCastRange(draggedSkillRef.current)
                                : 0;
                            if (maxRange > 0) {
                                const mToPx = selectedMap?.pixelsPerMeter || 20;
                                const maxPx = maxRange * mToPx;
                                const tDx =
                                    draggedSkillRef.current.targetX -
                                    agentObj.x;
                                const tDy =
                                    draggedSkillRef.current.targetY -
                                    agentObj.y;
                                const tDist = Math.sqrt(tDx * tDx + tDy * tDy);
                                if (tDist > maxPx) {
                                    const angle = Math.atan2(tDy, tDx);
                                    draggedSkillRef.current.targetX =
                                        agentObj.x + Math.cos(angle) * maxPx;
                                    draggedSkillRef.current.targetY =
                                        agentObj.y + Math.sin(angle) * maxPx;
                                }
                            }
                        }
                    }
                }
                if (draggedSkillRef.current.pathPoints) {
                    draggedSkillRef.current.pathPoints.forEach((pt) => {
                        pt.x += dx;
                        pt.y += dy;
                    });
                }
                redraw();
                const now = Date.now();
                if (now - lastSkillBroadcastTimeRef.current > 80) {
                    broadcastSkillUpdate(draggedSkillRef.current, true);
                    lastSkillBroadcastTimeRef.current = now;
                }
            }
            return;
        }

        if (!drawingRef.current) {
            return;
        }
        const activePath = pathsRef.current.find(
            (p) => p.id === activePathIdRef.current,
        );
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
                    tool === "eraser"
                        ? "none"
                        : tool === "select"
                          ? "default"
                          : "crosshair";
                canvas.style.cursor = toolCursor;
            }
            return;
        }
        if (tool === "eraser" && eraserMode === "lines") {
            drawingRef.current = false;
            return;
        }

        if (
            tool === "calibrate" &&
            calibrateStateRef.current.step === "end" &&
            calibrateStateRef.current.startPos &&
            worldMousePosRef.current
        ) {
            drawingRef.current = false;
            const dx =
                worldMousePosRef.current.x -
                calibrateStateRef.current.startPos.x;
            const dy =
                worldMousePosRef.current.y -
                calibrateStateRef.current.startPos.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);

            if (distPx > 5) {
                calibrateStateRef.current = { step: "start", startPos: null };
                setCalibrateState({
                    step: "start",
                    startPos: null,
                    showModal: true,
                    distancePx: distPx,
                });
                redrawImmediate();
            }
            return;
        }

        const wasDrawing = drawingRef.current;
        const wasDragging = !!draggedAgentRef.current;

        if (wasDrawing) {
            drawingRef.current = false;
            const activePath = pathsRef.current.find(
                (p) => p.id === activePathIdRef.current,
            );
            if (activePath) {
                undoStackRef.current.push({
                    type: "add-path",
                    path: activePath,
                });
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
                    undoStackRef.current.push({
                        type: "move-agent",
                        agentId: agent.instanceId,
                        oldX: oldPos.x,
                        oldY: oldPos.y,
                        newX: agent.x,
                        newY: agent.y,
                    });
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
                            skill: null,
                            x: screenPos.x + rect.left,
                            y: screenPos.y + rect.top,
                            visible: true,
                        });
                    }
                }
            }
            broadcastAgentUpdate(agent, false);
            skillsRef.current.forEach((skill) => {
                if (
                    skill.agentInstanceId === agent.instanceId &&
                    !skill.unlinked &&
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(skill.deployment?.type as string)
                ) {
                    broadcastSkillUpdate(skill, false);
                }
            });
            loadedAgentIdsRef.current.add(agent.instanceId);
            scheduleAutoSave();
        }

        if (draggedSkillRef.current) {
            const skill = draggedSkillRef.current;
            if (
                skill.unlinked &&
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(skill.deployment?.type as string) &&
                worldMousePosRef.current
            ) {
                const mouseX = worldMousePosRef.current.x;
                const mouseY = worldMousePosRef.current.y;

                const originalCreator = agentsRef.current.find(
                    (a) => a.instanceId === skill.agentInstanceId,
                );
                if (originalCreator) {
                    const mToPx = selectedMap?.pixelsPerMeter || 20;
                    for (let i = agentsRef.current.length - 1; i >= 0; i--) {
                        const agent = agentsRef.current[i];
                        const dist = Math.sqrt(
                            (agent.x - mouseX) ** 2 + (agent.y - mouseY) ** 2,
                        );
                        if (dist < 2.5 * mToPx) {
                            // Hit radius ~2.5 meters
                            if (agent.id === originalCreator.id) {
                                // Link it
                                skill.agentInstanceId = agent.instanceId;
                                skill.unlinked = false;

                                // Snap
                                let newX = agent.x;
                                let newY = agent.y;
                                let sa = 0;
                                if (
                                    skill.targetX !== undefined &&
                                    skill.targetY !== undefined
                                ) {
                                    sa = Math.atan2(
                                        skill.targetY - skill.y,
                                        skill.targetX - skill.x,
                                    );
                                }
                                if (skill.deployment?.windup) {
                                    newX =
                                        agent.x +
                                        Math.cos(sa) *
                                            skill.deployment?.windup *
                                            mToPx;
                                    newY =
                                        agent.y +
                                        Math.sin(sa) *
                                            skill.deployment?.windup *
                                            mToPx;
                                }

                                const dx = newX - skill.x;
                                const dy = newY - skill.y;
                                skill.x = newX;
                                skill.y = newY;
                                if (skill.targetX !== undefined)
                                    skill.targetX += dx;
                                if (skill.targetY !== undefined)
                                    skill.targetY += dy;
                                if (skill.pathPoints) {
                                    skill.pathPoints.forEach((pt) => {
                                        pt.x += dx;
                                        pt.y += dy;
                                    });
                                }
                                redrawImmediate();
                                break;
                            }
                        }
                    }
                }
            }
            broadcastSkillUpdate(skill, false);
            draggedSkillRef.current = null;
            dragHoveredLinkAgentRef.current = null;
            redrawImmediate();
            updateUndoRedo();
            scheduleAutoSave();
        }
        if (draggedSkillRotationRef.current) {
            broadcastSkillUpdate(draggedSkillRotationRef.current, false);
            draggedSkillRotationRef.current = null;
            redrawImmediate();
            updateUndoRedo();
            scheduleAutoSave();
        }

        if (draggedSkillTargetRef.current) {
            // If we're in the middle of placing a second point, don't clear the ref
            // The second click (mousedown) will confirm and clear it
            if (
                !isPlacingSecondPointRef.current &&
                !isPlacingMultiDisplacementRef.current
            ) {
                broadcastSkillUpdate(draggedSkillTargetRef.current, false);
                draggedSkillTargetRef.current = null;
                draggedSkillPathPointIndexRef.current = null;
                redrawImmediate();
                updateUndoRedo();
                scheduleAutoSave();
            }
        }
        const canvas = canvasRef.current;
        if (canvas && tool === "select") {
            canvas.style.cursor = "default";
        }

        if (tool === "skill") {
            setTool("select");
        }
    };

    const dropAgent = (a: ValorantAgent) => {
        const c = canvasRef.current;
        if (!c) return;
        if (!agentImgsRef.current.has(a.id)) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = a.displayIcon;
            img.onload = () => {
                agentImgsRef.current.set(a.id, img);
                redraw();
            };
            agentImgsRef.current.set(a.id, img);
        }
        const newAgent = {
            instanceId: Math.random().toString(36).substring(2, 9),
            id: a.id,
            x: -50 + Math.random() * 100,
            y: -50 + Math.random() * 100,
            team: activeTeam,
            createdBy: myUserId,
        };
        undoStackRef.current.push({ type: "add-agent", agent: newAgent });
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
        e.dataTransfer.setDragImage(e.currentTarget as Element, 29, 29);
    };

    const handleCanvasDragEnter = (e: React.DragEvent) => {
        console.log("Canvas DragEnter fired", e.dataTransfer.types);
        e.preventDefault();
        e.stopPropagation();
    };

    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (pendingSkillRef.current) {
            const canvas = canvasRef.current;
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                mousePosRef.current = {
                    canvasX: e.clientX - rect.left,
                    canvasY: e.clientY - rect.top,
                };
            }
            worldMousePosRef.current = getPos(e);
            redrawImmediateRef.current?.();
        }
    };

    const handleCanvasDrop = (e: React.DragEvent<HTMLElement>) => {
        console.log("Canvas Drop fired!");
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos(e);

        const types = Array.from(e.dataTransfer.types || []);
        const isSkillDrop = types.includes("application/json");

        if (isSkillDrop && pendingSkillRef.current) {
            const pendingData = pendingSkillRef.current;
            const agentObj = agentsRef.current.find(
                (a) => a.instanceId === pendingData.agentInstanceId,
            );
            const skill = pendingData.skill;
            let startX = pos.x;
            let startY = pos.y;
            const mToPx = selectedMap?.pixelsPerMeter || 20;

            let playerToMouseAngle = 0;
            if (
                [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                    "linear_wall",
                    "self_mobile_aura",
                    "static_deployable",
                    "autonomous_entity",
                    "equip_weapon",
                    "dash_teleport",
                    "self_instant",
                ].includes(skill.deployment?.type as string) &&
                agentObj
            ) {
                startX = agentObj.x;
                startY = agentObj.y;
                playerToMouseAngle = Math.atan2(pos.y - startY, pos.x - startX);

                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                }
            } else if (
                ["map_target_aoe", "two_point_barrier"].includes(
                    skill.deployment?.type as string,
                ) &&
                agentObj
            ) {
                const maxRange =
                    ("castRange" in (skill.deployment || {})
                        ? getCastRange(skill)
                        : 0) || 0;
                if (maxRange > 0) {
                    const maxPx = maxRange * mToPx;
                    const dist = Math.sqrt(
                        (pos.x - agentObj.x) ** 2 + (pos.y - agentObj.y) ** 2,
                    );
                    if (dist > maxPx) {
                        const angle = Math.atan2(
                            pos.y - agentObj.y,
                            pos.x - agentObj.x,
                        );
                        startX = agentObj.x + Math.cos(angle) * maxPx;
                        startY = agentObj.y + Math.sin(angle) * maxPx;
                    }
                }
            }

            let initTargetX: number | undefined = undefined;
            let initTargetY: number | undefined = undefined;
            const isProj =
                ["projectile_terminal_aoe", "projectile_sweeping"].includes(
                    skill.deployment?.type as string,
                ) ||
                ["dash_teleport"].includes(skill.deployment?.type as string) ||
                !!["linear_wall"].includes(skill.deployment?.type as string);
            const isGeomWithTarget =
                !isProj &&
                skill.deployment &&
                ([
                    "linear_wall",
                    "projectile_sweeping",
                    "two_point_barrier",
                ].includes(skill.deployment?.type as string) ||
                    [
                        "linear_wall",
                        "projectile_sweeping",
                        "two_point_barrier",
                    ].includes(skill.deployment?.type as string));

            if (isGeomWithTarget || isProj) {
                const length =
                    ("length" in (skill.deployment || {})
                        ? getAoeLength(skill)
                        : 0) * mToPx;

                if (
                    [
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                        "linear_wall",
                        "self_mobile_aura",
                        "static_deployable",
                        "autonomous_entity",
                        "equip_weapon",
                        "dash_teleport",
                        "self_instant",
                    ].includes(skill.deployment?.type as string) &&
                    agentObj
                ) {
                    const sa = playerToMouseAngle;
                    if (false) {
                        const maxLen =
                            (0 /* no max length */ ||
                                getAoeLength(skill) ||
                                0) * mToPx;
                        const dx = pos.x - startX;
                        const dy = pos.y - startY;
                        let dist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        dist = Math.max(0, Math.min(dist, maxLen));
                        initTargetX = startX + Math.cos(sa) * dist;
                        initTargetY = startY + Math.sin(sa) * dist;
                    } else if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(skill);
                        let tX = pos.x;
                        let tY = pos.y;

                        if (maxRange > 0) {
                            const maxPx = maxRange * mToPx;
                            const dx = tX - agentObj.x;
                            const dy = tY - agentObj.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (projIsFixed || dist > maxPx) {
                                const angle = Math.atan2(dy, dx);
                                tX = agentObj.x + Math.cos(angle) * maxPx;
                                tY = agentObj.y + Math.sin(angle) * maxPx;
                            }
                        }

                        const dx = tX - startX;
                        const dy = tY - startY;
                        const projDist = dx * Math.cos(sa) + dy * Math.sin(sa);
                        if (projDist <= 0.1) {
                            initTargetX = startX + Math.cos(sa) * 0.1;
                            initTargetY = startY + Math.sin(sa) * 0.1;
                        } else {
                            initTargetX = tX;
                            initTargetY = tY;
                        }
                    } else {
                        initTargetX = startX + Math.cos(sa) * length;
                        initTargetY = startY + Math.sin(sa) * length;
                    }
                } else {
                    // ground spawn: enforce maxCastRange if set
                    if (isProj && !isGeomWithTarget) {
                        const { maxRange, isFixed: projIsFixed } =
                            getProjRangeAndFixed(skill);
                        const maxPx = maxRange * mToPx;
                        const spawnLen = maxPx > 0 ? maxPx : 10 * mToPx;
                        let angle = 0;
                        if (agentObj) {
                            angle = Math.atan2(
                                pos.y - agentObj.y,
                                pos.x - agentObj.x,
                            );
                        }
                        initTargetX = startX + Math.cos(angle) * spawnLen;
                        initTargetY = startY + Math.sin(angle) * spawnLen;
                        initTargetX =
                            pos.x +
                            (0 /* no min length */ ||
                                getAoeLength(skill) ||
                                0) *
                                mToPx;
                        initTargetY = pos.y;
                    } else {
                        initTargetX = pos.x + length;
                        initTargetY = pos.y;
                    }
                }
            }

            // For two-point deployment skills, always set initial target at drop/mouse position
            // so the user can aim with the mouse before the second click
            if (["two_point_barrier"].includes(getDeploymentType(skill))) {
                initTargetX = pos.x;
                initTargetY = pos.y;
            }

            const newSkill: CanvasSkill = {
                instanceId: Math.random().toString(36).substring(2, 9),
                agentInstanceId: pendingData.agentInstanceId,
                key: skill.key,
                x: startX,
                y: startY,
                targetX: initTargetX,
                targetY: initTargetY,
                deployment: skill.deployment,
                lifetime: skill.lifetime,
                resolution: skill.resolution,
                projectileMode: [
                    "projectile_terminal_aoe",
                    "projectile_sweeping",
                ].includes(getDeploymentType(skill))
                    ? projectileMode
                    : undefined,
                pathPoints:
                    ["linear_wall"].includes(getDeploymentType(skill)) ||
                    false /* no controllable flag yet */
                        ? [
                              { x: startX, y: startY },
                              {
                                  x: initTargetX ?? pos.x,
                                  y: initTargetY ?? pos.y,
                              },
                          ]
                        : undefined,
                color: pendingData.color,
                createdBy: myUserId,
                unlinked:
                    ["map_target_aoe", "two_point_barrier"].includes(
                        getDeploymentType(skill),
                    ) ||
                    !![
                        "projectile_terminal_aoe",
                        "projectile_sweeping",
                    ].includes(getDeploymentType(skill)) ||
                    !!["linear_wall"].includes(getDeploymentType(skill)),
            };
            skillsRef.current.push(newSkill);
            loadedSkillIdsRef.current.add(newSkill.instanceId);
            undoStackRef.current.push({ type: "add-skill", skill: newSkill });
            redoStackRef.current = [];

            if (
                ["equip_weapon"].includes(getDeploymentType(skill)) &&
                agentObj
            ) {
                agentObj.weaponId = "skill:" + skill.key;
            }

            pendingSkillRef.current = null;
            mousePosRef.current = null;

            // For two-point deployment skills with ground spawn, keep draggedSkillTargetRef so the user can place the second point
            if (
                ["two_point_barrier"].includes(
                    newSkill.deployment?.type as string,
                ) &&
                ["map_target_aoe", "two_point_barrier"].includes(
                    newSkill.deployment?.type as string,
                ) &&
                newSkill.targetX !== undefined
            ) {
                draggedSkillTargetRef.current = newSkill;
                isPlacingSecondPointRef.current = true;
            } else {
                setTool("select");
            }
            redraw();
            updateUndoRedo();
            scheduleAutoSave();
            return;
        }

        const agentId = e.dataTransfer.getData("text/plain");
        console.log("agentId from dataTransfer:", agentId);
        if (!agentId) return;

        const agent = findAgent(agentId);
        console.log("agent found:", agent);
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
                createdBy: myUserId,
            };
            agentsRef.current.push(newAgent);
            loadedAgentIdsRef.current.add(newAgent.instanceId);
            undoStackRef.current.push({ type: "add-agent", agent: newAgent });
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
            const d = (
                typeof s.canvas_data === "string"
                    ? JSON.parse(s.canvas_data || "{}")
                    : s.canvas_data || {}
            ) as {
                paths?: CanvasPath[];
                agents?: CanvasAgent[];
                skills?: CanvasSkill[];
            };
            syncCanvasLocalState(d.paths || [], d.agents || [], d.skills || []);

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
                        skills: skillsRef.current.map((s) => {
                            const {
                                deployment,
                                lifetime,
                                resolution,
                                ...rest
                            } = s;
                            return rest;
                        }),
                        clientKnownPathIds: Array.from(
                            loadedPathIdsRef.current,
                        ),
                        clientKnownAgentIds: Array.from(
                            loadedAgentIdsRef.current,
                        ),
                        clientKnownSkillIds: Array.from(
                            loadedSkillIdsRef.current,
                        ),
                    },
                }),
            });
            if (!res.ok) throw new Error("Error saving strategy canvas");
            const data = await res.json();
            return data;
        },
        onSuccess: (data) => {
            if (data && data.updated_at) {
                lastSavedAtRef.current = data.updated_at;
            }
            queryClient.invalidateQueries({
                queryKey: ["strategies", selectedMap?.id],
            });
        },
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
            if (autoSaveTimerRef.current)
                clearTimeout(autoSaveTimerRef.current);
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
                config: { presence: { key: myUserId } },
            });

            channel
                .on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    const users: CollabUser[] = [];
                    const activeUserIds = new Set<string>();
                    for (const key of Object.keys(state)) {
                        const presences: {
                            userName?: string;
                            userColor?: string;
                            userImage?: string;
                            [key: string]: unknown;
                        }[] = (state[key] || []) as {
                            userName?: string;
                            userColor?: string;
                            userImage?: string;
                            [key: string]: unknown;
                        }[];
                        if (presences.length > 0) {
                            activeUserIds.add(key);
                            users.push({
                                userId: key,
                                userName: presences[0].userName || "Anónimo",
                                userColor: presences[0].userColor || "#FF4655",
                                userImage: presences[0].userImage || null,
                            });
                        }
                    }
                    setCollabUsers(users);

                    // Remove cursors for users that left presence
                    setRemoteCursors((prev) => {
                        let changed = false;
                        const next = new Map(prev);
                        for (const key of Array.from(next.keys())) {
                            if (!activeUserIds.has(key)) {
                                next.delete(key);
                                changed = true;
                            }
                        }
                        return changed ? next : prev;
                    });
                })
                .on("broadcast", { event: "cursor-move" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    setRemoteCursors((prev) => {
                        const next = new Map(prev);
                        next.set(payload.userId, {
                            userId: payload.userId,
                            userName: payload.userName,
                            userColor: payload.userColor,
                            x: payload.x,
                            y: payload.y,
                            canvasX: payload.canvasX,
                            canvasY: payload.canvasY,
                        });
                        return next;
                    });
                })
                .on("broadcast", { event: "cursor-leave" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    setRemoteCursors((prev) => {
                        const next = new Map(prev);
                        next.delete(payload.userId);
                        return next;
                    });
                })
                .on("broadcast", { event: "canvas-update" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    syncCanvasLocalState(
                        payload.paths || [],
                        payload.agents || [],
                        payload.skills || [],
                    );
                    redraw();
                    updateUndoRedo();
                })
                .on("broadcast", { event: "draw-stroke" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    const remotePath = payload.path;
                    if (!remotePath) return;

                    const idx = pathsRef.current.findIndex(
                        (p) => p.id === remotePath.id,
                    );
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

                    remoteAgent.draggedBy = payload.dragging
                        ? payload.userId
                        : undefined;

                    const idx = agentsRef.current.findIndex(
                        (a) => a.instanceId === remoteAgent.instanceId,
                    );
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
                                    agentImgsRef.current.set(
                                        remoteAgent.id,
                                        img,
                                    );
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
                .on("broadcast", { event: "drag-skill" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    const remoteSkill = payload.skill;
                    if (!remoteSkill) return;

                    remoteSkill.draggedBy = payload.dragging
                        ? payload.userId
                        : undefined;

                    const idx = skillsRef.current.findIndex(
                        (s) => s.instanceId === remoteSkill.instanceId,
                    );
                    if (idx !== -1) {
                        skillsRef.current[idx] = remoteSkill;
                    } else {
                        skillsRef.current.push(remoteSkill);
                    }

                    if (!payload.dragging) {
                        loadedSkillIdsRef.current.add(remoteSkill.instanceId);
                    }
                    redraw();
                })
                .on("broadcast", { event: "erase-elements" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    const { erasedPathIds, erasedAgentIds, erasedSkillIds } =
                        payload;

                    if (erasedPathIds && erasedPathIds.length > 0) {
                        const toRemove = new Set(erasedPathIds);
                        pathsRef.current = pathsRef.current.filter(
                            (p) => !toRemove.has(p.id),
                        );
                    }

                    if (erasedAgentIds && erasedAgentIds.length > 0) {
                        const toRemove = new Set(erasedAgentIds);
                        agentsRef.current = agentsRef.current.filter(
                            (a) => !toRemove.has(a.instanceId),
                        );
                    }

                    if (erasedSkillIds && erasedSkillIds.length > 0) {
                        const toRemove = new Set(erasedSkillIds);
                        skillsRef.current = skillsRef.current.filter(
                            (s) => !toRemove.has(s.instanceId),
                        );
                    }

                    redraw();
                    updateUndoRedo();
                })
                .on("broadcast", { event: "canvas-clear" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    pathsRef.current = [];
                    agentsRef.current = [];
                    redraw();
                    updateUndoRedo();
                })
                .on("broadcast", { event: "side-change" }, ({ payload }) => {
                    if (!payload || payload.userId === myUserId) return;
                    setSelectedSide(payload.side);
                    setCurrent((prev) =>
                        prev ? { ...prev, side: payload.side } : prev,
                    );
                    redraw();
                })
                .subscribe(async (status) => {
                    if (status === "SUBSCRIBED") {
                        await channel.track({
                            userName: myUserName,
                            userColor: myPlayerColor,
                            userImage: myUserImage,
                            online_at: new Date().toISOString(),
                        });
                    }
                });

            const handleVisibilityChange = () => {
                if (document.hidden) {
                    channel
                        .send({
                            type: "broadcast",
                            event: "cursor-leave",
                            payload: { userId: myUserId },
                        })
                        .catch(() => {});
                }
            };
            document.addEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );

            channelRef.current = channel;

            return () => {
                document.removeEventListener(
                    "visibilitychange",
                    handleVisibilityChange,
                );
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
                    body: JSON.stringify({
                        strategyId,
                        userName: myUserName,
                        userColor: myPlayerColor,
                        userImage: myUserImage,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setCollabUsers(
                        (data.users || []).map((u: CollabUser) => ({
                            userId: u.userId,
                            userName: u.userName,
                            userColor: u.userColor,
                        })),
                    );
                }
            } catch {
                /* ignore */
            }
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
                    const savedTime = new Date(
                        lastSavedAtRef.current,
                    ).getTime();
                    if (
                        remoteTime > savedTime &&
                        !drawingRef.current &&
                        !draggedAgentRef.current
                    ) {
                        const d = (
                            typeof remote.canvas_data === "string"
                                ? JSON.parse(remote.canvas_data || "{}")
                                : remote.canvas_data || {}
                        ) as {
                            paths?: CanvasPath[];
                            agents?: CanvasAgent[];
                            skills?: CanvasSkill[];
                        };
                        syncCanvasLocalState(
                            d.paths || [],
                            d.agents || [],
                            d.skills || [],
                        );
                        if (remote.side && remote.side !== selectedSide) {
                            setSelectedSide(remote.side);
                            setCurrent((prev) =>
                                prev ? { ...prev, side: remote.side } : prev,
                            );
                        }
                        lastSavedAtRef.current = remote.updated_at;
                        redraw();
                        updateUndoRedo();
                    }
                }
            } catch {
                /* ignore */
            }
        }, 4000);

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(pollInterval);
            // Remove presence on leave
            fetch(`/api/strategies/presence?strategyId=${strategyId}`, {
                method: "DELETE",
            }).catch(() => {});
            setCollabUsers([]);
            setRemoteCursors(new Map());
        };
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
        mutationFn: async (params?: {
            name?: string;
            side?: "attack" | "defense";
            mapId?: string;
        }) => {
            const finalName = params?.name || "Nueva Estrategia";
            const finalSide = params?.side || selectedSide;
            const finalMapId = params?.mapId || selectedMap?.id;
            if (!finalMapId) {
                throw new Error("Sin mapa seleccionado");
            }
            const res = await fetch("/api/strategies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    map_id: finalMapId,
                    name: finalName,
                    side: finalSide,
                }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || "Error al crear estrategia");
            return {
                id: data.id,
                map_id: finalMapId,
                name: finalName,
                side: finalSide,
                description: "",
            };
        },
        onSuccess: (data) => {
            if (!data) return;
            queryClient.invalidateQueries({
                queryKey: ["strategies", data.map_id],
            });
            const mapObj = allMaps.find((m) => m.id === data.map_id);
            if (mapObj) setSelectedMap(mapObj);
            openEditor({
                id: data.id,
                map_id: data.map_id,
                name: data.name,
                side: data.side,
                description: "",
                canvas_data: "{}",
            });
        },
    });

    const createStrat = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!selectedMap) return;
        let x = 1;
        const existingNames = new Set(strategies.map((s) => s.name));
        while (existingNames.has(`Estrategia sin nombre ${x}`)) {
            x++;
        }
        setCreateModalState({
            isOpen: true,
            defaultName: `Estrategia sin nombre ${x}`,
            side: "attack",
            mapId: selectedMap.id,
        });
    };

    const createStratForMap = async (e: React.MouseEvent, map: ValorantMap) => {
        e.stopPropagation();
        let x = 1;
        try {
            const res = await fetch(`/api/strategies?map_id=${map.id}`);
            let existingNames = new Set<string>();
            if (res.ok) {
                const data = await res.json();
                existingNames = new Set(
                    (data.strategies || []).map((s: Strategy) => s.name),
                );
            }
            while (existingNames.has(`Estrategia sin nombre ${x}`)) {
                x++;
            }
        } catch {
            // Ignored
        }
        setCreateModalState({
            isOpen: true,
            defaultName: `Estrategia sin nombre ${x}`,
            side: "attack",
            mapId: map.id,
        });
    };

    const deleteStratMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/strategies?id=${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al eliminar estrategia");
            }
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["strategies", selectedMap?.id],
            });
        },
    });

    const updateStratMutation = useMutation({
        mutationFn: async (strat: Partial<Strategy> & { id: number }) => {
            const res = await fetch("/api/strategies", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(strat),
            });
            if (!res.ok) throw new Error("Error al actualizar");
            return strat;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["strategies", selectedMap?.id],
            });
            setEditingExternalStratId(null);
        },
    });

    const saveExternalConfig = () => {
        if (!editingExternalStratId) return;
        updateStratMutation.mutate({
            id: editingExternalStratId,
            name: configName,
            description: configDescription,
            side: configSide,
            map_id: configMapId,
        });
    };

    const colors2 = [
        "#FF4655",
        "#3B82F6",
        "#22C55E",
        "#EAB308",
        "#F97316",
        "#A855F7",
        "#EC4899",
        "#FFFFFF",
    ];

    return (
        <div
            className={`strategies-container-premium ${view === "editor" ? "in-editor" : ""}`}
        >
            {view === "maps" && (
                <div className="header-premium">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 16,
                        }}
                    >
                        <div>
                            <h1
                                className="gradient-text-valorant"
                                style={{ fontSize: 32, fontWeight: 900 }}
                            >
                                Centro Táctico
                            </h1>
                            <p
                                style={{
                                    fontSize: 13,
                                    marginTop: 6,
                                    color: "rgba(255,255,255,0.6)",
                                    fontWeight: 500,
                                }}
                            >
                                Selecciona un mapa para ver sus estrategias
                            </p>
                        </div>
                        {/* Global back button removed to place it closer inside the context */}
                    </div>
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                }}
                className="animate-in"
            >
                {view === "maps" && (
                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            paddingRight: 4,
                        }}
                    >
                        {mapsLoading ? (
                            <div className="map-grid-premium">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="map-card-premium"
                                        style={{ height: 280 }}
                                    >
                                        <Skeleton width="100%" height="100%" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {mapsInRotation.length > 0 && (
                                    <div style={{ marginBottom: 40 }}>
                                        <h2
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 900,
                                                color: "#00d4aa",
                                                marginBottom: 18,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                letterSpacing: 2,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    backgroundColor: "#00d4aa",
                                                    boxShadow:
                                                        "0 0 10px #00d4aa",
                                                }}
                                            />
                                            MAPAS EN ROTACIÓN (ESTA SEASON)
                                        </h2>
                                        <div className="map-grid-premium">
                                            {mapsInRotation.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="map-card-premium"
                                                    onClick={() => goToMap(m)}
                                                >
                                                    <NextImage
                                                        src={
                                                            m.listViewIconTall ||
                                                            "/placeholder.png"
                                                        }
                                                        alt={m.name}
                                                        width={400}
                                                        height={600}
                                                        unoptimized
                                                        className="map-img-premium"
                                                    />
                                                    <div className="map-card-overlay-premium">
                                                        <div className="map-card-info-premium">
                                                            <h3 className="map-card-title-premium">
                                                                {m.name}
                                                            </h3>
                                                            <span className="map-card-subtitle-premium">
                                                                {m.tacticalDescription ||
                                                                    "Competitivo"}
                                                            </span>
                                                        </div>
                                                        <div className="map-card-actions-premium">
                                                            <button
                                                                className="map-card-action-btn primary"
                                                                onClick={(e) =>
                                                                    createStratForMap(
                                                                        e,
                                                                        m,
                                                                    )
                                                                }
                                                                disabled={
                                                                    createStratMutation.isPending
                                                                }
                                                            >
                                                                + Nueva
                                                            </button>
                                                            <button
                                                                className="map-card-action-btn secondary"
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    goToMap(m);
                                                                }}
                                                            >
                                                                Ver Estrategias
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {mapsOutOfRotation.length > 0 && (
                                    <div>
                                        <h2
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 900,
                                                color: "rgba(255,255,255,0.4)",
                                                marginBottom: 18,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                letterSpacing: 2,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    backgroundColor:
                                                        "rgba(255,255,255,0.3)",
                                                }}
                                            />
                                            OTROS MAPAS (FUERA DE ROTACIÓN)
                                        </h2>
                                        <div className="map-grid-premium">
                                            {mapsOutOfRotation.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="map-card-premium out-of-rotation"
                                                    onClick={() => goToMap(m)}
                                                >
                                                    <NextImage
                                                        src={
                                                            m.listViewIconTall ||
                                                            "/placeholder.png"
                                                        }
                                                        alt={m.name}
                                                        width={400}
                                                        height={600}
                                                        unoptimized
                                                        className="map-img-premium"
                                                    />
                                                    <div className="map-card-overlay-premium">
                                                        <div className="map-card-info-premium">
                                                            <h3 className="map-card-title-premium">
                                                                {m.name}
                                                            </h3>
                                                            <span
                                                                className="map-card-subtitle-premium"
                                                                style={{
                                                                    color: "rgba(255,255,255,0.4)",
                                                                }}
                                                            >
                                                                {m.tacticalDescription ||
                                                                    "Fuera de rotación"}
                                                            </span>
                                                        </div>
                                                        <div className="map-card-actions-premium">
                                                            <button
                                                                className="map-card-action-btn primary"
                                                                onClick={(e) =>
                                                                    createStratForMap(
                                                                        e,
                                                                        m,
                                                                    )
                                                                }
                                                                disabled={
                                                                    createStratMutation.isPending
                                                                }
                                                            >
                                                                + Nueva
                                                            </button>
                                                            <button
                                                                className="map-card-action-btn secondary"
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    goToMap(m);
                                                                }}
                                                            >
                                                                Ver Estrategias
                                                            </button>
                                                        </div>
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
                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            paddingRight: 4,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div
                            className="map-banner-premium"
                            style={{
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
                                flexShrink: 0,
                            }}
                        >
                            {/* Background Image (Splash or listViewIconTall/listViewIcon) */}
                            {(selectedMap.splash ||
                                selectedMap.listViewIconTall ||
                                selectedMap.listViewIcon) && (
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        backgroundImage: `url(${selectedMap.splash || selectedMap.listViewIconTall || selectedMap.listViewIcon || ""})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center 40%",
                                        opacity: 0.35,
                                        zIndex: 0,
                                    }}
                                />
                            )}
                            {/* Visual overlay gradient */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "linear-gradient(to right, rgba(10, 14, 20, 0.95) 0%, rgba(10, 14, 20, 0.7) 50%, rgba(10, 14, 20, 0.2) 100%)",
                                    zIndex: 1,
                                }}
                            />

                            {/* Banner Content */}
                            <div
                                style={{
                                    position: "relative",
                                    zIndex: 2,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    width: "100%",
                                    flexWrap: "wrap",
                                    gap: 20,
                                }}
                            >
                                <div>
                                    <button
                                        onClick={goBack}
                                        style={{
                                            background:
                                                "rgba(255, 255, 255, 0.08)",
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
                                            transition: "all 0.3s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(255, 70, 85, 0.15)";
                                            e.currentTarget.style.borderColor =
                                                "rgba(255, 70, 85, 0.4)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(255, 255, 255, 0.08)";
                                            e.currentTarget.style.borderColor =
                                                "rgba(255, 255, 255, 0.1)";
                                        }}
                                    >
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line
                                                x1="19"
                                                y1="12"
                                                x2="5"
                                                y2="12"
                                            />
                                            <polyline points="12 19 5 12 12 5" />
                                        </svg>
                                        Volver a Mapas
                                    </button>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            marginBottom: 4,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 900,
                                                color: selectedMap.activeInRotation
                                                    ? "#00d4aa"
                                                    : "rgba(255,255,255,0.4)",
                                                textTransform: "uppercase",
                                                letterSpacing: 2,
                                                background:
                                                    selectedMap.activeInRotation
                                                        ? "rgba(0, 212, 170, 0.1)"
                                                        : "rgba(255,255,255,0.05)",
                                                padding: "3px 10px",
                                                borderRadius: "6px",
                                                border: selectedMap.activeInRotation
                                                    ? "1px solid rgba(0, 212, 170, 0.2)"
                                                    : "1px solid rgba(255,255,255,0.1)",
                                            }}
                                        >
                                            {selectedMap.activeInRotation
                                                ? "En Rotación Activa"
                                                : "Fuera de Rotación"}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "rgba(255,255,255,0.4)",
                                                fontWeight: 700,
                                            }}
                                        >
                                            •
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "rgba(255,255,255,0.5)",
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: 1.5,
                                            }}
                                        >
                                            {selectedMap.tacticalDescription ||
                                                "Mapa Competitivo"}
                                        </span>
                                    </div>
                                    <h1
                                        style={{
                                            fontSize: 40,
                                            fontWeight: 950,
                                            textTransform: "uppercase",
                                            color: "#ffffff",
                                            margin: 0,
                                            letterSpacing: 2,
                                            lineHeight: 1.1,
                                            textShadow:
                                                "0 2px 10px rgba(0,0,0,0.5)",
                                        }}
                                        className="gradient-text-valorant"
                                    >
                                        {selectedMap.name}
                                    </h1>
                                    <p
                                        style={{
                                            fontSize: 13,
                                            color: "rgba(255,255,255,0.6)",
                                            marginTop: 8,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Biblioteca de estrategias creadas para
                                        este mapa.
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
                                        boxShadow:
                                            "0 8px 24px rgba(255, 70, 85, 0.35)",
                                        transition: "all 0.3s ease",
                                    }}
                                    onClick={(e) => createStrat(e)}
                                    disabled={createStratMutation.isPending}
                                >
                                    {createStratMutation.isPending
                                        ? "CREANDO..."
                                        : "+ NUEVA ESTRATEGIA"}
                                </button>
                            </div>
                        </div>
                        {strategiesLoading ? (
                            <div className="strats-grid-premium">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="card glass-card"
                                        style={{ padding: 24 }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <Skeleton width="60%" height={16} />
                                            <Skeleton width="20%" height={12} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    const compositions =
                                        getUniqueCompositions(strategies);
                                    const compEntries = Array.from(
                                        compositions.entries(),
                                    );

                                    const filteredStrategies = compositionFilter
                                        ? strategies.filter(
                                              (s) =>
                                                  getAllyComposition(s).join(
                                                      ",",
                                                  ) === compositionFilter,
                                          )
                                        : strategies;

                                    return (
                                        <>
                                            {compEntries.length > 0 && (
                                                <div
                                                    style={{
                                                        marginBottom: 24,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 8,
                                                            marginBottom: 12,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: 3,
                                                                height: 16,
                                                                background:
                                                                    "#00d4aa",
                                                                borderRadius: 2,
                                                            }}
                                                        />
                                                        <h4
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 800,
                                                                color: "rgba(255,255,255,0.7)",
                                                                textTransform:
                                                                    "uppercase",
                                                                letterSpacing: 1.5,
                                                                margin: 0,
                                                            }}
                                                        >
                                                            Filtrar por
                                                            Composición
                                                        </h4>
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexWrap: "wrap",
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                setCompositionFilter(
                                                                    null,
                                                                )
                                                            }
                                                            style={{
                                                                padding:
                                                                    "6px 14px",
                                                                borderRadius: 8,
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                                background:
                                                                    !compositionFilter
                                                                        ? "rgba(0, 212, 170, 0.2)"
                                                                        : "rgba(255,255,255,0.05)",
                                                                border: !compositionFilter
                                                                    ? "1px solid rgba(0, 212, 170, 0.4)"
                                                                    : "1px solid rgba(255,255,255,0.1)",
                                                                color: !compositionFilter
                                                                    ? "#00d4aa"
                                                                    : "rgba(255,255,255,0.6)",
                                                                transition:
                                                                    "all 0.2s ease",
                                                            }}
                                                        >
                                                            TODAS (
                                                            {strategies.length})
                                                        </button>
                                                        {compEntries.map(
                                                            ([
                                                                compKey,
                                                                strats,
                                                            ]) => {
                                                                const compAgents =
                                                                    compKey.split(
                                                                        ",",
                                                                    );
                                                                return (
                                                                    <button
                                                                        key={
                                                                            compKey
                                                                        }
                                                                        onClick={() =>
                                                                            setCompositionFilter(
                                                                                compositionFilter ===
                                                                                    compKey
                                                                                    ? null
                                                                                    : compKey,
                                                                            )
                                                                        }
                                                                        style={{
                                                                            padding:
                                                                                "6px 10px",
                                                                            borderRadius: 8,
                                                                            fontSize: 11,
                                                                            fontWeight: 700,
                                                                            cursor: "pointer",
                                                                            display:
                                                                                "flex",
                                                                            flexDirection:
                                                                                "column",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 3,
                                                                            background:
                                                                                compositionFilter ===
                                                                                compKey
                                                                                    ? "rgba(0, 212, 170, 0.2)"
                                                                                    : "rgba(255,255,255,0.05)",
                                                                            border:
                                                                                compositionFilter ===
                                                                                compKey
                                                                                    ? "1px solid rgba(0, 212, 170, 0.4)"
                                                                                    : "1px solid rgba(255,255,255,0.1)",
                                                                            color:
                                                                                compositionFilter ===
                                                                                compKey
                                                                                    ? "#00d4aa"
                                                                                    : "rgba(255,255,255,0.6)",
                                                                            transition:
                                                                                "all 0.2s ease",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                gap: 3,
                                                                            }}
                                                                        >
                                                                            {compAgents
                                                                                .slice(
                                                                                    0,
                                                                                    3,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        agentId,
                                                                                        idx,
                                                                                    ) => {
                                                                                        const agent =
                                                                                            agents.find(
                                                                                                (
                                                                                                    a,
                                                                                                ) =>
                                                                                                    a.id ===
                                                                                                    agentId,
                                                                                            );
                                                                                        if (
                                                                                            !agent
                                                                                        )
                                                                                            return null;
                                                                                        return (
                                                                                            <NextImage
                                                                                                key={`${agentId}-${idx}`}
                                                                                                src={
                                                                                                    agent.displayIcon
                                                                                                }
                                                                                                alt={
                                                                                                    agent.name
                                                                                                }
                                                                                                width={
                                                                                                    20
                                                                                                }
                                                                                                height={
                                                                                                    20
                                                                                                }
                                                                                                unoptimized
                                                                                                style={{
                                                                                                    borderRadius: 4,
                                                                                                }}
                                                                                            />
                                                                                        );
                                                                                    },
                                                                                )}
                                                                        </div>
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                gap: 3,
                                                                                alignItems:
                                                                                    "center",
                                                                            }}
                                                                        >
                                                                            {compAgents
                                                                                .slice(
                                                                                    3,
                                                                                    5,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        agentId,
                                                                                        idx,
                                                                                    ) => {
                                                                                        const agent =
                                                                                            agents.find(
                                                                                                (
                                                                                                    a,
                                                                                                ) =>
                                                                                                    a.id ===
                                                                                                    agentId,
                                                                                            );
                                                                                        if (
                                                                                            !agent
                                                                                        )
                                                                                            return null;
                                                                                        return (
                                                                                            <NextImage
                                                                                                key={`${agentId}-${idx}`}
                                                                                                src={
                                                                                                    agent.displayIcon
                                                                                                }
                                                                                                alt={
                                                                                                    agent.name
                                                                                                }
                                                                                                width={
                                                                                                    20
                                                                                                }
                                                                                                height={
                                                                                                    20
                                                                                                }
                                                                                                unoptimized
                                                                                                style={{
                                                                                                    borderRadius: 4,
                                                                                                }}
                                                                                            />
                                                                                        );
                                                                                    },
                                                                                )}
                                                                            <span
                                                                                style={{
                                                                                    marginLeft: 2,
                                                                                    opacity: 0.7,
                                                                                    fontSize: 10,
                                                                                }}
                                                                            >
                                                                                ×
                                                                                {
                                                                                    strats.length
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {(
                                                ["attack", "defense"] as const
                                            ).map((side) => {
                                                const sideStrats =
                                                    filteredStrategies.filter(
                                                        (s) => s.side === side,
                                                    );
                                                if (sideStrats.length === 0)
                                                    return null;
                                                return (
                                                    <div
                                                        key={side}
                                                        style={{
                                                            marginBottom: 36,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <div className="strategy-group-title">
                                                            <div
                                                                className="strategy-group-line"
                                                                style={{
                                                                    background:
                                                                        side ===
                                                                        "attack"
                                                                            ? "#ff4655"
                                                                            : "#3b82f6",
                                                                }}
                                                            />
                                                            <h4 className="strategy-group-text">
                                                                {side ===
                                                                "attack"
                                                                    ? "Planes de Ataque (ATK)"
                                                                    : "Líneas de Defensa (DEF)"}
                                                            </h4>
                                                        </div>
                                                        <div className="strats-grid-premium">
                                                            {sideStrats.map(
                                                                (s) => {
                                                                    const allyAgents =
                                                                        getAllyAgents(
                                                                            s,
                                                                        );
                                                                    return (
                                                                        <div
                                                                            key={
                                                                                s.id
                                                                            }
                                                                            style={{
                                                                                position:
                                                                                    "relative",
                                                                            }}
                                                                            onMouseLeave={() =>
                                                                                setMenuOpenId(
                                                                                    null,
                                                                                )
                                                                            }
                                                                        >
                                                                            <div
                                                                                className={`strategy-card-premium ${s.side === "attack" ? "atk" : "def"}`}
                                                                                onClick={() =>
                                                                                    openEditor(
                                                                                        s,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <div
                                                                                    style={{
                                                                                        display:
                                                                                            "flex",
                                                                                        justifyContent:
                                                                                            "space-between",
                                                                                        alignItems:
                                                                                            "center",
                                                                                    }}
                                                                                >
                                                                                    <h3
                                                                                        className="strategy-card-title-premium"
                                                                                        style={{
                                                                                            paddingRight: 30,
                                                                                        }}
                                                                                    >
                                                                                        {
                                                                                            s.name
                                                                                        }
                                                                                    </h3>
                                                                                    <div
                                                                                        style={{
                                                                                            display:
                                                                                                "flex",
                                                                                            alignItems:
                                                                                                "center",
                                                                                            gap: 8,
                                                                                        }}
                                                                                    >
                                                                                        <button
                                                                                            className="tool-btn-premium"
                                                                                            onClick={(
                                                                                                e,
                                                                                            ) => {
                                                                                                e.stopPropagation();
                                                                                                setMenuOpenId(
                                                                                                    menuOpenId ===
                                                                                                        s.id
                                                                                                        ? null
                                                                                                        : s.id,
                                                                                                );
                                                                                            }}
                                                                                            style={{
                                                                                                width: 28,
                                                                                                height: 28,
                                                                                                padding: 0,
                                                                                                display:
                                                                                                    "flex",
                                                                                                alignItems:
                                                                                                    "center",
                                                                                                justifyContent:
                                                                                                    "center",
                                                                                                background:
                                                                                                    menuOpenId ===
                                                                                                    s.id
                                                                                                        ? "rgba(255,255,255,0.1)"
                                                                                                        : "transparent",
                                                                                                border: "none",
                                                                                                color: "white",
                                                                                            }}
                                                                                        >
                                                                                            <svg
                                                                                                width="16"
                                                                                                height="16"
                                                                                                viewBox="0 0 24 24"
                                                                                                fill="none"
                                                                                                stroke="currentColor"
                                                                                                strokeWidth="2.5"
                                                                                                strokeLinecap="round"
                                                                                                strokeLinejoin="round"
                                                                                            >
                                                                                                <circle
                                                                                                    cx="12"
                                                                                                    cy="5"
                                                                                                    r="1.5"
                                                                                                />
                                                                                                <circle
                                                                                                    cx="12"
                                                                                                    cy="12"
                                                                                                    r="1.5"
                                                                                                />
                                                                                                <circle
                                                                                                    cx="12"
                                                                                                    cy="19"
                                                                                                    r="1.5"
                                                                                                />
                                                                                            </svg>
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                {allyAgents.length >
                                                                                    0 && (
                                                                                    <div
                                                                                        style={{
                                                                                            display:
                                                                                                "flex",
                                                                                            gap: 4,
                                                                                            marginTop: 10,
                                                                                            justifyContent:
                                                                                                "center",
                                                                                        }}
                                                                                    >
                                                                                        {allyAgents.map(
                                                                                            (
                                                                                                ca,
                                                                                            ) => {
                                                                                                const agent =
                                                                                                    agents.find(
                                                                                                        (
                                                                                                            a,
                                                                                                        ) =>
                                                                                                            a.id ===
                                                                                                            ca.id,
                                                                                                    );
                                                                                                if (
                                                                                                    !agent
                                                                                                )
                                                                                                    return null;
                                                                                                return (
                                                                                                    <NextImage
                                                                                                        key={
                                                                                                            ca.instanceId
                                                                                                        }
                                                                                                        src={
                                                                                                            agent.displayIcon
                                                                                                        }
                                                                                                        alt={
                                                                                                            agent.name
                                                                                                        }
                                                                                                        title={
                                                                                                            agent.name
                                                                                                        }
                                                                                                        width={
                                                                                                            32
                                                                                                        }
                                                                                                        height={
                                                                                                            32
                                                                                                        }
                                                                                                        unoptimized
                                                                                                        style={{
                                                                                                            borderRadius: 6,
                                                                                                            border: `2px solid ${ROLE_COLORS[agent.role]}`,
                                                                                                        }}
                                                                                                    />
                                                                                                );
                                                                                            },
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {menuOpenId ===
                                                                                s.id && (
                                                                                <div
                                                                                    style={{
                                                                                        position:
                                                                                            "absolute",
                                                                                        top: 40,
                                                                                        right: 12,
                                                                                        background:
                                                                                            "rgba(10, 14, 20, 0.95)",
                                                                                        backdropFilter:
                                                                                            "blur(12px)",
                                                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                                                        borderRadius: 12,
                                                                                        padding: 6,
                                                                                        zIndex: 100,
                                                                                        display:
                                                                                            "flex",
                                                                                        flexDirection:
                                                                                            "column",
                                                                                        gap: 4,
                                                                                        boxShadow:
                                                                                            "0 8px 32px rgba(0,0,0,0.5)",
                                                                                        minWidth: 140,
                                                                                    }}
                                                                                >
                                                                                    <button
                                                                                        onClick={(
                                                                                            e,
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            setMenuOpenId(
                                                                                                null,
                                                                                            );
                                                                                            setConfigName(
                                                                                                s.name,
                                                                                            );
                                                                                            setConfigSide(
                                                                                                s.side as
                                                                                                    | "attack"
                                                                                                    | "defense",
                                                                                            );
                                                                                            setConfigDescription(
                                                                                                s.description ||
                                                                                                    "",
                                                                                            );
                                                                                            setConfigMapId(
                                                                                                s.map_id ||
                                                                                                    selectedMap?.id ||
                                                                                                    "",
                                                                                            );
                                                                                            setEditingExternalStratId(
                                                                                                s.id,
                                                                                            );
                                                                                        }}
                                                                                        style={{
                                                                                            background:
                                                                                                "transparent",
                                                                                            border: "none",
                                                                                            color: "white",
                                                                                            cursor: "pointer",
                                                                                            padding:
                                                                                                "8px 12px",
                                                                                            textAlign:
                                                                                                "left",
                                                                                            borderRadius: 8,
                                                                                            fontSize: 12,
                                                                                            fontWeight: 700,
                                                                                            transition:
                                                                                                "all 0.2s ease",
                                                                                        }}
                                                                                        onMouseEnter={(
                                                                                            e,
                                                                                        ) =>
                                                                                            (e.currentTarget.style.background =
                                                                                                "rgba(255,255,255,0.1)")
                                                                                        }
                                                                                        onMouseLeave={(
                                                                                            e,
                                                                                        ) =>
                                                                                            (e.currentTarget.style.background =
                                                                                                "transparent")
                                                                                        }
                                                                                    >
                                                                                        Editar
                                                                                        atributos
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(
                                                                                            e,
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            setMenuOpenId(
                                                                                                null,
                                                                                            );
                                                                                            if (
                                                                                                confirm(
                                                                                                    "¿Seguro que deseas borrar esta estrategia?",
                                                                                                )
                                                                                            ) {
                                                                                                deleteStratMutation.mutate(
                                                                                                    s.id,
                                                                                                );
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            background:
                                                                                                "transparent",
                                                                                            border: "none",
                                                                                            color: "#ff4655",
                                                                                            cursor: "pointer",
                                                                                            padding:
                                                                                                "8px 12px",
                                                                                            textAlign:
                                                                                                "left",
                                                                                            borderRadius: 8,
                                                                                            fontSize: 12,
                                                                                            fontWeight: 700,
                                                                                            transition:
                                                                                                "all 0.2s ease",
                                                                                        }}
                                                                                        onMouseEnter={(
                                                                                            e,
                                                                                        ) =>
                                                                                            (e.currentTarget.style.background =
                                                                                                "rgba(255,70,85,0.1)")
                                                                                        }
                                                                                        onMouseLeave={(
                                                                                            e,
                                                                                        ) =>
                                                                                            (e.currentTarget.style.background =
                                                                                                "transparent")
                                                                                        }
                                                                                        disabled={
                                                                                            deleteStratMutation.isPending
                                                                                        }
                                                                                    >
                                                                                        Borrar
                                                                                        estrategia
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {!strategiesLoading &&
                                                filteredStrategies.length ===
                                                    0 && (
                                                    <EmptyState
                                                        message={
                                                            compositionFilter
                                                                ? "No hay estrategias con esta composición."
                                                                : "Aún no hay estrategias creadas para este mapa."
                                                        }
                                                    />
                                                )}
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {view === "editor" &&
                    (!current ||
                        strategiesLoading ||
                        mapsLoading ||
                        agentsLoading ||
                        weaponsLoading) && (
                        <div
                            className="editor-card-premium"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: "60vh",
                                background: "rgba(20, 20, 25, 0.7)",
                                backdropFilter: "blur(12px)",
                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                borderRadius: 16,
                                position: "relative",
                                overflow: "hidden",
                                animation: "fadeIn 0.5s ease-out forwards",
                            }}
                        >
                            {/* Animated Background Glow */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    width: "40vw",
                                    height: "40vw",
                                    background:
                                        "radial-gradient(circle, rgba(255, 70, 85, 0.15) 0%, rgba(0,0,0,0) 70%)",
                                    transform: "translate(-50%, -50%)",
                                    animation: "pulse 3s infinite alternate",
                                    zIndex: 0,
                                }}
                            />

                            <div
                                style={{
                                    zIndex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 24,
                                }}
                            >
                                {/* Spinner / Logo */}
                                <div
                                    style={{
                                        position: "relative",
                                        width: 80,
                                        height: 80,
                                    }}
                                >
                                    <svg
                                        viewBox="0 0 100 100"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            animation:
                                                "spin 2s linear infinite",
                                        }}
                                    >
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            fill="none"
                                            stroke="rgba(255, 255, 255, 0.05)"
                                            strokeWidth="4"
                                        />
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            fill="none"
                                            stroke="#FF4655"
                                            strokeWidth="4"
                                            strokeDasharray="251"
                                            strokeDashoffset="150"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)",
                                        }}
                                    >
                                        <svg
                                            width="32"
                                            height="32"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#FF4655"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 2L2 22h20L12 2z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Loading Text */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <h2
                                        style={{
                                            margin: 0,
                                            fontSize: 24,
                                            fontWeight: 800,
                                            letterSpacing: "0.2em",
                                            color: "#fff",
                                            textTransform: "uppercase",
                                            textShadow:
                                                "0 0 10px rgba(255,255,255,0.3)",
                                        }}
                                    >
                                        Sincronizando
                                    </h2>
                                    <span
                                        style={{
                                            color: "rgba(255, 255, 255, 0.5)",
                                            fontSize: 14,
                                            fontWeight: 500,
                                            letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        Iniciando entorno táctico...
                                    </span>
                                </div>
                            </div>

                            <style>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                                @keyframes pulse {
                                    0% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.8); }
                                    100% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                                }
                            `}</style>
                        </div>
                    )}

                {view === "editor" &&
                    current &&
                    !strategiesLoading &&
                    !mapsLoading &&
                    !agentsLoading &&
                    !weaponsLoading && (
                        <div
                            className="editor-card-premium"
                            style={{
                                animation: "fadeIn 0.5s ease-out forwards",
                            }}
                        >
                            {/* Top Toolbar Panel */}
                            <div className="editor-top-bar-premium">
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 16,
                                    }}
                                >
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
                                            justifyContent: "center",
                                            background:
                                                "rgba(255,255,255,0.03)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line
                                                x1="19"
                                                y1="12"
                                                x2="5"
                                                y2="12"
                                            />
                                            <polyline points="12 19 5 12 12 5" />
                                        </svg>
                                    </button>

                                    <div
                                        style={{
                                            width: 1,
                                            height: 24,
                                            background:
                                                "rgba(255,255,255,0.08)",
                                        }}
                                    />

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 800,
                                                color: "#ff4655",
                                                textTransform: "uppercase",
                                                letterSpacing: 1.5,
                                            }}
                                        >
                                            {selectedMap?.name}
                                        </span>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: 900,
                                                    color: "#ffffff",
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                {current.name}
                                            </span>
                                            <button
                                                className="tool-btn-premium"
                                                onClick={() =>
                                                    openConfigModal()
                                                }
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    padding: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background:
                                                        "rgba(255,255,255,0.05)",
                                                    border: "none",
                                                    color: "white",
                                                    borderRadius: 4,
                                                }}
                                                title="Editar atributos"
                                            >
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M12 20h9"></path>
                                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                                                </svg>
                                            </button>

                                            {collabUsers.length > 1 && (
                                                <span
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 900,
                                                        padding: "2px 6px",
                                                        borderRadius: 4,
                                                        background:
                                                            "rgba(34, 197, 94, 0.15)",
                                                        color: "#22c55e",
                                                        border: "1px solid rgba(34, 197, 94, 0.3)",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: 1,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                        animation:
                                                            "pulseGlow 2s infinite",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 5,
                                                            height: 5,
                                                            borderRadius: "50%",
                                                            background:
                                                                "#22c55e",
                                                            boxShadow:
                                                                "0 0 6px #22c55e",
                                                        }}
                                                    />
                                                    LIVE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    {/* Auto-save Status Indicator */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "8px 14px",
                                            borderRadius: 10,
                                            background:
                                                "rgba(255, 255, 255, 0.02)",
                                            border: "1px solid rgba(255, 255, 255, 0.05)",
                                            color: saveStrategyMutation.isPending
                                                ? "#eab308"
                                                : "#22c55e",
                                            fontSize: 10,
                                            fontWeight: 800,
                                            letterSpacing: 0.5,
                                            textTransform: "uppercase",
                                            transition: "all 0.3s ease",
                                            userSelect: "none",
                                        }}
                                    >
                                        {saveStrategyMutation.isPending ? (
                                            <>
                                                <div
                                                    className="animate-spin"
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        border: "2px solid rgba(234, 179, 8, 0.2)",
                                                        borderTopColor:
                                                            "#eab308",
                                                    }}
                                                />
                                                <span
                                                    style={{ color: "#eab308" }}
                                                >
                                                    Guardando...
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: "#22c55e",
                                                        boxShadow:
                                                            "0 0 6px #22c55e",
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        color: "rgba(255, 255, 255, 0.5)",
                                                    }}
                                                >
                                                    Guardado
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            width: 1,
                                            height: 24,
                                            background:
                                                "rgba(255,255,255,0.06)",
                                        }}
                                    />

                                    {/* ── Collaboration: Active Users Presence ── */}
                                    {collabUsers.length > 0 && (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                                marginRight: 6,
                                            }}
                                        >
                                            {collabUsers.map((u, i) => (
                                                <div
                                                    key={u.userId}
                                                    title={`${u.userName}${u.userId === myUserId ? " (tú)" : ""}`}
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        background: u.userColor,
                                                        border:
                                                            u.userId ===
                                                            myUserId
                                                                ? "2px solid #fff"
                                                                : "2px solid rgba(255,255,255,0.15)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        fontSize: 11,
                                                        fontWeight: 900,
                                                        color: "#fff",
                                                        textTransform:
                                                            "uppercase",
                                                        marginLeft:
                                                            i > 0 ? -6 : 0,
                                                        zIndex:
                                                            collabUsers.length -
                                                            i,
                                                        position: "relative",
                                                        cursor: "default",
                                                        boxShadow: `0 0 8px ${u.userColor}55`,
                                                        transition:
                                                            "all 0.3s ease",
                                                    }}
                                                >
                                                    {u.userImage ? (
                                                        <NextImage
                                                            src={u.userImage}
                                                            alt={u.userName}
                                                            width={32}
                                                            height={32}
                                                            unoptimized
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                borderRadius:
                                                                    "50%",
                                                                objectFit:
                                                                    "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        u.userName[0] || "?"
                                                    )}
                                                    {/* Live pulse dot */}
                                                    <div
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            bottom: -1,
                                                            right: -1,
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: "50%",
                                                            background:
                                                                "#22c55e",
                                                            border: "1.5px solid #0a0e14",
                                                            animation:
                                                                "pulseGlow 2s infinite",
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    color: "rgba(255,255,255,0.4)",
                                                    letterSpacing: 0.5,
                                                    marginLeft: 4,
                                                    textTransform: "uppercase",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {collabUsers.length === 1
                                                    ? "Solo tú"
                                                    : `${collabUsers.length} editando`}
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
                                            background:
                                                "rgba(255,255,255,0.02)",
                                        }}
                                        onClick={openConfigModal}
                                        title="Ajustes de la Táctica"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            AJUSTES
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
                                        {(
                                            [
                                                [
                                                    "select",
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="m4 4 7.07 16.93 3.03-7.07 7.07-3.03L4 4z" />
                                                        <path d="m13 13 6 6" />
                                                    </svg>,
                                                    "Seleccionar",
                                                ],
                                                [
                                                    "draw",
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                    </svg>,
                                                    "Lápiz",
                                                ],
                                                [
                                                    "arrow",
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M5 12h14" />
                                                        <path d="m12 5 7 7-7 7" />
                                                    </svg>,
                                                    "Vector/Flecha",
                                                ],
                                                [
                                                    "eraser",
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                                                        <path d="M22 21H7" />
                                                        <path d="m5 11 9 9" />
                                                    </svg>,
                                                    "Borrador",
                                                ],
                                            ] as [
                                                Tool,
                                                React.ReactNode,
                                                string,
                                            ][]
                                        ).map(([t, icon, label]) => (
                                            <button
                                                key={t}
                                                className={`tool-btn-premium ${tool === t ? "active" : ""}`}
                                                onClick={() => {
                                                    setTool(t);
                                                    hoveredPathIdRef.current =
                                                        null;
                                                }}
                                                title={label}
                                                style={{
                                                    width: "100%",
                                                    height: 38,
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                        {pendingSkillRef.current && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    width: "100%",
                                                    margin: "8px 0",
                                                }}
                                            >
                                                <button
                                                    className="tool-btn-premium active"
                                                    title={
                                                        pendingSkillRef.current
                                                            .skill.name ||
                                                        "Habilidad Seleccionada"
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        height: 38,
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    {pendingSkillRef.current
                                                        .skill.displayIcon ? (
                                                        <NextImage
                                                            src={
                                                                pendingSkillRef
                                                                    .current
                                                                    .skill
                                                                    .displayIcon
                                                            }
                                                            alt="Skill Icon"
                                                            width={24}
                                                            height={24}
                                                            unoptimized
                                                            style={{
                                                                objectFit:
                                                                    "contain",
                                                                filter: `drop-shadow(0 0 4px ${pendingSkillRef.current.color})`,
                                                            }}
                                                        />
                                                    ) : (
                                                        <svg
                                                            width="18"
                                                            height="18"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: "rgba(255,255,255,0.7)",
                                                        textAlign: "center",
                                                        textTransform:
                                                            "uppercase",
                                                        lineHeight: 1.1,
                                                    }}
                                                >
                                                    {pendingSkillRef.current
                                                        .skill.name ||
                                                        "Habilidad"}
                                                </span>
                                            </div>
                                        )}
                                        {(session?.user as { role?: string })
                                            ?.role === "super_admin" && (
                                            <>
                                                <div
                                                    style={{
                                                        width: "100%",
                                                        height: 1,
                                                        backgroundColor:
                                                            "rgba(255,255,255,0.1)",
                                                        margin: "8px 0",
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 900,
                                                        color: "rgba(255, 70, 85, 0.8)",
                                                        textTransform:
                                                            "uppercase",
                                                        textAlign: "center",
                                                        lineHeight: 1.1,
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    Admin
                                                </span>
                                                <button
                                                    className={`tool-btn-premium ${tool === "calibrate" ? "active" : ""}`}
                                                    onClick={() => {
                                                        setTool("calibrate");
                                                        setCalibrateState({
                                                            step: "start",
                                                            startPos: null,
                                                            showModal: false,
                                                            distancePx: 0,
                                                        });
                                                        calibrateStateRef.current =
                                                            {
                                                                step: "start",
                                                                startPos: null,
                                                            };
                                                        hoveredPathIdRef.current =
                                                            null;
                                                    }}
                                                    title="Calibrar Escala (Metros)"
                                                    style={{
                                                        width: "100%",
                                                        height: 38,
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M21 12H3" />
                                                        <path d="M21 6H3" />
                                                        <path d="M21 18H3" />
                                                        <path d="M8 6v12" />
                                                        <path d="M16 6v12" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="tool-btn-premium"
                                                    onClick={async () => {
                                                        if (!selectedMap)
                                                            return;
                                                        const currentRot =
                                                            selectedMap.rotationOffset ||
                                                            0;
                                                        const newRot =
                                                            (currentRot + 90) %
                                                            360;
                                                        setSelectedMap({
                                                            ...selectedMap,
                                                            rotationOffset:
                                                                newRot,
                                                        });
                                                        try {
                                                            await fetch(
                                                                "/api/maps/rotate",
                                                                {
                                                                    method: "POST",
                                                                    headers: {
                                                                        "Content-Type":
                                                                            "application/json",
                                                                    },
                                                                    body: JSON.stringify(
                                                                        {
                                                                            mapId: selectedMap.id,
                                                                            rotationOffset:
                                                                                newRot,
                                                                        },
                                                                    ),
                                                                },
                                                            );
                                                        } catch (e) {
                                                            console.error(
                                                                "Error rotating map:",
                                                                e,
                                                            );
                                                        }
                                                    }}
                                                    title="Rotar Mapa 90º"
                                                    style={{
                                                        width: "100%",
                                                        height: 38,
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                                        <path d="M21 3v5h-5" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Tool-specific params: draw & arrow */}
                                    {(tool === "draw" || tool === "arrow") && (
                                        <>
                                            <div className="color-palette-premium-vertical">
                                                {colors2.map((c) => (
                                                    <button
                                                        key={c}
                                                        className={`color-orb-premium ${color === c ? "active" : ""}`}
                                                        style={
                                                            {
                                                                background: c,
                                                                "--orb-glow": c,
                                                                width: 18,
                                                                height: 18,
                                                            } as React.CSSProperties
                                                        }
                                                        onClick={() => {
                                                            setColor(c);
                                                            setShowColorPicker(
                                                                false,
                                                            );
                                                        }}
                                                    >
                                                        {color === c && (
                                                            <div
                                                                style={{
                                                                    width: 4,
                                                                    height: 4,
                                                                    borderRadius:
                                                                        "50%",
                                                                    background:
                                                                        "#fff",
                                                                }}
                                                            />
                                                        )}
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
                                                        justifyContent:
                                                            "center",
                                                        cursor: "pointer",
                                                        transition:
                                                            "all 0.2s ease",
                                                        border: "none",
                                                        padding: 0,
                                                        background:
                                                            "transparent",
                                                    }}
                                                    onClick={() =>
                                                        setShowColorPicker(
                                                            !showColorPicker,
                                                        )
                                                    }
                                                    title="Color personalizado"
                                                    type="button"
                                                >
                                                    <div
                                                        className={`color-orb-premium ${!colors2.includes(color) ? "active" : ""}`}
                                                        style={{
                                                            width: "100%",
                                                            height: 18,
                                                            borderRadius: 9,
                                                            background:
                                                                "conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)",
                                                            boxShadow:
                                                                !colors2.includes(
                                                                    color,
                                                                )
                                                                    ? `0 0 8px ${color}`
                                                                    : "none",
                                                            border: !colors2.includes(
                                                                color,
                                                            )
                                                                ? `2.5px solid ${color}`
                                                                : `0px solid ${color}`,
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                        }}
                                                    >
                                                        {!colors2.includes(
                                                            color,
                                                        ) ? (
                                                            <div
                                                                style={{
                                                                    width: 5,
                                                                    height: 5,
                                                                    borderRadius:
                                                                        "50%",
                                                                    background:
                                                                        "#ffffff",
                                                                    boxShadow:
                                                                        "0 0 2px rgba(0,0,0,0.5)",
                                                                }}
                                                            />
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    fontSize: 8,
                                                                    fontWeight: 900,
                                                                    color: "#ffffff",
                                                                    textShadow:
                                                                        "0 1px 2px rgba(0,0,0,0.8)",
                                                                    letterSpacing: 0.5,
                                                                }}
                                                            >
                                                                MÁS
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    width: "100%",
                                                    gap: 6,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 900,
                                                        color: "rgba(255,255,255,0.4)",
                                                        letterSpacing: 0.5,
                                                        textTransform:
                                                            "uppercase",
                                                    }}
                                                >
                                                    Grosor
                                                </span>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 6,
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    {[2, 5, 10, 18].map(
                                                        (size) => {
                                                            const activeSize =
                                                                tool === "draw"
                                                                    ? pencilSize
                                                                    : arrowSize;
                                                            const isActive =
                                                                activeSize ===
                                                                size;
                                                            const dotSize =
                                                                Math.max(
                                                                    4,
                                                                    Math.min(
                                                                        16,
                                                                        size *
                                                                            0.9,
                                                                    ),
                                                                );
                                                            return (
                                                                <button
                                                                    key={size}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (
                                                                            tool ===
                                                                            "draw"
                                                                        )
                                                                            setPencilSize(
                                                                                size,
                                                                            );
                                                                        else
                                                                            setArrowSize(
                                                                                size,
                                                                            );
                                                                    }}
                                                                    className={`size-selector-btn-premium ${isActive ? "active" : ""}`}
                                                                    style={{
                                                                        width: 28,
                                                                        height: 28,
                                                                        borderRadius:
                                                                            "50%",
                                                                        border: isActive
                                                                            ? "1px solid var(--val-red)"
                                                                            : "1px solid rgba(255,255,255,0.06)",
                                                                        background:
                                                                            isActive
                                                                                ? "rgba(255, 70, 85, 0.15)"
                                                                                : "rgba(255,255,255,0.02)",
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        cursor: "pointer",
                                                                        transition:
                                                                            "all 0.2s ease",
                                                                        outline:
                                                                            "none",
                                                                    }}
                                                                    title={`${size}px`}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: dotSize,
                                                                            height: dotSize,
                                                                            borderRadius:
                                                                                "50%",
                                                                            background:
                                                                                isActive
                                                                                    ? "var(--val-red)"
                                                                                    : "rgba(255,255,255,0.6)",
                                                                            transition:
                                                                                "all 0.2s ease",
                                                                        }}
                                                                    />
                                                                </button>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Tool-specific params: eraser */}
                                    {tool === "eraser" && (
                                        <>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    width: "100%",
                                                    gap: 12,
                                                    marginBottom: 12,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 900,
                                                        color: "rgba(255,255,255,0.4)",
                                                        letterSpacing: 0.5,
                                                        textTransform:
                                                            "uppercase",
                                                    }}
                                                >
                                                    Modo
                                                </span>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 6,
                                                        width: "100%",
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEraserMode(
                                                                "pixels",
                                                            )
                                                        }
                                                        className={`tool-btn-premium ${eraserMode === "pixels" ? "active" : ""}`}
                                                        title="Borrar píxeles en un radio"
                                                        style={{
                                                            width: "100%",
                                                            height: 28,
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            justifyContent:
                                                                "center",
                                                            border:
                                                                eraserMode !==
                                                                "pixels"
                                                                    ? "1px solid rgba(255,255,255,0.06)"
                                                                    : undefined,
                                                        }}
                                                    >
                                                        Píxeles
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEraserMode(
                                                                "lines",
                                                            )
                                                        }
                                                        className={`tool-btn-premium ${eraserMode === "lines" ? "active" : ""}`}
                                                        title="Borrar trazos y agentes enteros"
                                                        style={{
                                                            width: "100%",
                                                            height: 28,
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            justifyContent:
                                                                "center",
                                                            border:
                                                                eraserMode !==
                                                                "lines"
                                                                    ? "1px solid rgba(255,255,255,0.06)"
                                                                    : undefined,
                                                        }}
                                                    >
                                                        Trazos
                                                    </button>
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    width: "100%",
                                                    gap: 6,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 900,
                                                        color: "rgba(255,255,255,0.4)",
                                                        letterSpacing: 0.5,
                                                        textTransform:
                                                            "uppercase",
                                                    }}
                                                >
                                                    Grosor
                                                </span>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 6,
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    {[10, 20, 45, 80].map(
                                                        (size) => {
                                                            const isActive =
                                                                eraserSize ===
                                                                size;
                                                            const dotSize =
                                                                Math.max(
                                                                    4,
                                                                    Math.min(
                                                                        16,
                                                                        size /
                                                                            4,
                                                                    ),
                                                                );
                                                            return (
                                                                <button
                                                                    key={size}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEraserSize(
                                                                            size,
                                                                        )
                                                                    }
                                                                    className={`size-selector-btn-premium ${isActive ? "active" : ""}`}
                                                                    style={{
                                                                        width: 28,
                                                                        height: 28,
                                                                        borderRadius:
                                                                            "50%",
                                                                        border: isActive
                                                                            ? "1px solid var(--val-red)"
                                                                            : "1px solid rgba(255,255,255,0.06)",
                                                                        background:
                                                                            isActive
                                                                                ? "rgba(255, 70, 85, 0.15)"
                                                                                : "rgba(255,255,255,0.02)",
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        cursor: "pointer",
                                                                        transition:
                                                                            "all 0.2s ease",
                                                                        outline:
                                                                            "none",
                                                                    }}
                                                                    title={`${size}px`}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: dotSize,
                                                                            height: dotSize,
                                                                            borderRadius:
                                                                                "50%",
                                                                            background:
                                                                                isActive
                                                                                    ? "var(--val-red)"
                                                                                    : "rgba(255,255,255,0.6)",
                                                                            transition:
                                                                                "all 0.2s ease",
                                                                        }}
                                                                    />
                                                                </button>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Spacer */}
                                    <div style={{ flexGrow: 1 }} />

                                    {/* Actions group */}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            width: "100%",
                                        }}
                                    >
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
                                                pointerEvents: canUndo
                                                    ? "auto"
                                                    : "none",
                                                transition: "all 0.2s ease",
                                            }}
                                            onClick={undo}
                                            title="Deshacer (Ctrl+Z)"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M3 7v6h6" />
                                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                            </svg>
                                            <span
                                                style={{
                                                    fontSize: 8,
                                                    marginTop: 4,
                                                    letterSpacing: 0.5,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                DESHACER
                                            </span>
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
                                                pointerEvents: canRedo
                                                    ? "auto"
                                                    : "none",
                                                transition: "all 0.2s ease",
                                            }}
                                            onClick={redo}
                                            title="Rehacer (Ctrl+Y)"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21 7v6h-6" />
                                                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                                            </svg>
                                            <span
                                                style={{
                                                    fontSize: 8,
                                                    marginTop: 4,
                                                    letterSpacing: 0.5,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                REHACER
                                            </span>
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
                                                opacity:
                                                    pathsRef.current.length >
                                                        0 ||
                                                    agentsRef.current.length >
                                                        0 ||
                                                    skillsRef.current.length > 0
                                                        ? 1
                                                        : 0.35,
                                                transition: "all 0.2s ease",
                                            }}
                                            onClick={() => {
                                                clearAll();
                                            }}
                                            title="Borrar todo el lienzo"
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                <path d="M10 11v6" />
                                                <path d="M14 11v6" />
                                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                            </svg>
                                            <span
                                                style={{
                                                    fontSize: 8,
                                                    marginTop: 4,
                                                    letterSpacing: 0.5,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                BORRAR TODO
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Color Picker Panel (Styled to match the app) */}
                                {showColorPicker && (
                                    <div className="color-picker-panel-premium">
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 900,
                                                    color: "rgba(255,255,255,0.6)",
                                                    textTransform: "uppercase",
                                                    letterSpacing: 1,
                                                }}
                                            >
                                                Color de trazo
                                            </span>
                                            <button
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "rgba(255,255,255,0.4)",
                                                    cursor: "pointer",
                                                    fontSize: 12,
                                                    padding: 0,
                                                }}
                                                onClick={() =>
                                                    setShowColorPicker(false)
                                                }
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Color Preview Block */}
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "center",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: color,
                                                    border: "1px solid rgba(255,255,255,0.2)",
                                                    boxShadow: `0 0 10px ${color}33`,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 800,
                                                        color: "#fff",
                                                    }}
                                                >
                                                    Valor actual
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontFamily: "monospace",
                                                        color: "rgba(255,255,255,0.5)",
                                                    }}
                                                >
                                                    {color}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 2D Picker Canvas (Saturation & Value) */}
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 4,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    color: "rgba(255,255,255,0.4)",
                                                }}
                                            >
                                                <span>
                                                    SATURACIÓN / LUMINOSIDAD
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    position: "relative",
                                                    width: "100%",
                                                    height: 110,
                                                }}
                                            >
                                                {/* Gradient Background Container */}
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        inset: 0,
                                                        borderRadius: 8,
                                                        backgroundColor: `hsl(${customH}, 100%, 50%)`,
                                                        backgroundImage:
                                                            "linear-gradient(to bottom, transparent, #000000), linear-gradient(to right, #ffffff, transparent)",
                                                        overflow: "hidden",
                                                        boxShadow:
                                                            "inset 0 0 0 1px rgba(255,255,255,0.15)",
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                                {/* Dragging Area & Target Selector */}
                                                <div
                                                    onMouseDown={handleStart2D}
                                                    onTouchStart={
                                                        handleTouchStart2D
                                                    }
                                                    style={{
                                                        position: "absolute",
                                                        inset: 0,
                                                        cursor: "crosshair",
                                                        userSelect: "none",
                                                    }}
                                                >
                                                    {/* Target selector circle */}
                                                    <div
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            left: `${customHSV.s}%`,
                                                            top: `${100 - customHSV.v}%`,
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: "50%",
                                                            background:
                                                                "#ffffff",
                                                            border: "2px solid #000000",
                                                            boxShadow:
                                                                "0 0 0 1.5px #ffffff, 0 1px 4px rgba(0,0,0,0.5)",
                                                            transform:
                                                                "translate(-50%, -50%)",
                                                            cursor: isDraggingColor
                                                                ? "crosshair"
                                                                : "grab",
                                                            pointerEvents:
                                                                "auto",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hue Slider */}
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 4,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    fontSize: 9,
                                                    fontWeight: 800,
                                                    color: "rgba(255,255,255,0.4)",
                                                }}
                                            >
                                                <span>TONO</span>
                                                <span>{customH}°</span>
                                            </div>
                                            <div
                                                style={{
                                                    position: "relative",
                                                    width: "100%",
                                                    height: 8,
                                                    borderRadius: 4,
                                                    background:
                                                        "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    value={customH}
                                                    onChange={(e) => {
                                                        const h = parseInt(
                                                            e.target.value,
                                                        );
                                                        setCustomH(h);
                                                        setColor(
                                                            `hsl(${h}, ${customS}%, ${customL}%)`,
                                                        );
                                                    }}
                                                    className="color-picker-slider"
                                                    style={{
                                                        position: "absolute",
                                                        left: 6,
                                                        right: 6,
                                                        width: "calc(100% - 12px)",
                                                        background:
                                                            "transparent",
                                                        margin: 0,
                                                        padding: 0,
                                                        height: 20,
                                                        cursor: "pointer",
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() =>
                                                setShowColorPicker(false)
                                            }
                                            style={{
                                                marginTop: 4,
                                                background:
                                                    "rgba(255, 70, 85, 0.15)",
                                                border: "1px solid rgba(255, 70, 85, 0.4)",
                                                color: "#ffffff",
                                                borderRadius: 6,
                                                padding: "6px 0",
                                                fontSize: 10,
                                                fontWeight: 900,
                                                letterSpacing: 1,
                                                cursor: "pointer",
                                                textTransform: "uppercase",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            ACEPTAR
                                        </button>
                                    </div>
                                )}

                                {/* Canvas Wrap */}
                                <div
                                    className="canvas-wrap-premium"
                                    style={{
                                        flex: 1,
                                        minHeight: 0,
                                        position: "relative",
                                        overflow: "hidden",
                                    }}
                                    onDragEnter={handleCanvasDragEnter}
                                    onDragOver={handleCanvasDragOver}
                                    onDrop={handleCanvasDrop}
                                    onWheel={(e) => {
                                        const scaleFactor = 1.15;
                                        const currentZoom = zoomRef.current;
                                        const currentPan = panRef.current;

                                        let newZoom = currentZoom;
                                        if (e.deltaY < 0) {
                                            newZoom = Math.min(
                                                currentZoom * scaleFactor,
                                                6,
                                            );
                                        } else {
                                            newZoom = Math.max(
                                                currentZoom / scaleFactor,
                                                0.4,
                                            );
                                        }

                                        const canvas = canvasRef.current;
                                        if (!canvas) return;
                                        const rect =
                                            canvas.getBoundingClientRect();
                                        const mouseX = e.clientX - rect.left;
                                        const mouseY = e.clientY - rect.top;

                                        const dx =
                                            mouseX -
                                            canvas.width / 2 -
                                            currentPan.x;
                                        const dy =
                                            mouseY -
                                            canvas.height / 2 -
                                            currentPan.y;

                                        const zoomRatio = newZoom / currentZoom;
                                        const newPanX =
                                            mouseX -
                                            canvas.width / 2 -
                                            dx * zoomRatio;
                                        const newPanY =
                                            mouseY -
                                            canvas.height / 2 -
                                            dy * zoomRatio;

                                        setZoom(newZoom);
                                        setPan({ x: newPanX, y: newPanY });
                                    }}
                                >
                                    <canvas
                                        ref={canvasRef}
                                        style={{
                                            display: "block",
                                            cursor:
                                                tool === "select"
                                                    ? "default"
                                                    : tool === "eraser"
                                                      ? "none"
                                                      : "crosshair",
                                            touchAction: "none",
                                            width: "100%",
                                            height: "100%",
                                        }}
                                        onMouseDown={(e) => {
                                            if (hoverMenuState?.visible)
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                            startDraw(e);
                                        }}
                                        onMouseMove={draw}
                                        onMouseUp={stopDraw}
                                        onMouseLeave={() => {
                                            mousePosRef.current = null;
                                            hoveredPathIdRef.current = null;
                                            if (customCursorRef.current)
                                                customCursorRef.current.style.display =
                                                    "none";
                                            redrawImmediate();
                                        }}
                                        onTouchStart={startDraw}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDraw}
                                        onDragEnter={handleCanvasDragEnter}
                                        onDragOver={handleCanvasDragOver}
                                        onDrop={handleCanvasDrop}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            if (hoverMenuState?.visible)
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                            if (
                                                (isPlacingSecondPointRef.current ||
                                                    isPlacingMultiDisplacementRef.current) &&
                                                draggedSkillTargetRef.current
                                            ) {
                                                const sId =
                                                    draggedSkillTargetRef
                                                        .current.instanceId;
                                                skillsRef.current =
                                                    skillsRef.current.filter(
                                                        (s) =>
                                                            s.instanceId !==
                                                            sId,
                                                    );
                                                undoStackRef.current.pop();
                                                isPlacingSecondPointRef.current = false;
                                                isPlacingMultiDisplacementRef.current = false;
                                                draggedSkillTargetRef.current =
                                                    null;
                                                setTool("select");
                                                redrawImmediate();
                                                broadcastEraseElements(
                                                    [],
                                                    [],
                                                    [sId],
                                                );
                                            }
                                        }}
                                    />

                                    <div
                                        ref={customCursorRef}
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            pointerEvents: "none",
                                            border: "1.5px solid rgba(255,255,255,0.8)",
                                            boxShadow:
                                                "0 0 0 1px rgba(0,0,0,0.3) inset, 0 0 0 1px rgba(0,0,0,0.3)",
                                            borderRadius: "50%",
                                            transform: "translate(-50%, -50%)",
                                            display: "none",
                                            zIndex: 10,
                                            willChange:
                                                "transform, width, height",
                                        }}
                                    />

                                    {/* Tool Guide */}
                                    <div
                                        style={{
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
                                            gap: 6,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 900,
                                                textTransform: "uppercase",
                                                letterSpacing: 1.5,
                                                color: "rgba(255,255,255,0.45)",
                                            }}
                                        >
                                            {tool === "select"
                                                ? "Seleccionar"
                                                : tool === "draw"
                                                  ? "Lápiz"
                                                  : tool === "arrow"
                                                    ? "Vector"
                                                    : tool === "eraser"
                                                      ? "Borrador"
                                                      : tool === "skill"
                                                        ? "Habilidad"
                                                        : ""}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 500,
                                                color: "rgba(255,255,255,0.25)",
                                                lineHeight: 1.4,
                                                textShadow:
                                                    "0 1px 4px rgba(0,0,0,0.5)",
                                            }}
                                        >
                                            {(() => {
                                                const IconLeftClick = (
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        style={{
                                                            flexShrink: 0,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        <rect
                                                            x="5"
                                                            y="2"
                                                            width="14"
                                                            height="20"
                                                            rx="7"
                                                        />
                                                        <path d="M12 2v7" />
                                                        <path d="M5 9h14" />
                                                        <path
                                                            d="M5 9C5 5.13 8.13 2 12 2v7H5z"
                                                            fill="currentColor"
                                                            opacity="0.8"
                                                            stroke="none"
                                                        />
                                                    </svg>
                                                );
                                                const IconRightClick = (
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        style={{
                                                            flexShrink: 0,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        <rect
                                                            x="5"
                                                            y="2"
                                                            width="14"
                                                            height="20"
                                                            rx="7"
                                                        />
                                                        <path d="M12 2v7" />
                                                        <path d="M5 9h14" />
                                                        <path
                                                            d="M19 9C19 5.13 15.87 2 12 2v7h7z"
                                                            fill="currentColor"
                                                            opacity="0.8"
                                                            stroke="none"
                                                        />
                                                    </svg>
                                                );
                                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                const MoveIcon = (
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        style={{
                                                            flexShrink: 0,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        <polyline points="5 9 2 12 5 15" />
                                                        <polyline points="9 5 12 2 15 5" />
                                                        <polyline points="19 9 22 12 19 15" />
                                                        <polyline points="9 19 12 22 15 19" />
                                                        <line
                                                            x1="2"
                                                            y1="12"
                                                            x2="22"
                                                            y2="12"
                                                        />
                                                        <line
                                                            x1="12"
                                                            y1="2"
                                                            x2="12"
                                                            y2="22"
                                                        />
                                                    </svg>
                                                );
                                                const Item = ({
                                                    icon,
                                                    text,
                                                }: {
                                                    icon: React.ReactNode;
                                                    text: string;
                                                }) => (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: 6,
                                                            alignItems:
                                                                "flex-start",
                                                            textAlign: "left",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: "rgba(255,255,255,0.3)",
                                                            }}
                                                        >
                                                            {icon}
                                                        </div>
                                                        <span>{text}</span>
                                                    </div>
                                                );

                                                return (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        {tool === "select" && (
                                                            <Item
                                                                icon={
                                                                    IconLeftClick
                                                                }
                                                                text="Clic izquierdo para arrastrar agentes"
                                                            />
                                                        )}
                                                        {tool === "draw" && (
                                                            <Item
                                                                icon={
                                                                    IconLeftClick
                                                                }
                                                                text="Clic izquierdo para dibujar a mano alzada"
                                                            />
                                                        )}
                                                        {tool === "arrow" && (
                                                            <Item
                                                                icon={
                                                                    IconLeftClick
                                                                }
                                                                text="Clic izquierdo para dibujar flechas rectas"
                                                            />
                                                        )}
                                                        {tool === "eraser" &&
                                                            eraserMode ===
                                                                "pixels" && (
                                                                <Item
                                                                    icon={
                                                                        IconLeftClick
                                                                    }
                                                                    text="Clic izquierdo para eliminar en un radio"
                                                                />
                                                            )}
                                                        {tool === "eraser" &&
                                                            eraserMode ===
                                                                "lines" && (
                                                                <Item
                                                                    icon={
                                                                        IconLeftClick
                                                                    }
                                                                    text="Clic izquierdo para borrar trazos o agentes"
                                                                />
                                                            )}
                                                        <Item
                                                            icon={
                                                                IconRightClick
                                                            }
                                                            text="Clic derecho para mover la cámara"
                                                        />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Floating Zoom & Perspective Controls */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: 16,
                                            right: 16,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            zIndex: 10,
                                        }}
                                    >
                                        <button
                                            className="tool-btn-premium"
                                            onClick={() => {
                                                const nextZoom = Math.min(
                                                    zoom * 1.25,
                                                    6,
                                                );
                                                setZoom(nextZoom);
                                            }}
                                            title="Acercar"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                padding: 0,
                                                justifyContent: "center",
                                            }}
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="5"
                                                    x2="12"
                                                    y2="19"
                                                />
                                                <line
                                                    x1="5"
                                                    y1="12"
                                                    x2="19"
                                                    y2="12"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            className="tool-btn-premium"
                                            onClick={() => {
                                                const nextZoom = Math.max(
                                                    zoom / 1.25,
                                                    0.4,
                                                );
                                                setZoom(nextZoom);
                                            }}
                                            title="Alejar"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                padding: 0,
                                                justifyContent: "center",
                                            }}
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="5"
                                                    y1="12"
                                                    x2="19"
                                                    y2="12"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            className="tool-btn-premium"
                                            onClick={() => {
                                                setZoom(1);
                                                setPan({ x: 0, y: 0 });
                                            }}
                                            title="Restablecer vista"
                                            style={{
                                                width: 64,
                                                height: 32,
                                                borderRadius: 8,
                                                padding: 0,
                                                fontSize: 10,
                                                fontWeight: 800,
                                                justifyContent: "center",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {Math.round(zoom * 100)}%
                                        </button>

                                        {/* Integrated Horizontal Side/Perspective Selector */}
                                        <div
                                            className="pill-toggle-premium"
                                            style={{
                                                padding: 2,
                                                borderRadius: 8,
                                                display: "flex",
                                                gap: 2,
                                                height: 32,
                                                alignItems: "center",
                                                background:
                                                    "rgba(10, 14, 20, 0.75)",
                                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                                backdropFilter: "blur(8px)",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                className={`pill-btn-premium atk ${selectedSide === "attack" ? "active" : ""}`}
                                                onClick={() => {
                                                    const newSide = "attack";
                                                    setSelectedSide(newSide);
                                                    setCurrent((prev) =>
                                                        prev
                                                            ? {
                                                                  ...prev,
                                                                  side: newSide,
                                                              }
                                                            : prev,
                                                    );
                                                    saveStrategyMutation.mutate(
                                                        newSide,
                                                    );
                                                    if (channelRef.current) {
                                                        channelRef.current.send(
                                                            {
                                                                type: "broadcast",
                                                                event: "side-change",
                                                                payload: {
                                                                    userId: myUserId,
                                                                    side: newSide,
                                                                },
                                                            },
                                                        );
                                                    }
                                                }}
                                                title="Perspectiva de Ataque (ATK)"
                                                style={{
                                                    padding: "0 8px",
                                                    fontSize: 10,
                                                    borderRadius: 6,
                                                    fontWeight: 800,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    height: "100%",
                                                    border: "none",
                                                }}
                                            >
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <polyline points="14.5 17.5 3 6 6 3 17.5 14.5" />
                                                    <line
                                                        x1="13"
                                                        y1="19"
                                                        x2="19"
                                                        y2="13"
                                                    />
                                                    <line
                                                        x1="16"
                                                        y1="20"
                                                        x2="20"
                                                        y2="16"
                                                    />
                                                </svg>
                                                ATK
                                            </button>
                                            <button
                                                type="button"
                                                className={`pill-btn-premium def ${selectedSide === "defense" ? "active" : ""}`}
                                                onClick={() => {
                                                    const newSide = "defense";
                                                    setSelectedSide(newSide);
                                                    setCurrent((prev) =>
                                                        prev
                                                            ? {
                                                                  ...prev,
                                                                  side: newSide,
                                                              }
                                                            : prev,
                                                    );
                                                    saveStrategyMutation.mutate(
                                                        newSide,
                                                    );
                                                    if (channelRef.current) {
                                                        channelRef.current.send(
                                                            {
                                                                type: "broadcast",
                                                                event: "side-change",
                                                                payload: {
                                                                    userId: myUserId,
                                                                    side: newSide,
                                                                },
                                                            },
                                                        );
                                                    }
                                                }}
                                                title="Perspectiva de Defensa (DEF)"
                                                style={{
                                                    padding: "0 8px",
                                                    fontSize: 10,
                                                    borderRadius: 6,
                                                    fontWeight: 800,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    height: "100%",
                                                    border: "none",
                                                }}
                                            >
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
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
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 4,
                                        flexShrink: 0,
                                        alignItems: "center",
                                    }}
                                >
                                    <button
                                        onClick={() => setActiveTeam("ally")}
                                        className={`team-toggle-btn ${activeTeam === "ally" ? "active" : ""}`}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 2,
                                            background:
                                                activeTeam === "ally"
                                                    ? "rgba(0, 212, 170, 0.08)"
                                                    : "rgba(255, 255, 255, 0.01)",
                                            border:
                                                activeTeam === "ally"
                                                    ? "1px solid rgba(0, 212, 170, 0.3)"
                                                    : "1px solid rgba(255, 255, 255, 0.04)",
                                            borderRadius: 8,
                                            padding: "6px 12px",
                                            height: 58,
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                            boxSizing: "border-box",
                                            color:
                                                activeTeam === "ally"
                                                    ? "#00d4aa"
                                                    : "rgba(255,255,255,0.35)",
                                        }}
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: 8,
                                                fontWeight: 800,
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            Aliado
                                        </span>
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
                                            background:
                                                activeTeam === "enemy"
                                                    ? "rgba(255, 70, 85, 0.08)"
                                                    : "rgba(255, 255, 255, 0.01)",
                                            border:
                                                activeTeam === "enemy"
                                                    ? "1px solid rgba(255, 70, 85, 0.3)"
                                                    : "1px solid rgba(255, 255, 255, 0.04)",
                                            borderRadius: 8,
                                            padding: "6px 12px",
                                            height: 58,
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                            boxSizing: "border-box",
                                            color:
                                                activeTeam === "enemy"
                                                    ? "#ff4655"
                                                    : "rgba(255,255,255,0.35)",
                                        }}
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <line
                                                x1="18"
                                                y1="8"
                                                x2="23"
                                                y2="13"
                                            />
                                            <line
                                                x1="23"
                                                y1="8"
                                                x2="18"
                                                y2="13"
                                            />
                                        </svg>
                                        <span
                                            style={{
                                                fontSize: 8,
                                                fontWeight: 800,
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            Enemigo
                                        </span>
                                    </button>
                                </div>

                                <div
                                    style={{
                                        width: 1,
                                        height: 32,
                                        background: "rgba(255,255,255,0.08)",
                                        flexShrink: 0,
                                    }}
                                />

                                <div
                                    className="agents-horizontal-premium"
                                    style={{ flex: 1, minWidth: 0 }}
                                    ref={agentsScrollRef}
                                    onWheel={handleAgentsWheel}
                                >
                                    {(
                                        [
                                            "duelist",
                                            "initiator",
                                            "controller",
                                            "sentinel",
                                        ] as AgentRole[]
                                    ).map((role) => {
                                        const roleAgents =
                                            getAgentsByRole(role);
                                        if (roleAgents.length === 0)
                                            return null;
                                        return (
                                            <div
                                                key={role}
                                                className="agents-role-group-premium"
                                            >
                                                <button
                                                    onClick={() =>
                                                        setActiveRole(
                                                            activeRole === role
                                                                ? null
                                                                : role,
                                                        )
                                                    }
                                                    className={`agents-role-header-premium ${activeRole === role ? "active" : ""}`}
                                                    style={{
                                                        background:
                                                            activeRole === role
                                                                ? ROLE_COLORS[
                                                                      role
                                                                  ]
                                                                : undefined,
                                                        color:
                                                            activeRole === role
                                                                ? role ===
                                                                  "initiator"
                                                                    ? "#0a0e14"
                                                                    : "#ffffff"
                                                                : ROLE_COLORS[
                                                                      role
                                                                  ],
                                                        borderColor:
                                                            activeRole === role
                                                                ? ROLE_COLORS[
                                                                      role
                                                                  ]
                                                                : undefined,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 18,
                                                            height: 18,
                                                            backgroundColor:
                                                                activeRole ===
                                                                role
                                                                    ? role ===
                                                                      "initiator"
                                                                        ? "#0a0e14"
                                                                        : "#ffffff"
                                                                    : ROLE_COLORS[
                                                                          role
                                                                      ],
                                                            maskImage: `url(${roleAgents[0].roleIcon})`,
                                                            WebkitMaskImage: `url(${roleAgents[0].roleIcon})`,
                                                            maskSize: "contain",
                                                            WebkitMaskSize:
                                                                "contain",
                                                            maskRepeat:
                                                                "no-repeat",
                                                            WebkitMaskRepeat:
                                                                "no-repeat",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <span className="agents-role-name-premium">
                                                        {role.toUpperCase()}S
                                                    </span>
                                                </button>

                                                <div
                                                    className={`agents-row-premium ${activeRole === role ? "expanded" : ""}`}
                                                >
                                                    {roleAgents.map((a) => (
                                                        <button
                                                            key={a.id}
                                                            className="agent-btn-premium-horizontal"
                                                            onClick={() =>
                                                                dropAgent(a)
                                                            }
                                                            draggable={true}
                                                            onDragStart={(e) =>
                                                                handleAgentDragStart(
                                                                    e,
                                                                    a.id,
                                                                )
                                                            }
                                                        >
                                                            <NextImage
                                                                src={
                                                                    a.displayIcon
                                                                }
                                                                alt={a.name}
                                                                width={40}
                                                                height={40}
                                                                unoptimized
                                                                className="agent-icon-horizontal"
                                                                style={{
                                                                    border: `1.5px solid ${ROLE_COLORS[a.role] || "#fff"}`,
                                                                }}
                                                            />
                                                            <div className="agent-name-horizontal">
                                                                {a.name.toUpperCase()}
                                                            </div>
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

            {hoverMenuState.skill &&
                (() => {
                    const ctxSkill = hoverMenuState.skill;
                    let screenX = hoverMenuState.x;
                    let screenY = hoverMenuState.y;
                    const canvas = canvasRef.current;
                    if (canvas) {
                        let cx = ctxSkill.x;
                        let cy = ctxSkill.y;
                        if (
                            hoverMenuState.anchor === "target" &&
                            ctxSkill.targetX !== undefined &&
                            ctxSkill.targetY !== undefined
                        ) {
                            cx = ctxSkill.targetX;
                            cy = ctxSkill.targetY;
                        }
                        const pos = getScreenPos(cx, cy);
                        screenX = pos.x + canvas.getBoundingClientRect().left;
                        screenY = pos.y + canvas.getBoundingClientRect().top;
                    }
                    return (
                        <div
                            onMouseEnter={() => {
                                if (hoverMenuTimeoutRef.current)
                                    clearTimeout(hoverMenuTimeoutRef.current);
                                hoverMenuTimeoutRef.current = null;
                                hoveredSkillRef.current = ctxSkill;
                                setHoverMenuState((prev) =>
                                    prev.visible
                                        ? prev
                                        : { ...prev, visible: true },
                                );
                            }}
                            onMouseLeave={() => {
                                hoveredSkillRef.current = null;
                                setHoverMenuState((prev) => ({
                                    ...prev,
                                    visible: false,
                                }));
                                redrawImmediate();
                            }}
                            style={{
                                position: "fixed",
                                left: screenX,
                                top: screenY - 24,
                                pointerEvents: hoverMenuState.visible
                                    ? "auto"
                                    : "none",
                                opacity: hoverMenuState.visible ? 1 : 0,
                                transform: hoverMenuState.visible
                                    ? "translate(-50%, -50%) scale(1)"
                                    : "translate(-50%, -50%) scale(0.95)",
                                transition:
                                    "opacity 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                zIndex: 9999,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <div style={{ display: "flex", gap: 4 }}>
                                {!ctxSkill.unlinked && (
                                    <button
                                        onClick={() => {
                                            const idx =
                                                skillsRef.current.findIndex(
                                                    (s) =>
                                                        s.instanceId ===
                                                        ctxSkill.instanceId,
                                                );
                                            if (idx >= 0) {
                                                const oldSkill = {
                                                    ...skillsRef.current[idx],
                                                };
                                                skillsRef.current[
                                                    idx
                                                ].unlinked = true;
                                                undoStackRef.current.push({
                                                    type: "remove-skill", // Simple state change, could just trigger update
                                                    skill: oldSkill,
                                                    index: idx,
                                                });
                                                redrawImmediate();
                                                broadcastSkillUpdate(
                                                    skillsRef.current[idx],
                                                    false,
                                                );
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                                hoveredSkillRef.current = null;
                                            }
                                        }}
                                        title="Desvincular del agente"
                                        style={{
                                            background:
                                                "rgba(255, 255, 255, 0.1)",
                                            border: "none",
                                            borderRadius: 8,
                                            width: 32,
                                            height: 32,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#fff",
                                            cursor: "pointer",
                                            backdropFilter: "blur(4px)",
                                        }}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
                                            <path d="m5.17 11.67-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
                                            <line
                                                x1="8"
                                                y1="8"
                                                x2="16"
                                                y2="16"
                                            />
                                        </svg>
                                    </button>
                                )}
                                {ctxSkill.unlinked && (
                                    <button
                                        onClick={() => {
                                            const idx =
                                                skillsRef.current.findIndex(
                                                    (s) =>
                                                        s.instanceId ===
                                                        ctxSkill.instanceId,
                                                );
                                            if (idx >= 0) {
                                                const oldSkill = {
                                                    ...skillsRef.current[idx],
                                                };
                                                skillsRef.current[
                                                    idx
                                                ].unlinked = false;

                                                const s =
                                                    skillsRef.current[idx];
                                                if (
                                                    [
                                                        "projectile_terminal_aoe",
                                                        "projectile_sweeping",
                                                    ].includes(
                                                        getDeploymentType(
                                                            s,
                                                        ) as string,
                                                    )
                                                ) {
                                                    const agent =
                                                        agentsRef.current.find(
                                                            (a) =>
                                                                a.instanceId ===
                                                                s.agentInstanceId,
                                                        );
                                                    if (agent) {
                                                        const mToPx =
                                                            selectedMap?.pixelsPerMeter ||
                                                            20;
                                                        const newX = agent.x;
                                                        const newY = agent.y;
                                                        let sa = 0;
                                                        if (
                                                            s.targetX !==
                                                                undefined &&
                                                            s.targetY !==
                                                                undefined
                                                        ) {
                                                            sa = Math.atan2(
                                                                s.targetY - s.y,
                                                                s.targetX - s.x,
                                                            );
                                                        }
                                                        if (
                                                            false /* legacy spawnOffset */
                                                        ) {
                                                            // Logic for spawnOffset removed
                                                        }
                                                        const dx = newX - s.x;
                                                        const dy = newY - s.y;
                                                        s.x = newX;
                                                        s.y = newY;
                                                        if (
                                                            s.targetX !==
                                                            undefined
                                                        )
                                                            s.targetX += dx;
                                                        if (
                                                            s.targetY !==
                                                            undefined
                                                        )
                                                            s.targetY += dy;
                                                        if (s.pathPoints) {
                                                            s.pathPoints.forEach(
                                                                (pt) => {
                                                                    pt.x += dx;
                                                                    pt.y += dy;
                                                                },
                                                            );
                                                        }
                                                    }
                                                }

                                                undoStackRef.current.push({
                                                    type: "remove-skill",
                                                    skill: oldSkill,
                                                    index: idx,
                                                });
                                                redrawImmediate();
                                                broadcastSkillUpdate(
                                                    skillsRef.current[idx],
                                                    false,
                                                );
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                                hoveredSkillRef.current = null;
                                            }
                                        }}
                                        title="Vincular al agente"
                                        style={{
                                            background:
                                                "rgba(255, 255, 255, 0.1)",
                                            border: "none",
                                            borderRadius: 8,
                                            width: 32,
                                            height: 32,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#fff",
                                            cursor: "pointer",
                                            backdropFilter: "blur(4px)",
                                        }}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                        </svg>
                                    </button>
                                )}
                                {(session?.user as { role?: string })?.role ===
                                    "super_admin" && (
                                    <button
                                        onClick={() => {
                                            const agentObj =
                                                agentsRef.current.find(
                                                    (a) =>
                                                        a.instanceId ===
                                                        ctxSkill.agentInstanceId,
                                                );
                                            if (agentObj) {
                                                setEditingSkillGlobalParams({
                                                    agentId: agentObj.id,
                                                    skillKey: ctxSkill.key,
                                                });
                                            }
                                            setHoverMenuState((prev) => ({
                                                ...prev,
                                                visible: false,
                                            }));
                                        }}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            backgroundColor: "var(--val-cyan)",
                                            border: "none",
                                            color: "#000",
                                            cursor: "pointer",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            boxShadow:
                                                "0 2px 8px rgba(0,0,0,0.5)",
                                        }}
                                        title="Editar parámetros globales de la habilidad"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        const agentObj = agentsRef.current.find(
                                            (a) =>
                                                a.instanceId ===
                                                ctxSkill.agentInstanceId,
                                        );
                                        if (agentObj) {
                                            if (
                                                false /* legacy ctxSkill.effects?.flags?.grantsWeapon */
                                            ) {
                                                // agentObj.weaponId = "default";
                                            }
                                        }
                                        const skillIdx =
                                            skillsRef.current.findIndex(
                                                (s) =>
                                                    s.instanceId ===
                                                    ctxSkill.instanceId,
                                            );
                                        if (skillIdx > -1) {
                                            skillsRef.current.splice(
                                                skillIdx,
                                                1,
                                            );
                                            undoStackRef.current.push({
                                                type: "remove-skill",
                                                skill: ctxSkill,
                                                index: skillIdx,
                                            });
                                            redoStackRef.current = [];
                                            updateUndoRedo();
                                            redrawImmediate();
                                            broadcastEraseElements(
                                                [],
                                                [],
                                                [ctxSkill.instanceId],
                                            );
                                            setHoverMenuState((prev) => ({
                                                ...prev,
                                                visible: false,
                                            }));
                                        }
                                    }}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        backgroundColor: "#ff4655",
                                        border: "none",
                                        color: "white",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                                    }}
                                    title="Borrar Habilidad"
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })()}

            {hoverMenuState.agent &&
                (() => {
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
                                if (hoverMenuTimeoutRef.current)
                                    clearTimeout(hoverMenuTimeoutRef.current);
                                hoverMenuTimeoutRef.current = null;
                                hoveredAgentRef.current = ctxAgent;
                                setHoverMenuState((prev) =>
                                    prev.visible
                                        ? prev
                                        : { ...prev, visible: true },
                                );
                            }}
                            onMouseLeave={() => {
                                if (!hoverMenuTimeoutRef.current) {
                                    hoverMenuTimeoutRef.current = setTimeout(
                                        () => {
                                            hoveredAgentRef.current = null;
                                            setHoverMenuState((prev) => ({
                                                ...prev,
                                                visible: false,
                                            }));
                                            hoverMenuTimeoutRef.current = null;
                                            redrawImmediate();
                                        },
                                        300,
                                    );
                                }
                            }}
                            style={{
                                position: "fixed",
                                left: screenX,
                                top: screenY,
                                zIndex: 10001,
                                pointerEvents: hoverMenuState.visible
                                    ? "auto"
                                    : "none",
                                opacity: hoverMenuState.visible ? 1 : 0,
                                transform: hoverMenuState.visible
                                    ? "translate(-50%, -50%) scale(1)"
                                    : "translate(-50%, -50%) scale(0.95)",
                                transition:
                                    "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
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
                                    gap: 4,
                                }}
                            >
                                {["C", "Q", "E", "X", "PASSIVE"].map((key) => {
                                    const agentData = agentsData?.agents.find(
                                        (a) => a.id === ctxAgent.id,
                                    );
                                    const mainSkill = agentData?.skills?.find(
                                        (s) =>
                                            s.key.toLowerCase() ===
                                                key.toLowerCase() && s.enabled,
                                    );
                                    const altSkill = agentData?.skills?.find(
                                        (s) =>
                                            s.key.toLowerCase() ===
                                                `${key.toLowerCase()}_alt` &&
                                            s.enabled,
                                    );
                                    if (key === "PASSIVE" && !mainSkill)
                                        return null;

                                    const renderSkillBtn = (
                                        skill: typeof mainSkill,
                                        isAlt?: boolean,
                                    ) => (
                                        <div
                                            style={{
                                                width: 28,
                                                height: isAlt ? 22 : 28,
                                                borderRadius: isAlt ? 4 : 6,
                                                background:
                                                    "rgba(10, 14, 20, 0.9)",
                                                backdropFilter: "blur(12px)",
                                                border: `1px solid ${isAlt ? "rgba(0, 212, 170, 0.3)" : "rgba(255,255,255,0.12)"}`,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: isAlt ? 9 : 12,
                                                fontWeight: 900,
                                                color: isAlt
                                                    ? "rgba(0, 212, 170, 0.8)"
                                                    : "rgba(255,255,255,0.6)",
                                                boxShadow:
                                                    "0 4px 12px rgba(0,0,0,0.5)",
                                                transition: "all 0.15s ease",
                                                cursor: skill
                                                    ? "pointer"
                                                    : "default",
                                                opacity: skill ? 1 : 0.3,
                                                padding: skill?.displayIcon
                                                    ? "4px"
                                                    : "0",
                                                overflow: "hidden",
                                                position: "relative",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!skill) return;
                                                e.currentTarget.style.transform =
                                                    "translateY(-2px)";
                                                e.currentTarget.style.color =
                                                    "#fff";
                                                e.currentTarget.style.background =
                                                    "rgba(255, 255, 255, 0.15)";
                                                if (
                                                    e.currentTarget.querySelector(
                                                        "img",
                                                    )
                                                ) {
                                                    e.currentTarget.querySelector(
                                                        "img",
                                                    )!.style.transform =
                                                        "scale(1.1)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!skill) return;
                                                e.currentTarget.style.transform =
                                                    "translateY(0)";
                                                e.currentTarget.style.color =
                                                    isAlt
                                                        ? "rgba(0, 212, 170, 0.8)"
                                                        : "rgba(255,255,255,0.6)";
                                                e.currentTarget.style.background =
                                                    "rgba(10, 14, 20, 0.9)";
                                                if (
                                                    e.currentTarget.querySelector(
                                                        "img",
                                                    )
                                                ) {
                                                    e.currentTarget.querySelector(
                                                        "img",
                                                    )!.style.transform =
                                                        "scale(1)";
                                                }
                                            }}
                                            draggable={!!skill}
                                            onDragStart={(e) => {
                                                if (!skill) return;
                                                e.dataTransfer.effectAllowed =
                                                    "copy";
                                                e.dataTransfer.setData(
                                                    "application/json",
                                                    JSON.stringify({
                                                        type: "skill",
                                                        key: skill.key,
                                                        color:
                                                            skill.color ||
                                                            agentData
                                                                ?.bgColors?.[0] ||
                                                            "#fff",
                                                        agentInstanceId:
                                                            ctxAgent.instanceId,
                                                        deployment:
                                                            skill.deployment,
                                                        lifetime:
                                                            skill.lifetime,
                                                        resolution:
                                                            skill.resolution,
                                                    }),
                                                );
                                                pendingSkillRef.current = {
                                                    agentInstanceId:
                                                        ctxAgent.instanceId,
                                                    skill,
                                                    color:
                                                        skill.color ||
                                                        agentData
                                                            ?.bgColors?.[0] ||
                                                        "#fff",
                                                };
                                                if (
                                                    e.currentTarget.querySelector(
                                                        "img",
                                                    )
                                                ) {
                                                    e.dataTransfer.setDragImage(
                                                        e.currentTarget.querySelector(
                                                            "img",
                                                        )!,
                                                        12,
                                                        12,
                                                    );
                                                } else {
                                                    e.dataTransfer.setDragImage(
                                                        e.currentTarget as Element,
                                                        14,
                                                        14,
                                                    );
                                                }
                                            }}
                                            onDragEnd={() => {
                                                // Defer clearing pendingSkillRef so onDrop on the canvas fires first
                                                setTimeout(() => {
                                                    pendingSkillRef.current =
                                                        null;
                                                    redrawImmediateRef.current?.();
                                                }, 0);
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                            }}
                                            onClick={() => {
                                                if (!skill) {
                                                    if (
                                                        (
                                                            session?.user as {
                                                                role?: string;
                                                            }
                                                        )?.role ===
                                                        "super_admin"
                                                    ) {
                                                        setEditingSkillGlobalParams(
                                                            {
                                                                agentId:
                                                                    ctxAgent.id,
                                                                skillKey: isAlt
                                                                    ? `${key.toLowerCase()}_alt`
                                                                    : key.toLowerCase(),
                                                            },
                                                        );
                                                        setHoverMenuState(
                                                            (prev) => ({
                                                                ...prev,
                                                                visible: false,
                                                            }),
                                                        );
                                                    } else {
                                                        alert(
                                                            `La habilidad ${key}${isAlt ? " (Alt)" : ""} no está configurada para este agente.`,
                                                        );
                                                    }
                                                    return;
                                                }

                                                // Lógica Sandbox: Teletransporte a habilidad desplegada
                                                if (
                                                    skill.lifetime
                                                        ?.recollectable
                                                ) {
                                                    // Buscar si ya hay un ancla desplegada por este agente
                                                    const deployedSkill =
                                                        skillsRef.current.find(
                                                            (s) =>
                                                                s.agentInstanceId ===
                                                                    ctxAgent.instanceId &&
                                                                s.key ===
                                                                    skill.key,
                                                        );

                                                    if (deployedSkill) {
                                                        const range =
                                                            getCastRange(
                                                                skill,
                                                            ) || 13;
                                                        const dx =
                                                            deployedSkill.x -
                                                            ctxAgent.x;
                                                        const dy =
                                                            deployedSkill.y -
                                                            ctxAgent.y;
                                                        const dist = Math.sqrt(
                                                            dx * dx + dy * dy,
                                                        );

                                                        if (dist <= range) {
                                                            // Teletransportar agente instantáneamente
                                                            const agentIndex =
                                                                agentsRef.current.findIndex(
                                                                    (a) =>
                                                                        a.instanceId ===
                                                                        ctxAgent.instanceId,
                                                                );
                                                            if (
                                                                agentIndex !==
                                                                -1
                                                            ) {
                                                                agentsRef.current[
                                                                    agentIndex
                                                                ].x =
                                                                    deployedSkill.x;
                                                                agentsRef.current[
                                                                    agentIndex
                                                                ].y =
                                                                    deployedSkill.y;
                                                                redraw();
                                                                setHoverMenuState(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        visible: false,
                                                                    }),
                                                                );
                                                                return; // No castear una nueva ancla
                                                            }
                                                        } else {
                                                            // Mostrar feedback visual o alerta si está fuera de rango
                                                            alert(
                                                                "El ancla de teletransporte está fuera de rango.",
                                                            );
                                                            setHoverMenuState(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    visible: false,
                                                                }),
                                                            );
                                                            return;
                                                        }
                                                    }
                                                }

                                                // Lógica Sandbox: Auto-Buff y Revivir visual
                                                if (
                                                    ["self_instant"].includes(
                                                        getDeploymentType(
                                                            skill,
                                                        ) as string,
                                                    ) ||
                                                    false /* legacy revives */
                                                ) {
                                                    const agentIndex =
                                                        agentsRef.current.findIndex(
                                                            (a) =>
                                                                a.instanceId ===
                                                                ctxAgent.instanceId,
                                                        );
                                                    if (agentIndex !== -1) {
                                                        const agent =
                                                            agentsRef.current[
                                                                agentIndex
                                                            ];
                                                        const buffs =
                                                            agent.activeBuffs ||
                                                            [];
                                                        if (
                                                            buffs.includes(
                                                                skill.key,
                                                            )
                                                        ) {
                                                            agent.activeBuffs =
                                                                buffs.filter(
                                                                    (b) =>
                                                                        b !==
                                                                        skill.key,
                                                                );
                                                        } else {
                                                            agent.activeBuffs =
                                                                [
                                                                    ...buffs,
                                                                    skill.key,
                                                                ];

                                                            // Auto-expiración del buff
                                                            const duration =
                                                                skill.lifetime
                                                                    ?.duration;
                                                            if (
                                                                duration &&
                                                                duration > 0
                                                            ) {
                                                                setTimeout(
                                                                    () => {
                                                                        const currentAgent =
                                                                            agentsRef.current.find(
                                                                                (
                                                                                    a,
                                                                                ) =>
                                                                                    a.instanceId ===
                                                                                    ctxAgent.instanceId,
                                                                            );
                                                                        if (
                                                                            currentAgent &&
                                                                            currentAgent.activeBuffs?.includes(
                                                                                skill.key,
                                                                            )
                                                                        ) {
                                                                            currentAgent.activeBuffs =
                                                                                currentAgent.activeBuffs.filter(
                                                                                    (
                                                                                        b,
                                                                                    ) =>
                                                                                        b !==
                                                                                        skill.key,
                                                                                );
                                                                            redrawImmediateRef.current();
                                                                        }
                                                                    },
                                                                    duration *
                                                                        1000,
                                                                );
                                                            }
                                                        }
                                                        redraw();
                                                        setHoverMenuState(
                                                            (prev) => ({
                                                                ...prev,
                                                                visible: false,
                                                            }),
                                                        );
                                                        return;
                                                    }
                                                }

                                                setTool("skill");
                                                pendingSkillRef.current = {
                                                    agentInstanceId:
                                                        ctxAgent.instanceId,
                                                    skill,
                                                    color:
                                                        skill.color ||
                                                        agentData
                                                            ?.bgColors?.[0] ||
                                                        "#fff",
                                                };
                                                setHoverMenuState((prev) => ({
                                                    ...prev,
                                                    visible: false,
                                                }));
                                            }}
                                        >
                                            {skill?.displayIcon ? (
                                                <>
                                                    <NextImage
                                                        src={skill.displayIcon}
                                                        width={32}
                                                        height={32}
                                                        unoptimized
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit:
                                                                "contain",
                                                            filter: isAlt
                                                                ? "sepia(1) hue-rotate(130deg) saturate(3) brightness(1.2)"
                                                                : "none",
                                                            transition:
                                                                "transform 0.15s ease",
                                                            position:
                                                                "relative",
                                                            zIndex: 1,
                                                        }}
                                                        alt={key}
                                                    />
                                                    <span
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            bottom: 2,
                                                            right: 3,
                                                            fontSize: 6,
                                                            fontWeight: 900,
                                                            color: isAlt
                                                                ? "rgba(0, 212, 170, 0.9)"
                                                                : "rgba(255, 255, 255, 0.8)",
                                                            textShadow:
                                                                "0px 1px 2px rgba(0,0,0,1)",
                                                            zIndex: 2,
                                                        }}
                                                    >
                                                        {isAlt
                                                            ? `↳${key}`
                                                            : key === "PASSIVE"
                                                              ? "P"
                                                              : key}
                                                    </span>
                                                </>
                                            ) : isAlt ? (
                                                `↳${key}`
                                            ) : key === "PASSIVE" ? (
                                                "P"
                                            ) : (
                                                key
                                            )}
                                        </div>
                                    );

                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: 2,
                                            }}
                                        >
                                            {renderSkillBtn(mainSkill)}
                                            {altSkill &&
                                                renderSkillBtn(altSkill, true)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Delete button - over agent border */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const agentIdx =
                                        agentsRef.current.findIndex(
                                            (a) =>
                                                a.instanceId ===
                                                ctxAgent.instanceId,
                                        );
                                    const linkedSkills: {
                                        skill: CanvasSkill;
                                        index: number;
                                    }[] = [];
                                    skillsRef.current.forEach((s, idx) => {
                                        if (
                                            s.agentInstanceId ===
                                                ctxAgent.instanceId &&
                                            !s.unlinked
                                        )
                                            linkedSkills.push({
                                                skill: s,
                                                index: idx,
                                            });
                                    });
                                    undoStackRef.current.push({
                                        type: "remove-agent",
                                        agent: ctxAgent,
                                        index: agentIdx,
                                        linkedSkills,
                                    });
                                    redoStackRef.current = [];
                                    agentsRef.current =
                                        agentsRef.current.filter(
                                            (a) =>
                                                a.instanceId !==
                                                ctxAgent.instanceId,
                                        );
                                    if (linkedSkills.length > 0) {
                                        const skillIds = new Set(
                                            linkedSkills.map(
                                                (ls) => ls.skill.instanceId,
                                            ),
                                        );
                                        skillsRef.current =
                                            skillsRef.current.filter(
                                                (s) =>
                                                    !skillIds.has(s.instanceId),
                                            );
                                    }
                                    updateUndoRedo();
                                    redraw();
                                    const deletedSkillIds = Array.from(
                                        new Set(
                                            linkedSkills.map(
                                                (ls) => ls.skill.instanceId,
                                            ),
                                        ),
                                    );
                                    broadcastEraseElements(
                                        [],
                                        [ctxAgent.instanceId],
                                        deletedSkillIds,
                                    );
                                    scheduleAutoSave();
                                    setHoverMenuState((prev) => ({
                                        ...prev,
                                        visible: false,
                                    }));
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
                                    boxShadow:
                                        "0 2px 8px rgba(255, 70, 85, 0.5)",
                                    zIndex: 10001,
                                    lineHeight: 1,
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>

                            {/* Weapon selector - below agent */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: 46,
                                    transform: "translateX(-50%)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 4,
                                    minWidth: 120,
                                }}
                            >
                                {ctxAgent.weaponId &&
                                    (() => {
                                        const w = findWeapon(ctxAgent.weaponId);
                                        if (!w?.killStreamIcon) return null;
                                        return (
                                            <NextImage
                                                src={w.killStreamIcon}
                                                alt={w.displayName}
                                                title={w.displayName}
                                                width={60}
                                                height={18}
                                                unoptimized
                                                style={{
                                                    objectFit: "contain",
                                                    filter: "invert(1) brightness(2)",
                                                    opacity: 0.9,
                                                }}
                                            />
                                        );
                                    })()}
                                <select
                                    style={{
                                        background: "rgba(10, 14, 20, 0.9)",
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 6,
                                        color: "rgba(255,255,255,0.7)",
                                        fontSize: 9,
                                        padding: "2px 4px",
                                        cursor: "pointer",
                                        maxWidth: 110,
                                    }}
                                    value={ctxAgent.weaponId || ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                        const newWeaponId =
                                            e.target.value || undefined;
                                        agentsRef.current =
                                            agentsRef.current.map((a) =>
                                                a.instanceId ===
                                                ctxAgent.instanceId
                                                    ? {
                                                          ...a,
                                                          weaponId: newWeaponId,
                                                      }
                                                    : a,
                                            );
                                        redraw();
                                        scheduleAutoSave();
                                    }}
                                >
                                    <option value="">Sin arma</option>
                                    {Object.entries(WEAPON_CATEGORY_LABELS).map(
                                        ([cat, label]) => {
                                            const catWeapons = weapons.filter(
                                                (w) => w.category === cat,
                                            );
                                            if (catWeapons.length === 0)
                                                return null;
                                            return (
                                                <optgroup
                                                    key={cat}
                                                    label={label}
                                                >
                                                    {catWeapons.map((w) => (
                                                        <option
                                                            key={w.uuid}
                                                            value={w.uuid}
                                                        >
                                                            {w.displayName}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        },
                                    )}
                                </select>
                            </div>
                        </div>
                    );
                })()}

            {editingSkillGlobalParams && (
                <div className="modal-overlay" style={{ zIndex: 100000 }}>
                    <div
                        className="modal-content card glass-card premium-modal"
                        style={{
                            width: "95%",
                            maxWidth: 800,
                            padding: 0,
                            overflow: "hidden",
                            height: "80vh",
                            background: "var(--bg-card)",
                        }}
                    >
                        <div
                            style={{
                                padding: "16px 24px",
                                display: "flex",
                                justifyContent: "space-between",
                                borderBottom: "1px solid rgba(255,255,255,0.1)",
                                background: "rgba(0,0,0,0.5)",
                                alignItems: "center",
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: 18,
                                    fontWeight: 800,
                                }}
                            >
                                Editar Parámetros de Habilidad (Global)
                            </h3>
                            <button
                                onClick={() =>
                                    setEditingSkillGlobalParams(null)
                                }
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "rgba(255,255,255,0.6)",
                                    fontSize: 20,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 4,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div
                            style={{
                                height: "calc(100% - 60px)",
                                overflow: "auto",
                            }}
                        >
                            <AgentSkillsManager
                                defaultAgentId={
                                    editingSkillGlobalParams.agentId
                                }
                                defaultSkillKey={
                                    editingSkillGlobalParams.skillKey
                                }
                                isModalMode={true}
                                onClose={() =>
                                    setEditingSkillGlobalParams(null)
                                }
                            />
                        </div>
                    </div>
                </div>
            )}

            {editingExternalStratId && (
                <div className="modal-overlay-premium">
                    <div
                        className="modal-card-premium"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            style={{
                                fontSize: 22,
                                fontWeight: 900,
                                marginBottom: 24,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                            }}
                        >
                            Ajustes de la Táctica
                        </h3>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Nombre de la táctica
                            </label>
                            <input
                                className="input-premium"
                                value={configName}
                                onChange={(e) => setConfigName(e.target.value)}
                                placeholder="Ej: Control de Mid a A"
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Bando de juego
                            </label>
                            <div
                                className="pill-toggle-premium"
                                style={{
                                    width: "100%",
                                    padding: 4,
                                    borderRadius: 8,
                                    display: "flex",
                                    gap: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    className={`pill-btn-premium atk ${configSide === "attack" ? "active" : ""}`}
                                    onClick={() => setConfigSide("attack")}
                                    style={{
                                        flex: 1,
                                        padding: "8px 0",
                                        fontSize: 11,
                                        borderRadius: 6,
                                        textTransform: "uppercase",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                    }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
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
                                    style={{
                                        flex: 1,
                                        padding: "8px 0",
                                        fontSize: 11,
                                        borderRadius: 6,
                                        textTransform: "uppercase",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                    }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    Defensor
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Descripción
                            </label>
                            <textarea
                                className="input-premium"
                                rows={3}
                                value={configDescription}
                                onChange={(e) =>
                                    setConfigDescription(e.target.value)
                                }
                                placeholder="Describe la ejecución, utilidades a usar, etc..."
                                style={{
                                    resize: "none",
                                    height: "auto",
                                    paddingTop: 10,
                                    paddingBottom: 10,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 28 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Cambiar Mapa
                            </label>
                            <select
                                className="input-premium"
                                value={configMapId}
                                onChange={(e) => setConfigMapId(e.target.value)}
                                style={{ cursor: "pointer" }}
                            >
                                {allMaps.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                        {m.activeInRotation ? " ★" : ""}
                                    </option>
                                ))}
                            </select>
                            <span
                                style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.35)",
                                    fontWeight: 600,
                                    marginTop: 4,
                                    display: "block",
                                }}
                            >
                                ★ = En rotación activa.
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                className="btn btn-secondary"
                                style={{ borderRadius: 10 }}
                                onClick={() => setEditingExternalStratId(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{
                                    borderRadius: 10,
                                    padding: "10px 20px",
                                }}
                                onClick={saveExternalConfig}
                                disabled={updateStratMutation.isPending}
                            >
                                {updateStratMutation.isPending
                                    ? "Guardando..."
                                    : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConfigModal && (
                <div className="modal-overlay-premium">
                    <div
                        className="modal-card-premium"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3
                            style={{
                                fontSize: 22,
                                fontWeight: 900,
                                marginBottom: 24,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                            }}
                        >
                            Ajustes de la Táctica
                        </h3>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Nombre de la táctica
                            </label>
                            <input
                                className="input-premium"
                                value={configName}
                                onChange={(e) => setConfigName(e.target.value)}
                                placeholder="Ej: Control de Mid a A"
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Bando de juego
                            </label>
                            <div
                                className="pill-toggle-premium"
                                style={{
                                    width: "100%",
                                    padding: 4,
                                    borderRadius: 8,
                                    display: "flex",
                                    gap: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    className={`pill-btn-premium atk ${configSide === "attack" ? "active" : ""}`}
                                    onClick={() => setConfigSide("attack")}
                                    style={{
                                        flex: 1,
                                        padding: "8px 0",
                                        fontSize: 11,
                                        borderRadius: 6,
                                        textTransform: "uppercase",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                    }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
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
                                    style={{
                                        flex: 1,
                                        padding: "8px 0",
                                        fontSize: 11,
                                        borderRadius: 6,
                                        textTransform: "uppercase",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                    }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    Defensor
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Descripción
                            </label>
                            <textarea
                                className="input-premium"
                                rows={3}
                                value={configDescription}
                                onChange={(e) =>
                                    setConfigDescription(e.target.value)
                                }
                                placeholder="Describe la ejecución, utilidades a usar, etc..."
                                style={{
                                    resize: "none",
                                    height: "auto",
                                    paddingTop: 10,
                                    paddingBottom: 10,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 28 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.5)",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 8,
                                }}
                            >
                                Cambiar Mapa
                            </label>
                            <select
                                className="input-premium"
                                value={configMapId}
                                onChange={(e) => setConfigMapId(e.target.value)}
                                style={{ cursor: "pointer" }}
                            >
                                {allMaps.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                        {m.activeInRotation ? " ★" : ""}
                                    </option>
                                ))}
                            </select>
                            <span
                                style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.35)",
                                    fontWeight: 600,
                                    marginTop: 4,
                                    display: "block",
                                }}
                            >
                                ★ = En rotación activa. Cambiar el mapa no borra
                                el trazado.
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                className="btn btn-secondary"
                                style={{ borderRadius: 10 }}
                                onClick={() => setShowConfigModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{
                                    borderRadius: 10,
                                    padding: "10px 20px",
                                }}
                                onClick={saveConfig}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {calibrateState.showModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: "rgba(0,0,0,0.8)",
                            backdropFilter: "blur(4px)",
                        }}
                        onClick={() =>
                            setCalibrateState({
                                ...calibrateState,
                                showModal: false,
                            })
                        }
                    />
                    <div
                        style={{
                            position: "relative",
                            width: 400,
                            backgroundColor: "#0a0e14",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12,
                            padding: 24,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: 18,
                                fontWeight: 800,
                                color: "#fff",
                                marginBottom: 16,
                            }}
                        >
                            Calibrar Escala del Mapa
                        </h3>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "rgba(255,255,255,0.8)",
                                }}
                            >
                                Introduce la distancia real en metros para la
                                línea que acabas de trazar (
                                {Math.round(calibrateState.distancePx)}px ={" "}
                                {(
                                    calibrateState.distancePx /
                                    (selectedMap?.pixelsPerMeter || 20)
                                ).toFixed(1)}
                                m).
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.6)",
                                    }}
                                >
                                    Distancia (metros)
                                </label>
                                <input
                                    type="number"
                                    value={calibrateMetersInput}
                                    onChange={(e) =>
                                        setCalibrateMetersInput(e.target.value)
                                    }
                                    style={{
                                        width: "100%",
                                        height: 36,
                                        backgroundColor:
                                            "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 6,
                                        color: "#fff",
                                        padding: "0 12px",
                                        outline: "none",
                                    }}
                                    placeholder="Ej: 10"
                                />
                            </div>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 12,
                                marginTop: 24,
                            }}
                        >
                            <button
                                onClick={() =>
                                    setCalibrateState({
                                        step: "start",
                                        startPos: null,
                                        showModal: false,
                                        distancePx: 0,
                                    })
                                }
                                style={{
                                    padding: "0 16px",
                                    height: 36,
                                    backgroundColor: "transparent",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 6,
                                    color: "#fff",
                                    fontWeight: 700,
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const m = parseFloat(calibrateMetersInput);
                                    if (!isNaN(m) && m > 0 && selectedMap) {
                                        const ppm =
                                            calibrateState.distancePx / m;
                                        try {
                                            await fetch("/api/maps/calibrate", {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                },
                                                body: JSON.stringify({
                                                    mapId: selectedMap.id,
                                                    pixelsPerMeter: ppm,
                                                }),
                                            });
                                            setCalibrateState({
                                                step: "start",
                                                startPos: null,
                                                showModal: false,
                                                distancePx: 0,
                                            });
                                            setTool("select");
                                            if (selectedMap) {
                                                setSelectedMap({
                                                    ...selectedMap,
                                                    pixelsPerMeter: ppm,
                                                });
                                                redraw();
                                            }
                                        } catch (e) {
                                            console.error(
                                                "Error calibrating",
                                                e,
                                            );
                                        }
                                    }
                                }}
                                style={{
                                    padding: "0 16px",
                                    height: 36,
                                    backgroundColor: "#ff4655",
                                    border: "none",
                                    borderRadius: 6,
                                    color: "#fff",
                                    fontWeight: 700,
                                }}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {createModalState && createModalState.isOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: "rgba(0,0,0,0.8)",
                            backdropFilter: "blur(4px)",
                        }}
                        onClick={() => setCreateModalState(null)}
                    />
                    <div
                        style={{
                            position: "relative",
                            width: 400,
                            backgroundColor: "#0a0e14",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12,
                            padding: 24,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: 18,
                                fontWeight: 800,
                                color: "#fff",
                                marginBottom: 16,
                            }}
                        >
                            Nueva Estrategia
                        </h3>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.6)",
                                    }}
                                >
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={createModalState.defaultName}
                                    onChange={(e) =>
                                        setCreateModalState({
                                            ...createModalState,
                                            defaultName: e.target.value,
                                        })
                                    }
                                    style={{
                                        width: "100%",
                                        height: 36,
                                        backgroundColor:
                                            "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 6,
                                        color: "#fff",
                                        padding: "0 12px",
                                        outline: "none",
                                    }}
                                    placeholder="Estrategia sin nombre 1"
                                    autoFocus
                                />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.6)",
                                    }}
                                >
                                    Bando (Atacante/Defensor)
                                </label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        onClick={() =>
                                            setCreateModalState({
                                                ...createModalState,
                                                side: "attack",
                                            })
                                        }
                                        style={{
                                            flex: 1,
                                            height: 36,
                                            borderRadius: 6,
                                            border: "1px solid",
                                            borderColor:
                                                createModalState.side ===
                                                "attack"
                                                    ? "#ff4655"
                                                    : "rgba(255,255,255,0.1)",
                                            backgroundColor:
                                                createModalState.side ===
                                                "attack"
                                                    ? "rgba(255,70,85,0.1)"
                                                    : "transparent",
                                            color:
                                                createModalState.side ===
                                                "attack"
                                                    ? "#ff4655"
                                                    : "rgba(255,255,255,0.6)",
                                            fontWeight: 700,
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        Ataque
                                    </button>
                                    <button
                                        onClick={() =>
                                            setCreateModalState({
                                                ...createModalState,
                                                side: "defense",
                                            })
                                        }
                                        style={{
                                            flex: 1,
                                            height: 36,
                                            borderRadius: 6,
                                            border: "1px solid",
                                            borderColor:
                                                createModalState.side ===
                                                "defense"
                                                    ? "#00d4aa"
                                                    : "rgba(255,255,255,0.1)",
                                            backgroundColor:
                                                createModalState.side ===
                                                "defense"
                                                    ? "rgba(0,212,170,0.1)"
                                                    : "transparent",
                                            color:
                                                createModalState.side ===
                                                "defense"
                                                    ? "#00d4aa"
                                                    : "rgba(255,255,255,0.6)",
                                            fontWeight: 700,
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        Defensa
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 12,
                                marginTop: 24,
                            }}
                        >
                            <button
                                onClick={() => setCreateModalState(null)}
                                style={{
                                    padding: "0 16px",
                                    height: 36,
                                    backgroundColor: "transparent",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 6,
                                    color: "#fff",
                                    fontWeight: 700,
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (createModalState.defaultName.trim()) {
                                        createStratMutation.mutate({
                                            name: createModalState.defaultName.trim(),
                                            side: createModalState.side,
                                            mapId: createModalState.mapId,
                                        });
                                        setCreateModalState(null);
                                    }
                                }}
                                disabled={
                                    !createModalState.defaultName.trim() ||
                                    createStratMutation.isPending
                                }
                                style={{
                                    padding: "0 16px",
                                    height: 36,
                                    backgroundColor: "#ff4655",
                                    border: "none",
                                    borderRadius: 6,
                                    color: "#fff",
                                    fontWeight: 700,
                                    opacity:
                                        !createModalState.defaultName.trim() ||
                                        createStratMutation.isPending
                                            ? 0.5
                                            : 1,
                                }}
                            >
                                Crear
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
            <p
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "rgba(255, 255, 255, 0.45)",
                    margin: 0,
                }}
            >
                {message}
            </p>
        </div>
    );
}
