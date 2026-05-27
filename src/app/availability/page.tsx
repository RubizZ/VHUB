/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useSession } from "next-auth/react";
import React, {
    useEffect,
    useState,
    useMemo,
    useRef,
    useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";

interface Player {
    id: string;
    name: string;
    avatar_color: string;
    image?: string | null;
}
interface LinkedMatch {
    id: number;
    riot_match_id: string;
    map_name: string;
    game_start: string;
    game_length_ms: number;
    team_blue_score: number;
    team_red_score: number;
    team_blue_won: boolean;
    queue_id: string;
    our_team_side?: "Blue" | "Red";
}
interface Ev {
    id: number;
    title: string;
    type: string;
    date: string;
    time: string;
    end_date?: string;
    end_time?: string;
    description: string;
    map: string;
    status: string;
    localDate?: string;
    localTime?: string;
    localEndDate?: string;
    localEndTime?: string;
    linkedMatches?: LinkedMatch[];
    map_obj?: any;
    premier_season_id?: string;
    season?: { name: string };
    availability?: {
        player_id: string;
        status: string;
        player: {
            name: string;
            avatar_color: string;
        };
    }[];
}
interface Avail {
    player_id: string;
    player_name: string;
    status: string;
    avatar_color: string;
}

const getEventDisplayName = (ev: { title?: string | null; type: string }) => {
    if (ev.title && ev.title.trim()) return ev.title;
    if (ev.type === "match") return "Partido Premier";
    if (ev.type === "practice") return "Práctica Premier";
    if (ev.type === "playoffs") return "Playoffs Premier";
    return "Evento";
};

const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};


const getCalendarData = (targetDate: Date, events: any[], isMounted: boolean) => {
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const monthLabel = targetDate.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
    });

    let startDayOffset = startOfMonth.getDay();
    if (startDayOffset === 0) startDayOffset = 7;
    startDayOffset -= 1;

    const days = [];
    const weekDays = [];
    const todayStr = formatDateLocal(new Date());

    const prevMonthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    const prevMonthDays = prevMonthEnd.getDate();

    for (let i = startDayOffset - 1; i >= 0; i--) {
        const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, prevMonthDays - i);
        const dateStr = formatDateLocal(d);
        days.push({
            day: prevMonthDays - i,
            date: dateStr,
            isOtherMonth: true,
            events: events.filter((e: any) => e.localDate === dateStr),
        });
    }
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
        const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), i);
        const dateStr = formatDateLocal(d);
        const isToday = isMounted && dateStr === todayStr;
        const isPast = isMounted && dateStr < todayStr;
        days.push({
            day: i,
            date: dateStr,
            isToday,
            isPast,
            events: events.filter((e: any) => e.localDate === dateStr),
        });
    }
    
    const totalDays = days.length;
    const remainingDays = 42 - totalDays;
    for (let i = 1; i <= remainingDays; i++) {
        const d = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, i);
        const dateStr = formatDateLocal(d);
        days.push({
            day: i,
            date: dateStr,
            isOtherMonth: true,
            events: events.filter((e: any) => e.localDate === dateStr),
        });
    }

    const startOfWeek = new Date(targetDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDateLocal(d);
        const isToday = isMounted && dateStr === todayStr;
        const isPast = isMounted && dateStr < todayStr;
        weekDays.push({
            day: d.getDate(),
            date: dateStr,
            isToday,
            isPast,
            events: events.filter((e: any) => e.localDate === dateStr),
            month: d.toLocaleDateString("es-ES", { month: "short" }),
        });
    }

    return { dayNames, days, weekDays, monthLabel, targetDate };
};

export default function AvailabilityPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({
        title: "",
        type: "custom",
        date: "",
        time: "19:00",
        description: "",
        map: "",
    });
    const searchParams = useSearchParams();
    const initialView = searchParams.get("view") as "list" | "calendar" | "week" | null;
    const initialDateStr = searchParams.get("date");
    const initialDate = initialDateStr ? new Date(initialDateStr) : new Date();

    const [viewMode, setViewMode] = useState<"list" | "calendar" | "week" | null>(initialView);
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        if (!isMounted || !viewMode) return;
        const params = new URLSearchParams();
        params.set("view", viewMode);
        params.set("date", currentDate.toISOString().split('T')[0]);
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [viewMode, currentDate, isMounted, router]);

    const [now, setNow] = useState(new Date());
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
    const [scrollToEventId, setScrollToEventId] = useState<number | null>(null);
    const [updatingEventId, setUpdatingEventId] = useState<number | null>(null);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);
    const [activeHighlightId, setActiveHighlightId] = useState<number | null>(
        null,
    );
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [isEntryAnimationDone, setIsEntryAnimationDone] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [exportTab, setExportTab] = useState<"team" | "personal">("personal");
    const [origin, setOrigin] = useState("");

    const myPlayerId = (session?.user as any)?.playerId;
    const firstUpcomingRef = useRef<HTMLDivElement>(null);
    const eventRefsMap = useRef<Record<number, HTMLDivElement | null>>({});
    const weekScrollRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement | null>(null);
    const abortControllers = useRef<Record<number, AbortController>>({});
    const [upcomingScrollPosition, setUpcomingScrollPosition] = useState<
        "above" | "below" | "in-view"
    >("in-view");

    // 1. Queries for data
    const { data: playersData } = useQuery<{ players: Player[] }>({
        queryKey: ["players"],
        queryFn: async () => {
            const r = await fetch("/api/players");
            if (!r.ok) throw new Error("Error loading players");
            return r.json();
        },
    });
    const players = playersData?.players || [];

    const { data: mapsData } = useQuery<{ maps: any[] }>({
        queryKey: ["maps"],
        queryFn: async () => {
            const r = await fetch("/api/maps");
            if (!r.ok) throw new Error("Error loading maps");
            return r.json();
        },
    });
    const maps = mapsData?.maps || [];

    const { data: teamTokenData } = useQuery({
        queryKey: ["teamCalendarToken"],
        queryFn: async () => {
            const res = await fetch("/api/teams/calendar-token");
            return res.json();
        },
    });
    const calendarToken = teamTokenData?.token || null;

    const { data: userTokenData } = useQuery({
        queryKey: ["userCalendarToken"],
        queryFn: async () => {
            const res = await fetch("/api/users/calendar-token");
            return res.json();
        },
    });
    const userCalendarToken = userTokenData?.token || null;

    const dateBoundaries = useMemo(() => {
        let start = null;
        let end = null;
        if (viewMode === "calendar") {
            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
            
            start = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}-01`;
            end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-${String(nextMonth.getDate()).padStart(2,'0')}`;
        } else if (viewMode === "week") {
            const prevWeek = new Date(currentDate);
            prevWeek.setDate(currentDate.getDate() - 14);
            const nextWeek = new Date(currentDate);
            nextWeek.setDate(currentDate.getDate() + 14);
            
            start = `${prevWeek.getFullYear()}-${String(prevWeek.getMonth()+1).padStart(2,'0')}-${String(prevWeek.getDate()).padStart(2,'0')}`;
            end = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth()+1).padStart(2,'0')}-${String(nextWeek.getDate()).padStart(2,'0')}`;
        }
        return { start, end };
    }, [currentDate, viewMode]);

    const { data: calendarEventsData, isLoading: calendarEventsLoading, error: calendarError } = useQuery({
        queryKey: ["events", "calendar", dateBoundaries.start, dateBoundaries.end],
        queryFn: async () => {
            const params = new URLSearchParams({ view: viewMode || "calendar" });
            if (dateBoundaries.start) params.set("startDate", dateBoundaries.start);
            if (dateBoundaries.end) params.set("endDate", dateBoundaries.end);
            
            const res = await fetch(`/api/events?${params.toString()}`);
            if (res.status === 401) {
                window.location.href = "/login";
                return null;
            }
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || `Events API failed: ${res.status}`);
            return d;
        },
        enabled: (viewMode === "calendar" || viewMode === "week") && !!dateBoundaries.start
    });

    const { 
        data: listEventsData, 
        isLoading: listEventsLoading, 
        error: listError,
        fetchNextPage, 
        hasNextPage, 
        fetchPreviousPage, 
        hasPreviousPage,
        isFetchingNextPage,
        isFetchingPreviousPage
    } = useInfiniteQuery({
        queryKey: ["events", "list"],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ view: "list", limit: "15" });
            if (pageParam) {
                params.set("cursor", String(pageParam.cursor));
                params.set("direction", pageParam.direction);
            }
            const res = await fetch(`/api/events?${params.toString()}`);
            if (res.status === 401) {
                window.location.href = "/login";
                return null;
            }
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || `Events API failed: ${res.status}`);
            return d;
        },
        initialPageParam: null as { cursor: string, direction: string } | null,
        getNextPageParam: (lastPage) => lastPage?.nextCursor ? { cursor: lastPage.nextCursor, direction: "future" } : null,
        getPreviousPageParam: (firstPage) => firstPage?.prevCursor ? { cursor: firstPage.prevCursor, direction: "past" } : null,
        enabled: viewMode === "list" || viewMode === null,
    });

    const isListView = viewMode === "list" || viewMode === null;
    const eventsData = isListView
        ? { 
            events: listEventsData?.pages.flatMap(p => p?.events || []) || [], 
            seasons: listEventsData?.pages[0]?.seasons || [], 
            activeSeasonId: listEventsData?.pages[0]?.activeSeasonId || "" 
          }
        : { 
            events: calendarEventsData?.events || [], 
            seasons: calendarEventsData?.seasons || [], 
            activeSeasonId: calendarEventsData?.activeSeasonId || "" 
          };

    const isLoadingEvents = isListView ? listEventsLoading : calendarEventsLoading;
    const error = isListView ? (listError ? (listError as Error).message : null) : (calendarError ? (calendarError as Error).message : null);

    // Derived events formatting and availability map
    const { events, avail } = useMemo(() => {
        if (!eventsData?.events) return { events: [] as Ev[], avail: {} as Record<number, Avail[]> };

        const loadedEvents: Ev[] = (eventsData.events || []).map((ev: any) => {
            const utcDate = new Date(`${ev.date}T${ev.time}:00Z`);
            let localEndDate = undefined;
            let localEndTime = undefined;
            if (ev.end_date && ev.end_time) {
                const utcEnd = new Date(`${ev.end_date}T${ev.end_time}:00Z`);
                localEndDate = formatDateLocal(utcEnd);
                localEndTime = utcEnd.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                });
            }
            return {
                ...ev,
                localDate: formatDateLocal(utcDate),
                localTime: utcDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }),
                localEndDate,
                localEndTime,
            };
        });

        const availMap: Record<number, Avail[]> = {};
        loadedEvents.forEach((ev: any) => {
            availMap[ev.id] = (ev.availability || []).map((a: any) => ({
                player_id: a.player_id,
                player_name: a.player?.name || "Desconocido",
                status: a.status,
                avatar_color: a.player?.avatar_color || "#999",
            }));
        });

        return { events: loadedEvents, avail: availMap };
    }, [eventsData]);

    // 2. Mutations
    const createEventMutation = useMutation({
        mutationFn: async () => {
            const localDate = new Date(`${form.date}T${form.time}:00`);
            const utcDateStr = localDate.toISOString().split("T")[0];
            const utcTimeStr =
                localDate.getUTCHours().toString().padStart(2, "0") +
                ":" +
                localDate.getUTCMinutes().toString().padStart(2, "0");

            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    date: utcDateStr,
                    time: utcTimeStr,
                }),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Error al crear evento");
            }
            return res.json();
        },
        onSuccess: () => {
            setShowNew(false);
            setForm({
                title: "",
                type: "custom",
                date: "",
                time: "19:00",
                description: "",
                map: "",
            });
            queryClient.invalidateQueries({ queryKey: ["events"] });
        },
        onError: (err: any) => {
            alert(err.message);
        }
    });

    const createEvent = async () => {
        createEventMutation.mutate();
    };

    const setAvailabilityMutation = useMutation({
        mutationFn: async ({ eventId, status }: { eventId: number; status: string }) => {
            if (!myPlayerId) {
                throw new Error("No estás vinculado a ningún jugador. Contacta con tu administrador.");
            }
            
            if (abortControllers.current[eventId]) {
                abortControllers.current[eventId].abort();
            }
            const controller = new AbortController();
            abortControllers.current[eventId] = controller;

            const res = await fetch("/api/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_id: eventId,
                    player_id: myPlayerId,
                    status,
                }),
                signal: controller.signal
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Error al actualizar disponibilidad");
            }
            return res.json();
        },
        onMutate: async ({ eventId, status }) => {
            setUpdatingEventId(eventId);
            await queryClient.cancelQueries({ queryKey: ["events"] });
            const previousEvents = queryClient.getQueryData(["events"]);

            queryClient.setQueryData(["events"], (old: any) => {
                if (!old?.events) return old;
                return {
                    ...old,
                    events: old.events.map((ev: any) => {
                        if (ev.id === eventId) {
                            const newAvail = [...(ev.availability || [])];
                            const existingIdx = newAvail.findIndex((a: any) => a.player_id === myPlayerId);
                            if (existingIdx !== -1) {
                                newAvail[existingIdx] = { ...newAvail[existingIdx], status };
                            } else {
                                newAvail.push({ player_id: myPlayerId, status, player: { name: session?.user?.name || "Yo", avatar_color: "#E11D48" } });
                            }
                            return { ...ev, availability: newAvail };
                        }
                        return ev;
                    })
                };
            });

            return { previousEvents };
        },
        onSuccess: () => {
            setTimeout(() => setUpdatingEventId(null), 500);
        },
        onError: (err: any, variables, context: any) => {
            if (err.name === 'AbortError') return;
            
            if (context?.previousEvents) {
                queryClient.setQueryData(["events"], context.previousEvents);
            }
            alert(err.message);
            setUpdatingEventId(null);
        }
    });

    const setAvailability = async (eventId: number, status: string) => {
        setAvailabilityMutation.mutate({ eventId, status });
    };

    const deleteEventMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error deleting event");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["events"] });
        }
    });

    const deleteEvent = async (id: number) => {
        deleteEventMutation.mutate(id);
    };

    const regenerateTokenMutation = useMutation({
        mutationFn: async (type: "team" | "personal") => {
            const url = type === "team" ? "/api/teams/calendar-token" : "/api/users/calendar-token";
            const res = await fetch(url, { method: "POST" });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || "Error regenerating token");
            return d;
        },
        onSuccess: (data, type) => {
            if (type === "team") {
                queryClient.invalidateQueries({ queryKey: ["teamCalendarToken"] });
            } else {
                queryClient.invalidateQueries({ queryKey: ["userCalendarToken"] });
            }
        },
        onError: (err: any) => {
            console.error("Error regenerating token", err);
        }
    });

    const regenerateToken = async (type: "team" | "personal") => {
        if (!confirm("¿Estás seguro de que quieres regenerar el enlace? El anterior dejará de funcionar en todas las aplicaciones donde lo hayas configurado.")) return;
        regenerateTokenMutation.mutate(type);
    };

    const isRegenerating = regenerateTokenMutation.isPending;

    // Helper to get unique maps of the same season for playoffs
    const getSeasonMaps = (ev: Ev) => {
        if (!ev.premier_season_id) return [];
        // Get all events in the same season
        const seasonEvents = events.filter(
            (e) => e.premier_season_id === ev.premier_season_id,
        );
        // Get all map IDs from these events (unique ones)
        const mapIds = Array.from(
            new Set(seasonEvents.map((e) => e.map).filter(Boolean)),
        );
        // Get corresponding map objects
        return mapIds
            .map((id) => maps.find((m) => m.id === id))
            .filter(Boolean);
    };

    // Helper to render diagonal map collage
    const renderDiagonalMapSplash = (
        seasonMaps: any[],
        opacity: number = 0.5,
    ) => {
        if (!seasonMaps || seasonMaps.length === 0) return null;
        const X = seasonMaps.length;
        const skewOffset = Math.min(10, 50 / X);

        return (
            <div
                style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    pointerEvents: "none",
                    display: "flex",
                }}
            >
                {seasonMaps.map((map: any, i: number) => {
                    const T_left = i === 0 ? 0 : i * (100 / X) - skewOffset;
                    const T_right =
                        i === X - 1 ? 100 : (i + 1) * (100 / X) - skewOffset;
                    const B_left = i === 0 ? 0 : i * (100 / X) + skewOffset;
                    const B_right =
                        i === X - 1 ? 100 : (i + 1) * (100 / X) + skewOffset;

                    const clipPath = `polygon(${T_left}% 0%, ${T_right}% 0%, ${B_right}% 100%, ${B_left}% 100%)`;

                    return (
                        <div
                            key={map.id || i}
                            style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundImage: `url(${map.splash || map.premierBackground})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                clipPath: clipPath,
                                WebkitClipPath: clipPath,
                                opacity: opacity,
                                transition: "opacity 0.3s ease",
                            }}
                        />
                    );
                })}
            </div>
        );
    };

    useEffect(() => {
        setIsMounted(true);
        if (typeof globalThis !== "undefined" && (globalThis as any).window) {
            setOrigin((globalThis as any).window.location.origin);
        }

        const timer = setInterval(() => setNow(new Date()), 60000);
        const entryTimer = setTimeout(
            () => setIsEntryAnimationDone(true),
            1500,
        );
        return () => {
            clearInterval(timer);
            clearTimeout(entryTimer);
        };
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem("vhub_avail_view_mode");
        if (saved === "list" || saved === "calendar" || saved === "week") {
            setViewMode(saved as any);
        } else {
            setViewMode("calendar");
        }
    }, [isMounted]);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem(
                "vhub_avail_view_mode",
                viewMode || "calendar",
            );
        }
    }, [viewMode, isMounted]);

    useEffect(() => {
        if (
            viewMode === "list" &&
            isMounted &&
            events.length > 0 &&
            players.length > 0
        ) {
            // Prioridad 1: scroll a evento específico (clic desde calendario)
            if (scrollToEventId !== null) {
                setTimeout(() => {
                    const targetEl = eventRefsMap.current[scrollToEventId];
                    if (targetEl) {
                        targetEl.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                    }
                    setScrollToEventId(null);
                }, 300);
                return;
            }
            // Prioridad 2: scroll inicial al primer evento próximo
            if (firstUpcomingRef.current && !hasInitialScrolled) {
                setTimeout(() => {
                    if (!scrollToEventId && firstUpcomingRef.current) {
                        firstUpcomingRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                    }
                    setHasInitialScrolled(true);
                }, 300);
            }
        }
    }, [
        viewMode,
        isMounted,
        events,
        hasInitialScrolled,
        scrollToEventId,
        players,
        avail,
    ]);

    const todayStr = formatDateLocal(new Date());

    const firstUpcomingId = useMemo(() => {
        if (!isMounted || events.length === 0) return null;
        const idx = events.findIndex((e) => {
            const pIsPast = isMounted && (e as any).localDate < todayStr;
            const pIsCancelled = e.status === "cancelled";
            const pEA = avail[e.id] || [];
            const pUnavailable = pEA.filter(
                (a) => a.status === "unavailable",
            ).length;
            const pIsImpossible =
                isMounted &&
                !pIsPast &&
                players.length >= 5 &&
                players.length - pUnavailable < 5;
            return (
                isMounted &&
                !pIsPast &&
                !pIsCancelled &&
                !pIsImpossible &&
                e.status === "scheduled"
            );
        });
        return idx !== -1 ? events[idx].id : null;
    }, [events, avail, isMounted, players, todayStr]);

    const checkUpcomingScrollPosition = useCallback(() => {
        if (!listContainerRef.current) return;
        const container = listContainerRef.current;
        
        // --- Infinite Scroll Logic ---
        if ((viewMode === "list" || viewMode === null) && hasInitialScrolled) {
            const scrollThreshold = 300; // Trigger earlier for smoother experience
            
            // Bottom Check (Future Events)
            if (
                container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold &&
                hasNextPage &&
                !isFetchingNextPage
            ) {
                fetchNextPage();
            }
            
            // Top Check (Past Events)
            if (
                container.scrollTop < scrollThreshold &&
                hasPreviousPage &&
                !isFetchingPreviousPage
            ) {
                fetchPreviousPage();
            }
        }
        // -----------------------------

        if (!firstUpcomingId) return;
        const card = eventRefsMap.current[firstUpcomingId];
        if (!card) return;

        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        if (cardRect.bottom < containerRect.top + 10) {
            setUpcomingScrollPosition("above");
        } else if (cardRect.top > containerRect.bottom - 10) {
            setUpcomingScrollPosition("below");
        } else {
            setUpcomingScrollPosition("in-view");
        }
    }, [firstUpcomingId, viewMode, hasInitialScrolled, hasNextPage, isFetchingNextPage, fetchNextPage, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

    useEffect(() => {
        if (viewMode === "list") {
            const timer = setTimeout(() => {
                checkUpcomingScrollPosition();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [viewMode, firstUpcomingId, checkUpcomingScrollPosition]);

    const canManage =
        (session?.user as any)?.role === "team_admin" ||
        (session?.user as any)?.role === "super_admin";

    
    const [dragOffset, setDragOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const carouselData = useMemo(() => {
        if (viewMode === "calendar") {
            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            return [
                getCalendarData(prevMonth, events, isMounted),
                getCalendarData(currentDate, events, isMounted),
                getCalendarData(nextMonth, events, isMounted),
            ];
        } else if (viewMode === "week") {
            const prevWeek = new Date(currentDate);
            prevWeek.setDate(currentDate.getDate() - 7);
            const nextWeek = new Date(currentDate);
            nextWeek.setDate(currentDate.getDate() + 7);
            return [
                getCalendarData(prevWeek, events, isMounted),
                getCalendarData(currentDate, events, isMounted),
                getCalendarData(nextWeek, events, isMounted),
            ];
        }
        return [getCalendarData(currentDate, events, isMounted)];
    }, [currentDate, events, isMounted, viewMode]);

    const { dayNames, days, weekDays, monthLabel } = carouselData[1] || carouselData[0] || getCalendarData(currentDate, events, isMounted);


    useEffect(() => {
        if (viewMode === "week" && weekScrollRef.current) {
            const allEvents = weekDays.flatMap((d) => d.events);
            let targetMinutes = 16 * 60; // Por defecto 4 PM

            if (allEvents.length > 0) {
                const totalMinutes = allEvents.reduce(
                    (acc: number, ev: any) => {
                        const [h, m] = ev.localTime.split(":").map(Number);
                        return acc + (h * 60 + m);
                    },
                    0,
                );
                targetMinutes = totalMinutes / allEvents.length;
            }

            const containerHeight = weekScrollRef.current.clientHeight || 600;
            weekScrollRef.current.scrollTop =
                targetMinutes - containerHeight / 2;
        }
    }, [viewMode, weekDays]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };

    

    
    const handleTouchEnd = () => {
        if (touchStartX === null || touchEndX === null) return;
        const distance = touchStartX - touchEndX;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;
        
        setTouchStartX(null);
        setTouchEndX(null);
        setDragOffset(0);

        if (isLeftSwipe || isRightSwipe) {
            setIsAnimating(true);
            setDragOffset(isLeftSwipe ? -window.innerWidth : window.innerWidth);
            
            setTimeout(() => {
                setIsAnimating(false);
                setDragOffset(0);
                changeDate(isLeftSwipe ? 1 : -1);
            }, 300);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const currentX = e.targetTouches[0].clientX;
        setTouchEndX(currentX);
        setDragOffset(currentX - touchStartX);
    };


    const changeDate = (offset: number) => {
        if (viewMode === "calendar") {
            setCurrentDate(
                new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + offset,
                    1,
                ),
            );
        } else if (viewMode === "week") {
            const newDate = new Date(currentDate);
            newDate.setDate(currentDate.getDate() + offset * 7);
            setCurrentDate(newDate);
        }
    };

    return (
        <div
            className="availability-wrapper"
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: 0,
                minWidth: 0,
                height: "100%",
            }}
        >
            <div
                className="page-header hero-gradient"
                style={{
                    borderBottom: "none",
                    background: "transparent",
                    padding: "24px",
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    <div>
                        <h1
                            className="gradient-text"
                            style={{ fontSize: 32, fontWeight: 800 }}
                        >
                            Agenda y Disponibilidad
                        </h1>
                        <p style={{ fontSize: 14, marginTop: 4 }}>
                            Planifica tus sesiones y confirma tu asistencia
                        </p>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
                            <div
                            className="glass-card"
                            style={{
                                display: "flex",
                                padding: 4,
                                borderRadius: 10,
                            }}
                        >
                            <button
                                className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => {
                                    setViewMode("list");
                                    setHasInitialScrolled(false);
                                }}
                                style={{ borderRadius: 8 }}
                            >
                                📋 Lista
                            </button>
                            <button
                                className={`btn btn-sm ${viewMode === "week" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => {
                                    setViewMode("week");
                                    setHasInitialScrolled(false);
                                    setCurrentDate(new Date());
                                }}
                                style={{ borderRadius: 8 }}
                            >
                                📅 Semana
                            </button>
                            <button
                                className={`btn btn-sm ${viewMode === "calendar" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => {
                                    setViewMode("calendar");
                                    setHasInitialScrolled(false);
                                    setCurrentDate(new Date());
                                }}
                                style={{ borderRadius: 8 }}
                            >
                                📅 Mes
                            </button>
                        </div>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowExport(true)}
                            title="Exportar a Google Calendar, Apple, etc."
                        >
                            🔗 Exportar
                        </button>
                    </div>
                    {canManage && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowNew(true)}
                            >
                                + Nuevo Evento
                            </button>
                        )}
                    </div>
                </div>
            </div>



            <div
                className="page-content animate-in"
                style={{
                    padding: viewMode === "list" ? "0 24px" : 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    minWidth: 0,
                    overflow: "hidden",
                    height: "100%",
                }}
            >
                {error && (
                    <div
                        className="card"
                        style={{
                            background: "rgba(133, 107, 77, 0.1)",
                            border: "1px solid var(--val-red)",
                            color: "var(--val-red)",
                            marginBottom: 20,
                            padding: 12,
                            borderRadius: 8,
                            flexShrink: 0,
                        }}
                    >
                        ⚠️ {error}
                    </div>
                )}

                {viewMode === null ? (
                    <div className="animate-fade-in">
                        <div
                            className="card glass-card"
                            style={{ padding: 0, overflow: "hidden" }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: 20,
                                    borderBottom:
                                        "1px solid var(--border-color)",
                                }}
                            >
                                <Skeleton width={150} height={24} />
                                <div style={{ display: "flex", gap: 8 }}>
                                    <Skeleton width={32} height={32} />
                                    <Skeleton width={48} height={32} />
                                    <Skeleton width={32} height={32} />
                                </div>
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, 1fr)",
                                }}
                            >
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: "12px 0",
                                            display: "flex",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Skeleton width={30} height={12} />
                                    </div>
                                ))}
                                {Array.from({ length: 28 }).map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            height: 120,
                                            padding: 10,
                                            borderRight:
                                                "1px solid var(--border-color)",
                                            borderBottom:
                                                "1px solid var(--border-color)",
                                        }}
                                    >
                                        <Skeleton width={20} height={20} />
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 4,
                                                marginTop: 8,
                                            }}
                                        >
                                            {i % 3 === 0 && (
                                                <Skeleton
                                                    width="80%"
                                                    height={16}
                                                />
                                            )}
                                            {i % 5 === 0 && (
                                                <Skeleton
                                                    width="60%"
                                                    height={16}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : viewMode === "calendar" || viewMode === "week" ? (
                    (() => {
                        const weekMap =
                            viewMode === "week"
                                ? weekDays
                                    .flatMap((d) => d.events)
                                    .find((e) => e.map_obj)?.map_obj
                                : null;

                        return (
                            <div
                                className="card glass-card"
                                style={{
                                    padding: 0,
                                    overflow: "hidden",
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    minHeight: 0,
                                    minWidth: 0,
                                    height: "100%",
                                    maxHeight: "100%",
                                    marginBottom: 0,
                                    position: "relative",
                                    background: "#0a0b14",
                                    borderRadius: 0,
                                    border: "none",
                                    borderTop: "1px solid var(--border-color)",
                                }}
                            >
                                {weekMap && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundImage: `url(${weekMap.premierBackground})`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                            backgroundRepeat: "no-repeat",
                                            opacity: 0.15,
                                            zIndex: 0,
                                            pointerEvents: "none",
                                        }}
                                    />
                                )}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: 20,
                                        borderBottom:
                                            "1px solid var(--border-color)",
                                        flexShrink: 0,
                                        zIndex: 1,
                                        position: "relative",
                                        background: "rgba(10, 11, 20, 0.5)",
                                        backdropFilter: "blur(4px)",
                                    }}
                                >
                                    <h3
                                        style={{
                                            fontSize: 18,
                                            fontWeight: 700,
                                            textTransform: "capitalize",
                                        }}
                                    >
                                        {viewMode === "calendar"
                                            ? monthLabel
                                            : `Semana del ${weekDays[0]?.day} de ${weekDays[0]?.month}`}
                                    </h3>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {firstUpcomingId &&
                                            (() => {
                                                const upcomingEv = events.find(
                                                    (e) =>
                                                        e.id ===
                                                        firstUpcomingId,
                                                );
                                                if (!upcomingEv) return null;
                                                return (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            if (
                                                                upcomingEv.date
                                                            ) {
                                                                setCurrentDate(
                                                                    new Date(
                                                                        `${upcomingEv.date}T00:00:00`,
                                                                    ),
                                                                );
                                                                setActiveHighlightId(
                                                                    firstUpcomingId,
                                                                );
                                                                setTimeout(
                                                                    () => {
                                                                        setActiveHighlightId(
                                                                            null,
                                                                        );
                                                                    },
                                                                    1200,
                                                                );
                                                            }
                                                        }}
                                                        style={{
                                                            color: "var(--val-cyan)",
                                                            fontWeight: 800,
                                                        }}
                                                    >
                                                        Próximo
                                                    </button>
                                                );
                                            })()}
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => changeDate(-1)}
                                        >
                                            ◀
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() =>
                                                setCurrentDate(new Date())
                                            }
                                        >
                                            Hoy
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => changeDate(1)}
                                        >
                                            ▶
                                        </button>
                                    </div>
                                </div>
                                <div
                                    className="calendar-grid-container"
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    style={{
                                        flex: 1,
                                        overflowY: "auto",
                                        minHeight: 0,
                                        height: "100%",
                                    }}
                                >
                                    {viewMode === "calendar" ? (
                                        <div
                                            className="calendar-grid"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "repeat(7, minmax(0, 1fr))",
                                                background:
                                                    "rgba(255,255,255,0.01)",
                                                gap: 0,
                                                padding: 0,
                                                flex: 1,
                                                minWidth: 0,
                                                height: "100%",
                                            }}
                                        >
                                            {dayNames.map((name) => (
                                                <div
                                                    key={name}
                                                    style={{
                                                        padding: "12px 0",
                                                        textAlign: "center",
                                                        fontSize: 11,
                                                        fontWeight: 800,
                                                        color: "var(--text-muted)",
                                                        borderBottom:
                                                            "1px solid var(--border-color)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    {name}
                                                </div>
                                            ))}
                                            {days.map((d, i) => (
                                                <div
                                                    key={i}
                                                    className={`animate-scale-in calendar-cell-padding`}
                                                    style={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        minHeight: 80,
                                                        borderRight:
                                                            "1px solid var(--border-color)",
                                                        borderBottom:
                                                            "1px solid var(--border-color)",
                                                        background: d.isOtherMonth
                                                            ? "rgba(0,0,0,0.2)"
                                                            : d.isToday
                                                                ? "rgba(133, 107, 77, 0.06)"
                                                                : d.isPast
                                                                    ? "rgba(0,0,0,0.4)"
                                                                    : "transparent",
                                                        position: "relative",
                                                        opacity: d.isOtherMonth
                                                            ? 0.15
                                                            : d.isPast
                                                                ? 0.25
                                                                : 1,
                                                        filter: d.isOtherMonth || d.isPast
                                                            ? "grayscale(0.8) contrast(0.8)"
                                                            : "none",
                                                        animationDelay: `${(i % 7) * 0.05}s`,
                                                        boxShadow: d.isToday
                                                            ? "inset 0 0 20px rgba(133, 107, 77, 0.1)"
                                                            : "none",
                                                        zIndex: d.isToday
                                                            ? 2
                                                            : 1,
                                                    }}
                                                >
                                                    <>
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
                                                                <span
                                                                    className="calendar-day-number"
                                                                    style={{
                                                                        fontWeight:
                                                                            d.isToday
                                                                                ? 800
                                                                                : 500,
                                                                        color: d.isToday
                                                                            ? "white"
                                                                            : d.isOtherMonth
                                                                                ? "rgba(255, 255, 255, 0.1)"
                                                                                : d.isPast
                                                                                    ? "var(--text-muted)"
                                                                                    : "var(--text-primary)",
                                                                        background:
                                                                            d.isToday
                                                                                ? "var(--val-red)"
                                                                                : "transparent",
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        boxShadow:
                                                                            d.isToday
                                                                                ? "0 0 10px var(--val-red-glow)"
                                                                                : "none",
                                                                    }}
                                                                >
                                                                    {d.day}
                                                                </span>
                                                                {d.isToday && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: 8,
                                                                            fontWeight: 900,
                                                                            color: "var(--val-red)",
                                                                            letterSpacing: 1,
                                                                            textTransform:
                                                                                "uppercase",
                                                                        }}
                                                                    >
                                                                        Hoy
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    flexDirection:
                                                                        "column",
                                                                    gap: 4,
                                                                    marginTop: 2,
                                                                    minWidth: 0,
                                                                }}
                                                            >
                                                                {isLoadingEvents
                                                                    ? (() => {
                                                                        const hash =
                                                                            (i *
                                                                                43 +
                                                                                d.day *
                                                                                17) %
                                                                            12;
                                                                        if (
                                                                            hash <
                                                                            3
                                                                        ) {
                                                                            return null;
                                                                        } else if (
                                                                            hash <
                                                                            7
                                                                        ) {
                                                                            const width =
                                                                                70 +
                                                                                ((hash *
                                                                                    7) %
                                                                                    31);
                                                                            return (
                                                                                <Skeleton
                                                                                    width={`${width}%`}
                                                                                    height={
                                                                                        16
                                                                                    }
                                                                                    style={{
                                                                                        borderRadius: 4,
                                                                                    }}
                                                                                />
                                                                            );
                                                                        } else if (
                                                                            hash <
                                                                            10
                                                                        ) {
                                                                            const w1 =
                                                                                80 +
                                                                                ((hash *
                                                                                    3) %
                                                                                    21);
                                                                            const w2 =
                                                                                60 +
                                                                                ((hash *
                                                                                    9) %
                                                                                    21);
                                                                            return (
                                                                                <>
                                                                                    <Skeleton
                                                                                        width={`${w1}%`}
                                                                                        height={
                                                                                            16
                                                                                        }
                                                                                        style={{
                                                                                            borderRadius: 4,
                                                                                        }}
                                                                                    />
                                                                                    <Skeleton
                                                                                        width={`${w2}%`}
                                                                                        height={
                                                                                            16
                                                                                        }
                                                                                        style={{
                                                                                            borderRadius: 4,
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            );
                                                                        } else {
                                                                            const w1 =
                                                                                90 +
                                                                                ((hash *
                                                                                    2) %
                                                                                    11);
                                                                            const w2 =
                                                                                75 +
                                                                                ((hash *
                                                                                    5) %
                                                                                    16);
                                                                            const w3 =
                                                                                50 +
                                                                                ((hash *
                                                                                    8) %
                                                                                    21);
                                                                            return (
                                                                                <>
                                                                                    <Skeleton
                                                                                        width={`${w1}%`}
                                                                                        height={
                                                                                            16
                                                                                        }
                                                                                        style={{
                                                                                            borderRadius: 4,
                                                                                        }}
                                                                                    />
                                                                                    <Skeleton
                                                                                        width={`${w2}%`}
                                                                                        height={
                                                                                            16
                                                                                        }
                                                                                        style={{
                                                                                            borderRadius: 4,
                                                                                        }}
                                                                                    />
                                                                                    <Skeleton
                                                                                        width={`${w3}%`}
                                                                                        height={
                                                                                            16
                                                                                        }
                                                                                        style={{
                                                                                            borderRadius: 4,
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            );
                                                                        }
                                                                    })()
                                                                    : d.events.map(
                                                                        (
                                                                            ev: any,
                                                                        ) => {
                                                                            const ea =
                                                                                avail[
                                                                                ev
                                                                                    .id
                                                                                ] ||
                                                                                [];
                                                                            const confirmedCount = ea.filter((a: any) => a.status === "available" || a.status === "played").length;
                                                                            const myStatus =
                                                                                ea.find(
                                                                                    (
                                                                                        a,
                                                                                    ) =>
                                                                                        String(
                                                                                            a.player_id,
                                                                                        ) ===
                                                                                        String(
                                                                                            myPlayerId,
                                                                                        ),
                                                                                )
                                                                                    ?.status ||
                                                                                "pending";
                                                                            const isCancelled =
                                                                                ev.status ===
                                                                                "cancelled";
                                                                            const isNoPlayers =
                                                                                ev.status ===
                                                                                "no_players";
                                                                            const isNotPlayed =
                                                                                ev.status ===
                                                                                "not_played";

                                                                            const unavailable =
                                                                                ea.filter(
                                                                                    (
                                                                                        a,
                                                                                    ) =>
                                                                                        a.status ===
                                                                                        "unavailable",
                                                                                ).length;
                                                                            const isImpossible =
                                                                                isMounted &&
                                                                                (
                                                                                    ev as any
                                                                                )
                                                                                    .localDate >=
                                                                                todayStr &&
                                                                                players.length >=
                                                                                5 &&
                                                                                players.length -
                                                                                unavailable <
                                                                                5;

                                                                            const isRed =
                                                                                isCancelled ||
                                                                                isNoPlayers ||
                                                                                isNotPlayed ||
                                                                                isImpossible;
                                                                            const color =
                                                                                ev.type ===
                                                                                    "playoffs"
                                                                                    ? "var(--val-yellow)"
                                                                                    : ev.type ===
                                                                                        "match"
                                                                                        ? "var(--val-match)"
                                                                                        : "var(--val-practice)";
                                                                            const evColorDark =
                                                                                ev.type ===
                                                                                    "playoffs"
                                                                                    ? "var(--val-yellow-dark)"
                                                                                    : ev.type ===
                                                                                        "match"
                                                                                        ? "#5c4a35"
                                                                                        : "#808080";
                                                                            const isFirstUpcoming =
                                                                                ev.id ===
                                                                                firstUpcomingId;

                                                                            const hoverBorderColor =
                                                                                myStatus ===
                                                                                    "available"
                                                                                    ? ev.type ===
                                                                                        "match"
                                                                                        ? "rgba(255, 255, 255, 0.65)"
                                                                                        : evColorDark
                                                                                    : color;

                                                                            const hoverSheenActive =
                                                                                myStatus ===
                                                                                    "available"
                                                                                    ? ev.type ===
                                                                                        "match"
                                                                                        ? "rgba(255, 255, 255, 0.15)"
                                                                                        : "rgba(0, 0, 0, 0.12)"
                                                                                    : "rgba(255, 255, 255, 0.12)";

                                                                            const hoverInsetShadow =
                                                                                myStatus ===
                                                                                    "available"
                                                                                    ? ev.type ===
                                                                                        "match"
                                                                                        ? "inset 0 0 4px rgba(255, 255, 255, 0.35)"
                                                                                        : "inset 0 0 4px rgba(0, 0, 0, 0.15)"
                                                                                    : `inset 0 0 5px ${color}`;

                                                                            return (
                                                                                <div
                                                                                    key={
                                                                                        ev.id
                                                                                    }
                                                                                    onClick={() =>
                                                                                        setSelectedEventId(
                                                                                            ev.id,
                                                                                        )
                                                                                    }
                                                                                    className={`calendar-event-hover calendar-event-text ${ev.id === activeHighlightId ? "upcoming-highlight-mini" : ""}`}
                                                                                    style={{
                                                                                        padding:
                                                                                            "4px 6px",
                                                                                        borderRadius: 4,
                                                                                        minWidth: 0,
                                                                                        background:
                                                                                            isRed
                                                                                                ? "transparent"
                                                                                                : myStatus ===
                                                                                                    "unavailable"
                                                                                                    ? "transparent"
                                                                                                    : myStatus ===
                                                                                                        "pending"
                                                                                                        ? "transparent"
                                                                                                        : ev.status ===
                                                                                                            "completed" ||
                                                                                                            (ev.linkedMatches &&
                                                                                                                ev
                                                                                                                    .linkedMatches
                                                                                                                    .length >
                                                                                                                0)
                                                                                                            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='140 -100 720 630' fill='none' stroke='rgba%28255,255,255,0.22%29' stroke-width='25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M 245.44 4.65 C 248.61 2.76 250.63 6.58 252.34 8.59 C 362.37 146.24 472.53 283.79 582.55 421.44 C 584.81 423.40 583.10 427.59 580.05 427.14 C 527.37 427.20 474.68 427.16 422.00 427.16 C 417.78 427.21 413.74 425.11 411.15 421.82 C 356.49 353.53 301.86 285.21 247.20 216.91 C 244.88 214.15 243.68 210.58 243.83 206.99 C 243.83 141.01 243.85 75.02 243.81 9.04 C 243.84 7.48 243.78 5.46 245.44 4.65 Z'/%3E%3Cpath d='M 754.32 4.33 C 756.57 3.48 759.05 5.56 758.72 7.92 C 758.80 73.93 758.71 139.94 758.76 205.95 C 758.91 209.69 758.09 213.56 755.66 216.50 C 739.05 237.28 722.42 258.05 705.81 278.82 C 703.04 282.42 698.51 284.41 693.98 284.18 C 641.65 284.13 589.31 284.21 536.98 284.14 C 533.89 284.62 532.13 280.45 534.41 278.44 C 606.98 187.65 679.61 96.89 752.22 6.12 C 752.77 5.34 753.47 4.74 754.32 4.33 Z'/%3E%3C/svg%3E") repeat, ${color}`
                                                                                                            : myStatus === "maybe" || (myStatus === "available" && confirmedCount < 5)
                                                                                                                ? `repeating-linear-gradient(45deg, ${color}, ${color} 6px, ${evColorDark} 6px, ${evColorDark} 12px)`
                                                                                                                : color,
                                                                                        color:
                                                                                            isRed ||
                                                                                                myStatus ===
                                                                                                "unavailable" ||
                                                                                                myStatus ===
                                                                                                "pending"
                                                                                                ? color
                                                                                                : "white",
                                                                                        fontWeight: 700,
                                                                                        display: "flex",
                                                                                        flexWrap: "wrap",
                                                                                        alignItems: "center",
                                                                                        whiteSpace: "normal",
                                                                                        overflow: "visible",
                                                                                        textOverflow: "clip",
                                                                                        wordBreak: "break-word",
                                                                                        cursor: "pointer",
                                                                                        textDecoration:
                                                                                            isCancelled ||
                                                                                                isNoPlayers ||
                                                                                                isNotPlayed ||
                                                                                                isImpossible ||
                                                                                                myStatus ===
                                                                                                "unavailable"
                                                                                                ? "line-through"
                                                                                                : "none",
                                                                                        opacity:
                                                                                            isCancelled ||
                                                                                                isNoPlayers ||
                                                                                                isNotPlayed ||
                                                                                                isImpossible
                                                                                                ? 0.4
                                                                                                : myStatus ===
                                                                                                    "unavailable"
                                                                                                    ? 0.85
                                                                                                    : 1,
                                                                                        border:
                                                                                            isRed ||
                                                                                                myStatus ===
                                                                                                "unavailable"
                                                                                                ? `1px solid ${color}`
                                                                                                : myStatus ===
                                                                                                    "pending"
                                                                                                    ? `1px dashed ${color}`
                                                                                                    : "1px solid rgba(255,255,255,0.1)",
                                                                                        boxShadow:
                                                                                            isFirstUpcoming
                                                                                                ? `0 0 10px ${ev.type === "match" ? "rgba(133, 107, 77, 0.4)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.4)" : "rgba(184, 184, 184, 0.4)"}`
                                                                                                : "none",
                                                                                        zIndex: isFirstUpcoming
                                                                                            ? 5
                                                                                            : undefined,
                                                                                        ["--hover-border-color" as any]:
                                                                                            hoverBorderColor,
                                                                                        ["--hover-sheen-active" as any]:
                                                                                            hoverSheenActive,
                                                                                        ["--hover-inset-shadow" as any]:
                                                                                            hoverInsetShadow,
                                                                                        ["--hover-color" as any]:
                                                                                            color,
                                                                                        ["--ev-color" as any]: color,
                                                                                    }}
                                                                                    title={`${ev.localTime} - ${getEventDisplayName(ev)} (${myStatus === "pending" ? "Pendiente" : ev.status})`}
                                                                                >
                                                                                    {isFirstUpcoming && (
                                                                                        <div
                                                                                            style={{
                                                                                                marginRight: 4,
                                                                                                marginBottom: 0,
                                                                                                width: "fit-content",
                                                                                                maxWidth: "100%",
                                                                                                whiteSpace: "nowrap",
                                                                                                overflow: "hidden",
                                                                                                textOverflow: "ellipsis",
                                                                                                background:
                                                                                                    ev.type ===
                                                                                                        "match"
                                                                                                        ? "var(--val-match)"
                                                                                                        : ev.type ===
                                                                                                            "playoffs"
                                                                                                            ? "var(--val-yellow)"
                                                                                                            : "var(--val-practice)",
                                                                                                color:
                                                                                                    ev.type ===
                                                                                                        "playoffs"
                                                                                                        ? "black"
                                                                                                        : "white",
                                                                                                padding:
                                                                                                    "1px 3px",
                                                                                                borderRadius: 3,
                                                                                                fontSize: 7,
                                                                                                fontWeight: 900,
                                                                                                boxShadow:
                                                                                                    "0 0 8px rgba(255,255,255,0.2)",
                                                                                            }}
                                                                                        >
                                                                                            PRÓXIMO
                                                                                        </div>
                                                                                    )}
                                                                                    <span className="mobile-hidden" style={{ marginRight: 4 }}>
                                                                                        {ev.localTime}
                                                                                    </span>
                                                                                    <span>
                                                                                        {getEventDisplayName(
                                                                                            ev,
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        },
                                                                    )}
                                                            </div>
                                                        </>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            className="week-view"
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                flex: 1,
                                                minHeight: 0,
                                                minWidth: 0,
                                                position: "relative",
                                                background: "transparent",
                                            }}
                                        >
                                            <div
                                                ref={weekScrollRef}
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    flex: 1,
                                                    overflowY: "scroll",
                                                    position: "relative",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position: "sticky",
                                                        top: 0,
                                                        zIndex: 30,
                                                        display: "grid",
                                                        gridTemplateColumns:
                                                            "60px repeat(7, minmax(0, 1fr))",
                                                        borderBottom:
                                                            "1px solid var(--border-color)",
                                                        background: "#0a0b14",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            borderRight:
                                                                "1px solid var(--border-color)",
                                                        }}
                                                    />
                                                    {weekDays.map(
                                                        (
                                                            d: any,
                                                            idx: number,
                                                        ) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    padding:
                                                                        "12px 8px",
                                                                    textAlign:
                                                                        "center",
                                                                    borderRight:
                                                                        idx < 6
                                                                            ? "1px solid var(--border-color)"
                                                                            : "none",
                                                                    minWidth: 0,
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        fontSize: 10,
                                                                        fontWeight: 800,
                                                                        color: "var(--text-muted)",
                                                                        textTransform:
                                                                            "uppercase",
                                                                        marginBottom: 4,
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {
                                                                        dayNames[
                                                                        idx
                                                                        ]
                                                                    }
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        fontSize: 16,
                                                                        fontWeight: 800,
                                                                        color: d.isToday
                                                                            ? "var(--val-red)"
                                                                            : "white",
                                                                        display:
                                                                            "inline-block",
                                                                        padding:
                                                                            "2px 8px",
                                                                        borderRadius: 6,
                                                                        background:
                                                                            d.isToday
                                                                                ? "rgba(133, 107, 77, 0.1)"
                                                                                : "transparent",
                                                                    }}
                                                                >
                                                                    {d.day}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flex: 1,
                                                        position: "relative",
                                                    }}
                                                >
                                                    {/* Time Column */}
                                                    <div
                                                        style={{
                                                            width: 60,
                                                            flexShrink: 0,
                                                            borderRight:
                                                                "1px solid var(--border-color)",
                                                            background:
                                                                "rgba(0,0,0,0.2)",
                                                        }}
                                                    >
                                                        {Array.from({
                                                            length: 24,
                                                        }).map((_, i) => {
                                                            const hour = i;
                                                            return (
                                                                <div
                                                                    key={hour}
                                                                    style={{
                                                                        height: 60,
                                                                        padding:
                                                                            "4px 8px",
                                                                        fontSize: 10,
                                                                        color: "var(--text-muted)",
                                                                        fontWeight: 700,
                                                                        borderBottom:
                                                                            "1px solid rgba(255,255,255,0.02)",
                                                                    }}
                                                                >
                                                                    {hour
                                                                        .toString()
                                                                        .padStart(
                                                                            2,
                                                                            "0",
                                                                        )}
                                                                    :00
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Day Columns */}
                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns:
                                                                "repeat(7, minmax(0, 1fr))",
                                                            flex: 1,
                                                            position:
                                                                "relative",
                                                        }}
                                                    >
                                                        {weekDays.map(
                                                            (
                                                                d: any,
                                                                idx: number,
                                                            ) => (
                                                                <div
                                                                    key={idx}
                                                                    className="animate-scale-in"
                                                                    style={{
                                                                        position:
                                                                            "relative",
                                                                        minWidth: 0,
                                                                        borderRight:
                                                                            idx <
                                                                                6
                                                                                ? "1px solid var(--border-color)"
                                                                                : "none",
                                                                        background:
                                                                            d.isToday
                                                                                ? "rgba(133, 107, 77, 0.02)"
                                                                                : d.isPast
                                                                                    ? "rgba(0,0,0,0.4)"
                                                                                    : "transparent",
                                                                        opacity:
                                                                            d.isPast
                                                                                ? 0.25
                                                                                : 1,
                                                                        filter: d.isPast
                                                                            ? "grayscale(0.8) contrast(0.8)"
                                                                            : "none",
                                                                        animationDelay: `${idx * 0.05}s`,
                                                                    }}
                                                                >
                                                                    {/* Grid Lines */}
                                                                    {Array.from(
                                                                        {
                                                                            length: 24,
                                                                        },
                                                                    ).map(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    i
                                                                                }
                                                                                style={{
                                                                                    height: 60,
                                                                                    borderBottom:
                                                                                        "1px solid rgba(255,255,255,0.03)",
                                                                                }}
                                                                            />
                                                                        ),
                                                                    )}

                                                                    {/* Shading overlay for hours in the past today */}
                                                                    {d.isToday && (
                                                                        <div
                                                                            style={{
                                                                                position:
                                                                                    "absolute",
                                                                                top: 0,
                                                                                left: 0,
                                                                                right: 0,
                                                                                height:
                                                                                    now.getHours() *
                                                                                    60 +
                                                                                    now.getMinutes(),
                                                                                background:
                                                                                    "rgba(0,0,0,0.4)",
                                                                                opacity: 0.75,
                                                                                backdropFilter:
                                                                                    "grayscale(0.8) contrast(0.8)",
                                                                                WebkitBackdropFilter:
                                                                                    "grayscale(0.8) contrast(0.8)",
                                                                                pointerEvents:
                                                                                    "none",
                                                                                zIndex: 15,
                                                                            }}
                                                                        />
                                                                    )}

                                                                    {/* Current Time Indicator */}
                                                                    {d.isToday && (
                                                                        <div
                                                                            style={{
                                                                                position:
                                                                                    "absolute",
                                                                                top:
                                                                                    now.getHours() *
                                                                                    60 +
                                                                                    now.getMinutes(),
                                                                                left: 0,
                                                                                right: 0,
                                                                                height: 2,
                                                                                background:
                                                                                    "var(--val-red)",
                                                                                zIndex: 20,
                                                                                pointerEvents:
                                                                                    "none",
                                                                                boxShadow:
                                                                                    "0 0 10px var(--val-red-glow)",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    position:
                                                                                        "absolute",
                                                                                    left: -4,
                                                                                    top: -3,
                                                                                    width: 8,
                                                                                    height: 8,
                                                                                    borderRadius:
                                                                                        "50%",
                                                                                    background:
                                                                                        "var(--val-red)",
                                                                                    boxShadow:
                                                                                        "0 0 15px var(--val-red-glow)",
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {/* Events */}
                                                                    {isLoadingEvents
                                                                        ? (() => {
                                                                            const skeletons =
                                                                                [];
                                                                            // Organically calculate quantity of skeletons: 1, 2, or 3 per column
                                                                            const numEvents =
                                                                                ((idx *
                                                                                    11 +
                                                                                    17) %
                                                                                    3) +
                                                                                1;

                                                                            for (
                                                                                let s = 0;
                                                                                s <
                                                                                numEvents;
                                                                                s++
                                                                            ) {
                                                                                // Event start hours completely dispersed using non-overlapping slots:
                                                                                // s=0 (Morning: 9:00 - 12:00)
                                                                                // s=1 (Afternoon: 14:00 - 17:00)
                                                                                // s=2 (Evening/Night: 19:00 - 22:00)
                                                                                let startHour = 9;
                                                                                if (
                                                                                    s ===
                                                                                    0
                                                                                ) {
                                                                                    startHour =
                                                                                        9 +
                                                                                        ((idx *
                                                                                            7) %
                                                                                            4);
                                                                                } else if (
                                                                                    s ===
                                                                                    1
                                                                                ) {
                                                                                    startHour =
                                                                                        14 +
                                                                                        ((idx *
                                                                                            13) %
                                                                                            4);
                                                                                } else if (
                                                                                    s ===
                                                                                    2
                                                                                ) {
                                                                                    startHour =
                                                                                        19 +
                                                                                        ((idx *
                                                                                            17) %
                                                                                            4);
                                                                                }

                                                                                // Randomize duration: 1h, 1.5h, or 2h
                                                                                const durationSeed =
                                                                                    (idx *
                                                                                        5 +
                                                                                        s *
                                                                                        13) %
                                                                                    3;
                                                                                const height =
                                                                                    60 +
                                                                                    durationSeed *
                                                                                    30; // 60px, 90px, or 120px

                                                                                skeletons.push(
                                                                                    {
                                                                                        top:
                                                                                            startHour *
                                                                                            60,
                                                                                        height,
                                                                                    },
                                                                                );
                                                                            }

                                                                            return skeletons.map(
                                                                                (
                                                                                    sk,
                                                                                    sIdx,
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            sIdx
                                                                                        }
                                                                                        style={{
                                                                                            position:
                                                                                                "absolute",
                                                                                            top: sk.top,
                                                                                            height: sk.height,
                                                                                            left: 4,
                                                                                            right: 4,
                                                                                            zIndex: 10,
                                                                                        }}
                                                                                    >
                                                                                        <Skeleton
                                                                                            width="100%"
                                                                                            height="100%"
                                                                                            style={{
                                                                                                borderRadius: 6,
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                ),
                                                                            );
                                                                        })()
                                                                        : d.events.map(
                                                                            (
                                                                                ev: any,
                                                                            ) => {
                                                                                const [
                                                                                    h,
                                                                                    m,
                                                                                ] =
                                                                                    ev.localTime
                                                                                        .split(
                                                                                            ":",
                                                                                        )
                                                                                        .map(
                                                                                            Number,
                                                                                        );

                                                                                const top =
                                                                                    h *
                                                                                    60 +
                                                                                    m;
                                                                                let duration = 1.5;
                                                                                if (
                                                                                    ev.localEndTime
                                                                                ) {
                                                                                    const [
                                                                                        eh,
                                                                                        em,
                                                                                    ] =
                                                                                        ev.localEndTime
                                                                                            .split(
                                                                                                ":",
                                                                                            )
                                                                                            .map(
                                                                                                Number,
                                                                                            );
                                                                                    duration =
                                                                                        eh -
                                                                                        h +
                                                                                        (em -
                                                                                            m) /
                                                                                        60;
                                                                                    if (duration < 0) {
                                                                                        duration += 24;
                                                                                    }
                                                                                }
                                                                                const height =
                                                                                    duration *
                                                                                    60;

                                                                                const ea =
                                                                                    avail[
                                                                                    ev
                                                                                        .id
                                                                                    ] ||
                                                                                    [];
                                                                                const confirmedCount = ea.filter((a: any) => a.status === "available" || a.status === "played").length;
                                                                                const myStatus =
                                                                                    ea.find(
                                                                                        (
                                                                                            a,
                                                                                        ) =>
                                                                                            String(
                                                                                                a.player_id,
                                                                                            ) ===
                                                                                            String(
                                                                                                myPlayerId,
                                                                                            ),
                                                                                    )
                                                                                        ?.status ||
                                                                                    "pending";
                                                                                const isCancelled =
                                                                                    ev.status ===
                                                                                    "cancelled";
                                                                                const isNoPlayers =
                                                                                    ev.status ===
                                                                                    "no_players";
                                                                                const isNotPlayed =
                                                                                    ev.status ===
                                                                                    "not_played";
                                                                                const unavailable =
                                                                                    ea.filter(
                                                                                        (
                                                                                            a,
                                                                                        ) =>
                                                                                            a.status ===
                                                                                            "unavailable",
                                                                                    ).length;
                                                                                const isImpossible =
                                                                                    isMounted &&
                                                                                    (
                                                                                        ev as any
                                                                                    )
                                                                                        .localDate >=
                                                                                    todayStr &&
                                                                                    players.length >=
                                                                                    5 &&
                                                                                    players.length -
                                                                                    unavailable <
                                                                                    5;

                                                                                const isRed =
                                                                                    isCancelled ||
                                                                                    isNoPlayers ||
                                                                                    isNotPlayed ||
                                                                                    isImpossible;
                                                                                const evTypeColor =
                                                                                    ev.type ===
                                                                                        "playoffs"
                                                                                        ? "var(--val-yellow)"
                                                                                        : ev.type ===
                                                                                            "match"
                                                                                            ? "var(--val-match)"
                                                                                            : "var(--val-practice)";
                                                                                const evColorDark =
                                                                                    ev.type ===
                                                                                        "playoffs"
                                                                                        ? "var(--val-yellow-dark)"
                                                                                        : ev.type ===
                                                                                            "match"
                                                                                            ? "#5c4a35"
                                                                                            : "#808080";
                                                                                const isFirstUpcoming =
                                                                                    ev.id ===
                                                                                    firstUpcomingId;

                                                                                const hoverBorderColor =
                                                                                    myStatus ===
                                                                                        "available"
                                                                                        ? ev.type ===
                                                                                            "match"
                                                                                            ? "rgba(255, 255, 255, 0.65)"
                                                                                            : evColorDark
                                                                                        : evTypeColor;

                                                                                const hoverSheenActive =
                                                                                    myStatus ===
                                                                                        "available"
                                                                                        ? ev.type ===
                                                                                            "match"
                                                                                            ? "rgba(255, 255, 255, 0.15)"
                                                                                            : "rgba(0, 0, 0, 0.12)"
                                                                                        : "rgba(255, 255, 255, 0.12)";

                                                                                const hoverInsetShadow =
                                                                                    myStatus ===
                                                                                        "available"
                                                                                        ? ev.type ===
                                                                                            "match"
                                                                                            ? "inset 0 0 4px rgba(255, 255, 255, 0.35)"
                                                                                            : "inset 0 0 4px rgba(0, 0, 0, 0.15)"
                                                                                        : `inset 0 0 5px ${evTypeColor}`;

                                                                                return (
                                                                                    <div
                                                                                        key={
                                                                                            ev.id
                                                                                        }
                                                                                        onClick={() =>
                                                                                            setSelectedEventId(
                                                                                                ev.id,
                                                                                            )
                                                                                        }
                                                                                        className={`calendar-event-hover calendar-event-text ${ev.id === activeHighlightId ? "upcoming-highlight-mini" : ""}`}
                                                                                        style={{
                                                                                            position:
                                                                                                "absolute",
                                                                                            top: top,
                                                                                            left: 4,
                                                                                            right: 4,
                                                                                            height: height,
                                                                                            padding:
                                                                                                "6px",
                                                                                            borderRadius: 8,
                                                                                            zIndex: isFirstUpcoming
                                                                                                ? 25
                                                                                                : 10,
                                                                                            background:
                                                                                                isRed
                                                                                                    ? "transparent"
                                                                                                    : myStatus ===
                                                                                                        "unavailable"
                                                                                                        ? "transparent"
                                                                                                        : myStatus ===
                                                                                                            "pending"
                                                                                                            ? "transparent"
                                                                                                            : ev.status ===
                                                                                                                "completed" ||
                                                                                                                (ev.linkedMatches &&
                                                                                                                    ev
                                                                                                                        .linkedMatches
                                                                                                                        .length >
                                                                                                                    0)
                                                                                                                ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='140 -100 720 630' fill='none' stroke='rgba%28255,255,255,0.22%29' stroke-width='25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M 245.44 4.65 C 248.61 2.76 250.63 6.58 252.34 8.59 C 362.37 146.24 472.53 283.79 582.55 421.44 C 584.81 423.40 583.10 427.59 580.05 427.14 C 527.37 427.20 474.68 427.16 422.00 427.16 C 417.78 427.21 413.74 425.11 411.15 421.82 C 356.49 353.53 301.86 285.21 247.20 216.91 C 244.88 214.15 243.68 210.58 243.83 206.99 C 243.83 141.01 243.85 75.02 243.81 9.04 C 243.84 7.48 243.78 5.46 245.44 4.65 Z'/%3E%3Cpath d='M 754.32 4.33 C 756.57 3.48 759.05 5.56 758.72 7.92 C 758.80 73.93 758.71 139.94 758.76 205.95 C 758.91 209.69 758.09 213.56 755.66 216.50 C 739.05 237.28 722.42 258.05 705.81 278.82 C 703.04 282.42 698.51 284.41 693.98 284.18 C 641.65 284.13 589.31 284.21 536.98 284.14 C 533.89 284.62 532.13 280.45 534.41 278.44 C 606.98 187.65 679.61 96.89 752.22 6.12 C 752.77 5.34 753.47 4.74 754.32 4.33 Z'/%3E%3C/svg%3E") repeat, ${evTypeColor}`
                                                                                                                : myStatus === "maybe" || (myStatus === "available" && confirmedCount < 5)
                                                                                                                    ? `repeating-linear-gradient(45deg, ${evTypeColor}, ${evTypeColor} 6px, ${evColorDark} 6px, ${evColorDark} 12px)`
                                                                                                                    : evTypeColor,
                                                                                            color:
                                                                                                isRed ||
                                                                                                    myStatus ===
                                                                                                    "unavailable" ||
                                                                                                    myStatus ===
                                                                                                    "pending"
                                                                                                    ? evTypeColor
                                                                                                    : "white",
                                                                                            fontWeight: 700,
                                                                                            cursor: "pointer",
                                                                                            boxShadow:
                                                                                                isFirstUpcoming
                                                                                                    ? `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${ev.type === "match" ? "rgba(133, 107, 77, 0.4)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.4)" : "rgba(184, 184, 184, 0.4)"}`
                                                                                                    : myStatus ===
                                                                                                        "pending" ||
                                                                                                        myStatus ===
                                                                                                        "unavailable" ||
                                                                                                        isRed
                                                                                                        ? "none"
                                                                                                        : "0 4px 12px rgba(0,0,0,0.3)",
                                                                                            border:
                                                                                                isRed ||
                                                                                                    myStatus ===
                                                                                                    "unavailable"
                                                                                                    ? `1px solid ${evTypeColor}`
                                                                                                    : myStatus ===
                                                                                                        "pending"
                                                                                                        ? `2px dashed ${evTypeColor}`
                                                                                                        : "1px solid rgba(255,255,255,0.1)",
                                                                                            display:
                                                                                                "flex",
                                                                                            flexDirection:
                                                                                                height <
                                                                                                    40
                                                                                                    ? "row"
                                                                                                    : "column",
                                                                                            alignItems:
                                                                                                height <
                                                                                                    40
                                                                                                    ? "center"
                                                                                                    : "flex-start",
                                                                                            justifyContent:
                                                                                                height <
                                                                                                    40
                                                                                                    ? "center"
                                                                                                    : "flex-start",
                                                                                            gap:
                                                                                                height <
                                                                                                    40
                                                                                                    ? 4
                                                                                                    : 2,
                                                                                            overflow:
                                                                                                "hidden",
                                                                                            opacity:
                                                                                                isRed
                                                                                                    ? 0.4
                                                                                                    : myStatus ===
                                                                                                        "unavailable"
                                                                                                        ? 0.85
                                                                                                        : 1,
                                                                                            textDecoration:
                                                                                                myStatus ===
                                                                                                    "unavailable" ||
                                                                                                    isRed
                                                                                                    ? "line-through"
                                                                                                    : "none",
                                                                                            ["--hover-border-color" as any]:
                                                                                                hoverBorderColor,
                                                                                            ["--hover-sheen-active" as any]:
                                                                                                hoverSheenActive,
                                                                                            ["--hover-inset-shadow" as any]:
                                                                                                hoverInsetShadow,
                                                                                            ["--hover-color" as any]:
                                                                                                evTypeColor,
                                                                                        }}
                                                                                    >
                                                                                        {isFirstUpcoming && (
                                                                                            <div
                                                                                                style={{
                                                                                                    maxWidth: "100%",
                                                                                                    whiteSpace: "nowrap",
                                                                                                    overflow: "hidden",
                                                                                                    textOverflow: "ellipsis",
                                                                                                    background:
                                                                                                        "rgba(255,255,255,0.18)",
                                                                                                    color: "white",
                                                                                                    padding:
                                                                                                        "1px 4px",
                                                                                                    borderRadius: 4,
                                                                                                    fontSize: 7,
                                                                                                    fontWeight: 900,
                                                                                                    textTransform:
                                                                                                        "uppercase",
                                                                                                    letterSpacing: 0.5,
                                                                                                    marginBottom:
                                                                                                        height <
                                                                                                            40
                                                                                                            ? 0
                                                                                                            : 2,
                                                                                                }}
                                                                                            >
                                                                                                PRÓXIMO
                                                                                            </div>
                                                                                        )}
                                                                                        <div
                                                                                            style={{
                                                                                                whiteSpace:
                                                                                                    height < 40 ? "nowrap" : "normal",
                                                                                                overflow:
                                                                                                    "hidden",
                                                                                                textOverflow:
                                                                                                    "ellipsis",
                                                                                                lineHeight: 1.2,
                                                                                            }}
                                                                                        >
                                                                                            {getEventDisplayName(
                                                                                                ev,
                                                                                            )}
                                                                                        </div>
                                                                                        <div
                                                                                            style={{
                                                                                                fontSize: 8,
                                                                                                opacity: 0.7,
                                                                                                fontWeight: 600,
                                                                                                textTransform:
                                                                                                    "uppercase",
                                                                                            }}
                                                                                        >
                                                                                            {ev.map
                                                                                                ? maps.find(
                                                                                                    (
                                                                                                        m: any,
                                                                                                    ) =>
                                                                                                        m.id ===
                                                                                                        ev.map,
                                                                                                )
                                                                                                    ?.name ||
                                                                                                ev.map
                                                                                                : ev.type ===
                                                                                                    "playoffs"
                                                                                                    ? "Pick & Ban"
                                                                                                    : "Por decidir"}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            },
                                                                        )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div
                        style={{
                            position: "relative",
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                        }}
                    >
                        <div
                            ref={listContainerRef}
                            onScroll={checkUpcomingScrollPosition}
                            className="events-list-container"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 40,
                                flex: 1,
                                overflowY: "auto",
                                minHeight: 0,
                                paddingRight: 4,
                            }}
                        >
                            {isLoadingEvents ? (
                                Array.from({ length: 3 }).map((_, idx) => (
                                    <div
                                        key={idx}
                                        className="animate-fade-in"
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 16,
                                        }}
                                    >
                                        {/* Cabecera de día simulada */}
                                        {idx === 0 && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    marginBottom: 16,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding: "8px 16px",
                                                        borderRadius: 12,
                                                        background:
                                                            "rgba(255,255,255,0.05)",
                                                    }}
                                                >
                                                    <Skeleton
                                                        width={180}
                                                        height={16}
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        height: 1,
                                                        background:
                                                            "var(--border-color)",
                                                    }}
                                                />
                                            </div>
                                        )}
                                        {idx === 2 && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    marginBottom: 16,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding: "8px 16px",
                                                        borderRadius: 12,
                                                        background:
                                                            "rgba(255,255,255,0.05)",
                                                    }}
                                                >
                                                    <Skeleton
                                                        width={180}
                                                        height={16}
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        height: 1,
                                                        background:
                                                            "var(--border-color)",
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Tarjeta de Skeleton */}
                                        <div
                                            className="card glass-card"
                                            style={{
                                                marginBottom: 12,
                                                borderLeft: `4px solid rgba(255, 255, 255, 0.1)`,
                                                padding: "24px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 24,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                {/* Columna Izquierda */}
                                                <div
                                                    style={{
                                                        flex: "1 1 320px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 16,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <Skeleton
                                                            width={60}
                                                            height={18}
                                                            style={{
                                                                borderRadius: 10,
                                                            }}
                                                        />
                                                        <Skeleton
                                                            width="70%"
                                                            height={26}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: 10,
                                                        }}
                                                    >
                                                        <Skeleton
                                                            width={120}
                                                            height={28}
                                                            style={{
                                                                borderRadius: 8,
                                                            }}
                                                        />
                                                        <Skeleton
                                                            width={150}
                                                            height={28}
                                                            style={{
                                                                borderRadius: 8,
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{ marginTop: 8 }}
                                                    >
                                                        <Skeleton
                                                            width={110}
                                                            height={12}
                                                            style={{
                                                                marginBottom: 8,
                                                            }}
                                                        />
                                                        <Skeleton
                                                            width="100%"
                                                            height={40}
                                                            style={{
                                                                borderRadius: 8,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Columna Derecha */}
                                                <div
                                                    style={{
                                                        flex: "1 1 380px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 16,
                                                    }}
                                                >
                                                    <div
                                                        className="glass-card"
                                                        style={{
                                                            background:
                                                                "rgba(255,255,255,0.01)",
                                                            borderRadius: 12,
                                                            padding: 16,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                justifyContent:
                                                                    "space-between",
                                                                alignItems:
                                                                    "center",
                                                                marginBottom: 12,
                                                            }}
                                                        >
                                                            <Skeleton
                                                                width={80}
                                                                height={14}
                                                            />
                                                            <Skeleton
                                                                width={40}
                                                                height={14}
                                                            />
                                                        </div>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                flexWrap:
                                                                    "wrap",
                                                                gap: 8,
                                                            }}
                                                        >
                                                            {Array.from({
                                                                length: 5,
                                                            }).map((_, i) => (
                                                                <Skeleton
                                                                    key={i}
                                                                    width={70}
                                                                    height={26}
                                                                    style={{
                                                                        borderRadius: 20,
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    {!hasPreviousPage && events.length > 0 && isListView && (
                                        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: "10px 0" }}>
                                            No hay eventos más antiguos.
                                        </p>
                                    )}
                                    {events.length === 0 && (
                                        <p
                                            style={{
                                                color: "var(--text-muted)",
                                                textAlign: "center",
                                                padding: 40,
                                            }}
                                        >
                                            No hay eventos programados.
                                        </p>
                                    )}
                                    {events.map((ev, idx) => {
                                        const isPast =
                                            isMounted &&
                                            (ev as any).localDate < todayStr;
                                        const isCancelled =
                                            ev.status === "cancelled";
                                        const ea = avail[ev.id] || [];
                                        const confirmed = ea.filter(
                                            (a) =>
                                                a.status === "available" ||
                                                a.status === "played",
                                        ).length;
                                        const maybeCount = ea.filter(
                                            (a) => a.status === "maybe",
                                        ).length;
                                        const unavailable = ea.filter(
                                            (a) => a.status === "unavailable",
                                        ).length;
                                        const isImpossible =
                                            isMounted &&
                                            !isPast &&
                                            players.length >= 5 &&
                                            players.length - unavailable < 5;

                                        // Logic for day grouping (visual only)
                                        const prevEv =
                                            idx > 0 ? events[idx - 1] : null;
                                        const showDayHeader =
                                            !prevEv || prevEv.date !== ev.date;
                                        const isToday =
                                            (ev as any).localDate === todayStr;

                                        // Logic for "PRÓXIMO" tag and preceding items
                                        const isFirstUpcoming =
                                            ev.id === firstUpcomingId;
                                        const firstUpcomingIdx =
                                            events.findIndex(
                                                (e) => e.id === firstUpcomingId,
                                            );
                                        const isBeforeUpcoming =
                                            firstUpcomingIdx !== -1 &&
                                            idx < firstUpcomingIdx;
                                        const isInactive =
                                            isPast ||
                                            isCancelled ||
                                            isImpossible ||
                                            ev.status === "completed" ||
                                            ev.status === "no_players" ||
                                            ev.status === "not_played" ||
                                            isBeforeUpcoming;

                                        const myStatus =
                                            ea.find(
                                                (a) =>
                                                    String(a.player_id) ===
                                                    String(myPlayerId),
                                            )?.status || "pending";
                                        const matches = ev.linkedMatches || [];
                                        const hasPlayed =
                                            ev.status === "completed" ||
                                            matches.length > 0;

                                        return (
                                            <div key={ev.id}>
                                                {showDayHeader && (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 12,
                                                            marginBottom: 16,
                                                            opacity: isInactive
                                                                ? 0.45
                                                                : 1,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                padding:
                                                                    "8px 16px",
                                                                borderRadius: 12,
                                                                background:
                                                                    isToday
                                                                        ? "var(--val-red)"
                                                                        : "rgba(255,255,255,0.05)",
                                                                color: isToday
                                                                    ? "white"
                                                                    : "var(--text-primary)",
                                                                fontWeight: 800,
                                                                fontSize: 14,
                                                                textTransform:
                                                                    "uppercase",
                                                                letterSpacing: 1,
                                                                boxShadow:
                                                                    isToday
                                                                        ? "0 0 15px var(--val-red-glow)"
                                                                        : "none",
                                                            }}
                                                        >
                                                            {new Date(
                                                                `${ev.date}T00:00:00`,
                                                            ).toLocaleDateString(
                                                                "es-ES",
                                                                {
                                                                    weekday:
                                                                        "long",
                                                                    day: "numeric",
                                                                    month: "long",
                                                                },
                                                            )}
                                                            {isToday && (
                                                                <span
                                                                    style={{
                                                                        marginLeft: 8,
                                                                        opacity: 0.8,
                                                                    }}
                                                                >
                                                                    (HOY)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div
                                                            style={{
                                                                flex: 1,
                                                                height: 1,
                                                                background:
                                                                    "var(--border-color)",
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                <div
                                                    ref={(el) => {
                                                        eventRefsMap.current[
                                                            ev.id
                                                        ] = el;
                                                        if (isFirstUpcoming)
                                                            (
                                                                firstUpcomingRef as any
                                                            ).current = el;
                                                    }}
                                                    className={`card glass-card ${isEntryAnimationDone ? "" : "animate-card-in"} ${ev.id === activeHighlightId ? "upcoming-highlight" : ""} ${isInactive
                                                        ? hasPlayed
                                                            ? "played-card"
                                                            : "faded-card"
                                                        : myStatus ===
                                                            "unavailable"
                                                            ? `unavailable-card ${ev.type === "match" ? "hover-lift-match" : ev.type === "playoffs" ? "hover-lift-playoffs" : "hover-lift-practice"}`
                                                            : ev.type ===
                                                                "match"
                                                                ? "hover-lift-match"
                                                                : ev.type ===
                                                                    "playoffs"
                                                                    ? "hover-lift-playoffs"
                                                                    : "hover-lift-practice"
                                                        }`}
                                                    style={{
                                                        marginBottom: 12,
                                                        borderLeft: `4px solid ${ev.type === "match" ? "var(--val-match)" : ev.type === "playoffs" ? "var(--val-yellow)" : "var(--val-practice)"}`,
                                                        scrollMarginTop:
                                                            "80px",
                                                        animationDelay: `${Math.min(idx, 5) * 0.1}s`,
                                                        boxShadow:
                                                            isFirstUpcoming
                                                                ? `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${ev.type === "match" ? "rgba(133, 107, 77, 0.25)" : ev.type === "playoffs" ? "rgba(234, 180, 8, 0.25)" : "rgba(184, 184, 184, 0.25)"}`
                                                                : undefined,
                                                        ["--hover-color" as any]:
                                                            ev.type === "match"
                                                                ? "var(--val-match)"
                                                                : ev.type ===
                                                                    "playoffs"
                                                                    ? "var(--val-yellow)"
                                                                    : "var(--val-practice)",
                                                        ["--hover-glow-color" as any]:
                                                            ev.type === "match"
                                                                ? "rgba(133, 107, 77, 0.3)"
                                                                : ev.type ===
                                                                    "playoffs"
                                                                    ? "rgba(245, 158, 11, 0.3)"
                                                                    : "rgba(184, 184, 184, 0.3)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: 24,
                                                            flexWrap: "wrap",
                                                        }}
                                                    >
                                                        {/* Columna Izquierda: Información de Evento */}
                                                        <div
                                                            style={{
                                                                flex: "1 1 320px",
                                                                display: "flex",
                                                                flexDirection:
                                                                    "column",
                                                                gap: 16,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    flexDirection:
                                                                        "column",
                                                                    gap: 8,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap: 8,
                                                                        flexWrap:
                                                                            "wrap",
                                                                    }}
                                                                >
                                                                    <span
                                                                        className={`tag ${ev.type === "match" ? "tag-match" : ev.type === "playoffs" ? "tag-gold" : "tag-practice"}`}
                                                                    >
                                                                        {ev.type ===
                                                                            "match"
                                                                            ? "Partido"
                                                                            : ev.type ===
                                                                                "playoffs"
                                                                                ? "Playoffs"
                                                                                : "Práctica"}
                                                                    </span>
                                                                    {ev.season?.name && (
                                                                        <span
                                                                            className="tag tag-neutral"
                                                                            style={{
                                                                                fontSize: 10,
                                                                                fontWeight: 600,
                                                                                background: "rgba(255,255,255,0.05)"
                                                                            }}
                                                                        >
                                                                            {ev.season.name}
                                                                        </span>
                                                                    )}
                                                                    {isFirstUpcoming && (
                                                                        <span
                                                                            className="tag tag-neutral"
                                                                            style={{
                                                                                fontSize: 10,
                                                                                fontWeight: 800,
                                                                            }}
                                                                        >
                                                                            PRÓXIMO
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h3
                                                                    style={{
                                                                        fontSize: 22,
                                                                        fontWeight: 800,
                                                                        color: "white",
                                                                        margin: 0,
                                                                        letterSpacing:
                                                                            "-0.5px",
                                                                        textDecoration:
                                                                            isCancelled ||
                                                                                ev.status ===
                                                                                "no_players" ||
                                                                                ev.status ===
                                                                                "not_played" ||
                                                                                isImpossible
                                                                                ? "line-through"
                                                                                : undefined,
                                                                        textShadow:
                                                                            "0 2px 10px rgba(0,0,0,0.3)",
                                                                    }}
                                                                >
                                                                    {getEventDisplayName(
                                                                        ev,
                                                                    )}
                                                                </h3>
                                                            </div>

                                                            {/* Cybernetic Slot Capsules */}
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    flexWrap:
                                                                        "wrap",
                                                                    gap: 10,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap: 8,
                                                                        padding:
                                                                            "6px 12px",
                                                                        borderRadius: 8,
                                                                        background:
                                                                            "rgba(255, 255, 255, 0.03)",
                                                                        border: "1px solid rgba(255, 255, 255, 0.06)",
                                                                        fontSize: 12,
                                                                        fontWeight: 700,
                                                                        color: "var(--text-primary)",
                                                                    }}
                                                                >
                                                                    <svg
                                                                        width="14"
                                                                        height="14"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                    >
                                                                        <circle
                                                                            cx="12"
                                                                            cy="12"
                                                                            r="10"
                                                                        />
                                                                        <path d="M12 6v6l4 2" />
                                                                    </svg>
                                                                    <span>
                                                                        {
                                                                            ev.localTime
                                                                        }{" "}
                                                                        {ev.localEndTime &&
                                                                            `— ${ev.localEndTime}`}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Map Preview Card */}
                                                            {(() => {
                                                                if (
                                                                    ev.type ===
                                                                    "playoffs"
                                                                ) {
                                                                    const seasonMaps =
                                                                        getSeasonMaps(
                                                                            ev,
                                                                        );
                                                                    if (
                                                                        seasonMaps.length ===
                                                                        0
                                                                    )
                                                                        return null;
                                                                    return (
                                                                        <div
                                                                            onClick={() =>
                                                                                router.push(
                                                                                    `/strategies`,
                                                                                )
                                                                            }
                                                                            className="glass-card hover-lift transition-smooth"
                                                                            style={{
                                                                                position:
                                                                                    "relative",
                                                                                borderRadius: 12,
                                                                                height: 80,
                                                                                overflow:
                                                                                    "hidden",
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                                                                background:
                                                                                    "rgba(0,0,0,0.4)",
                                                                                cursor: "pointer",
                                                                                ["--hover-color" as any]:
                                                                                    "var(--val-yellow)",
                                                                                ["--hover-glow-color" as any]:
                                                                                    "rgba(245, 158, 11, 0.2)",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    position:
                                                                                        "absolute",
                                                                                    right: 0,
                                                                                    top: 0,
                                                                                    bottom: 0,
                                                                                    width: "70%",
                                                                                    maskImage:
                                                                                        "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                                                                    WebkitMaskImage:
                                                                                        "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                                                                    pointerEvents:
                                                                                        "none",
                                                                                    height: "100%",
                                                                                }}
                                                                            >
                                                                                {renderDiagonalMapSplash(
                                                                                    seasonMaps,
                                                                                    0.6,
                                                                                )}
                                                                            </div>
                                                                            <div
                                                                                style={{
                                                                                    padding:
                                                                                        "12px 16px",
                                                                                    zIndex: 1,
                                                                                    position:
                                                                                        "relative",
                                                                                }}
                                                                            >
                                                                                <div
                                                                                    style={{
                                                                                        fontSize: 9,
                                                                                        fontWeight: 800,
                                                                                        color: "var(--val-yellow)",
                                                                                        textTransform:
                                                                                            "uppercase",
                                                                                        letterSpacing: 1,
                                                                                    }}
                                                                                >
                                                                                    Map Pool de la Season
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        fontSize: 16,
                                                                                        fontWeight: 800,
                                                                                        color: "white",
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        seasonMaps.length
                                                                                    }{" "}
                                                                                    Mapas
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                const mapObj =
                                                                    ev.map
                                                                        ? maps.find(
                                                                            (
                                                                                m: any,
                                                                            ) =>
                                                                                m.id ===
                                                                                ev.map,
                                                                        )
                                                                        : null;
                                                                if (!mapObj)
                                                                    return null;
                                                                return (
                                                                    <div
                                                                        onClick={() =>
                                                                            router.push(
                                                                                `/strategies?map=${encodeURIComponent(mapObj.id)}`,
                                                                            )
                                                                        }
                                                                        className="glass-card hover-lift transition-smooth"
                                                                        style={{
                                                                            position:
                                                                                "relative",
                                                                            borderRadius: 12,
                                                                            height: 80,
                                                                            overflow:
                                                                                "hidden",
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            border: "1px solid rgba(255, 255, 255, 0.08)",
                                                                            background:
                                                                                "rgba(0,0,0,0.4)",
                                                                            cursor: "pointer",
                                                                            ["--hover-color" as any]:
                                                                                ev.type ===
                                                                                    "match"
                                                                                    ? "var(--val-match)"
                                                                                    : "var(--val-practice)",
                                                                            ["--hover-glow-color" as any]:
                                                                                ev.type ===
                                                                                    "match"
                                                                                    ? "rgba(133, 107, 77, 0.2)"
                                                                                    : "rgba(184, 184, 184, 0.2)",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                position:
                                                                                    "absolute",
                                                                                right: 0,
                                                                                top: 0,
                                                                                bottom: 0,
                                                                                width: "60%",
                                                                                backgroundImage: `url(${mapObj.splash})`,
                                                                                backgroundSize:
                                                                                    "cover",
                                                                                backgroundPosition:
                                                                                    "center",
                                                                                maskImage:
                                                                                    "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                                                                WebkitMaskImage:
                                                                                    "linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                                                                                opacity: 0.5,
                                                                                pointerEvents:
                                                                                    "none",
                                                                            }}
                                                                        />
                                                                        <div
                                                                            style={{
                                                                                padding:
                                                                                    "12px 16px",
                                                                                zIndex: 1,
                                                                                position:
                                                                                    "relative",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    fontSize: 9,
                                                                                    fontWeight: 800,
                                                                                    color: "var(--text-secondary)",
                                                                                    textTransform:
                                                                                        "uppercase",
                                                                                    letterSpacing: 1,
                                                                                }}
                                                                            >
                                                                                Mapa
                                                                            </div>
                                                                            <div
                                                                                style={{
                                                                                    fontSize: 16,
                                                                                    fontWeight: 800,
                                                                                    color: "white",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    mapObj.name
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {ev.description && (
                                                                <p
                                                                    style={{
                                                                        fontSize: 13,
                                                                        color: "var(--text-muted)",
                                                                        lineHeight: 1.6,
                                                                        background:
                                                                            "rgba(255,255,255,0.01)",
                                                                        padding:
                                                                            "10px 14px",
                                                                        borderRadius: 8,
                                                                        borderLeft:
                                                                            "2px solid rgba(255,255,255,0.1)",
                                                                        margin: 0,
                                                                    }}
                                                                >
                                                                    {
                                                                        ev.description
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Columna Derecha: Asistencia, Mapa y Controles */}
                                                        <div
                                                            style={{
                                                                flex: "1 1 380px",
                                                                display: "flex",
                                                                flexDirection:
                                                                    "column",
                                                                gap: 16,
                                                            }}
                                                        >
                                                            {/* Attendance Card */}
                                                            <div
                                                                className="glass-card"
                                                                style={{
                                                                    background:
                                                                        "rgba(255,255,255,0.01)",
                                                                    borderRadius: 12,
                                                                    padding: 16,
                                                                    border:
                                                                        confirmed >=
                                                                            5
                                                                            ? "1px solid rgba(0, 212, 170, 0.25)"
                                                                            : "1px solid var(--border-color)",
                                                                    boxShadow:
                                                                        confirmed >=
                                                                            5
                                                                            ? "0 4px 20px rgba(0, 212, 170, 0.03)"
                                                                            : "none",
                                                                    transition:
                                                                        "border-color 0.3s, box-shadow 0.3s",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        justifyContent:
                                                                            "space-between",
                                                                        alignItems:
                                                                            "center",
                                                                        marginBottom: 16,
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            fontSize: 12,
                                                                            fontWeight: 800,
                                                                            textTransform:
                                                                                "uppercase",
                                                                            letterSpacing: 1,
                                                                        }}
                                                                    >
                                                                        Asistencia
                                                                    </span>
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            gap: 10,
                                                                            alignItems:
                                                                                "center",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className={`progress-bar ${updatingEventId === ev.id ? "animate-pulse" : ""}`}
                                                                            style={{
                                                                                width: 100,
                                                                                height: 8,
                                                                                borderRadius: 4,
                                                                                overflow:
                                                                                    "hidden",
                                                                                background:
                                                                                    "rgba(255,255,255,0.05)",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                className="progress-fill progress-fill-cyan transition-smooth"
                                                                                style={{
                                                                                    width: `${Math.min((confirmed / 5) * 100, 100)}%`,
                                                                                }}
                                                                            />
                                                                            <div
                                                                                className="progress-fill progress-fill-maybe transition-smooth"
                                                                                style={{
                                                                                    width: `${Math.min((maybeCount / 5) * 100, Math.max(0, 100 - (confirmed / 5) * 100))}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <span
                                                                            style={{
                                                                                fontSize: 13,
                                                                                fontWeight: 800,
                                                                                color:
                                                                                    confirmed >=
                                                                                        5
                                                                                        ? "var(--val-cyan)"
                                                                                        : "var(--text-secondary)",
                                                                            }}
                                                                        >
                                                                            {
                                                                                confirmed
                                                                            }
                                                                            /5
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        flexWrap:
                                                                            "wrap",
                                                                        justifyContent:
                                                                            "center",
                                                                        gap: 12,
                                                                    }}
                                                                >
                                                                    {[...players].sort((a, b) => {
                                                                        const order: Record<string, number> = { played: 1, available: 2, maybe: 3, pending: 4, unavailable: 5 };
                                                                        const stA = ea.find(att => att.player_id === a.id)?.status || "pending";
                                                                        const stB = ea.find(att => att.player_id === b.id)?.status || "pending";
                                                                        if (order[stA] !== order[stB]) return (order[stA] || 6) - (order[stB] || 6);
                                                                        return (a.name || "").localeCompare(b.name || "");
                                                                    }).map(
                                                                        (p) => {
                                                                            const ps =
                                                                                ea.find(
                                                                                    (
                                                                                        a,
                                                                                    ) =>
                                                                                        a.player_id ===
                                                                                        p.id,
                                                                                )
                                                                                    ?.status ||
                                                                                "pending";
                                                                            return (
                                                                                <Link
                                                                                    href={`/player/${p.id}`}
                                                                                    key={
                                                                                        p.id
                                                                                    }
                                                                                    title={p.name}
                                                                                    style={{
                                                                                        textDecoration: "none", color: "inherit",
                                                                                        display:
                                                                                            "flex",
                                                                                        flexDirection:
                                                                                            "column",
                                                                                        alignItems:
                                                                                            "center",
                                                                                        gap: 6,
                                                                                        width: 60,
                                                                                        textAlign:
                                                                                            "center",
                                                                                    }}
                                                                                >
                                                                                    <div
                                                                                        style={{
                                                                                            position:
                                                                                                "relative",
                                                                                            width: 36,
                                                                                            height: 36,
                                                                                            display:
                                                                                                "flex",
                                                                                            alignItems:
                                                                                                "center",
                                                                                            justifyContent:
                                                                                                "center",
                                                                                        }}
                                                                                    >
                                                                                        <div
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                borderRadius:
                                                                                                    "50%",
                                                                                                background:
                                                                                                    p.avatar_color,
                                                                                                display:
                                                                                                    "flex",
                                                                                                alignItems:
                                                                                                    "center",
                                                                                                justifyContent:
                                                                                                    "center",
                                                                                                fontSize: 14,
                                                                                                fontWeight: 800,
                                                                                                color: "white",
                                                                                                border: `2px solid ${ps ===
                                                                                                    "played"
                                                                                                    ? "var(--val-purple)"
                                                                                                    : ps ===
                                                                                                        "available"
                                                                                                        ? "var(--val-cyan)"
                                                                                                        : ps ===
                                                                                                            "maybe"
                                                                                                            ? "var(--val-yellow)"
                                                                                                            : ps ===
                                                                                                                "unavailable"
                                                                                                                ? "var(--val-red)"
                                                                                                                : "rgba(255,255,255,0.1)"
                                                                                                    }`,
                                                                                                boxShadow:
                                                                                                    ps !==
                                                                                                        "pending"
                                                                                                        ? `0 0 10px ${ps === "played" ? "var(--val-purple)" : ps === "available" ? "var(--val-cyan)" : ps === "maybe" ? "var(--val-yellow)" : "var(--val-red)"}44`
                                                                                                        : "none",
                                                                                                opacity:
                                                                                                    ps !==
                                                                                                        "pending"
                                                                                                        ? 1
                                                                                                        : 0.4,
                                                                                                transition:
                                                                                                    "all 0.3s ease",
                                                                                                overflow: "hidden",
                                                                                            }}
                                                                                        >
                                                                                            {p.image ? (
                                                                                                <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                                            ) : (
                                                                                                p.name[0]
                                                                                            )}
                                                                                        </div>
                                                                                        {/* Status Emblem Indicator */}
                                                                                        <div
                                                                                            style={{
                                                                                                position:
                                                                                                    "absolute",
                                                                                                bottom: -2,
                                                                                                right: -2,
                                                                                                width: 14,
                                                                                                height: 14,
                                                                                                borderRadius:
                                                                                                    "50%",
                                                                                                background:
                                                                                                    ps ===
                                                                                                        "played"
                                                                                                        ? "var(--val-purple)"
                                                                                                        : ps ===
                                                                                                            "available"
                                                                                                            ? "var(--val-cyan)"
                                                                                                            : ps ===
                                                                                                                "maybe"
                                                                                                                ? "var(--val-yellow)"
                                                                                                                : ps ===
                                                                                                                    "unavailable"
                                                                                                                    ? "var(--val-red)"
                                                                                                                    : "rgba(255,255,255,0.15)",
                                                                                                border: "2px solid #11141b",
                                                                                                display:
                                                                                                    "flex",
                                                                                                alignItems:
                                                                                                    "center",
                                                                                                justifyContent:
                                                                                                    "center",
                                                                                                fontSize: 8,
                                                                                                fontWeight: 900,
                                                                                                color:
                                                                                                    ps ===
                                                                                                        "maybe"
                                                                                                        ? "black"
                                                                                                        : "white",
                                                                                                boxShadow:
                                                                                                    "0 2px 4px rgba(0,0,0,0.5)",
                                                                                            }}
                                                                                        >
                                                                                            {ps ===
                                                                                                "played"
                                                                                                ? "🎮"
                                                                                                : ps ===
                                                                                                    "available"
                                                                                                    ? "✓"
                                                                                                    : ps ===
                                                                                                        "maybe"
                                                                                                        ? "?"
                                                                                                        : ps ===
                                                                                                            "unavailable"
                                                                                                            ? "✗"
                                                                                                            : "•"}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div
                                                                                        style={{
                                                                                            fontSize: 9,
                                                                                            color: "var(--text-muted)",
                                                                                            fontWeight: 700,
                                                                                            textTransform:
                                                                                                "uppercase",
                                                                                            whiteSpace:
                                                                                                "nowrap",
                                                                                            overflow:
                                                                                                "hidden",
                                                                                            textOverflow:
                                                                                                "ellipsis",
                                                                                            width:
                                                                                                "100%",
                                                                                        }}
                                                                                    >
                                                                                        {
                                                                                            p.name.split(
                                                                                                " ",
                                                                                            )[0]
                                                                                        }
                                                                                    </div>
                                                                                </Link>
                                                                            );
                                                                        },
                                                                    )}
                                                                </div>

                                                                {/* Dynamic Detailed Stats Row */}
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        gap: 8,
                                                                        marginTop: 14,
                                                                        paddingTop: 12,
                                                                        borderTop:
                                                                            "1px solid rgba(255,255,255,0.05)",
                                                                        justifyContent:
                                                                            "space-between",
                                                                        fontSize: 10,
                                                                        fontWeight: 700,
                                                                        color: "var(--text-muted)",
                                                                        textTransform:
                                                                            "uppercase",
                                                                        letterSpacing: 0.5,
                                                                    }}
                                                                >
                                                                    {hasPlayed && (
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap: 4,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    width: 6,
                                                                                    height: 6,
                                                                                    borderRadius:
                                                                                        "50%",
                                                                                    background:
                                                                                        "var(--val-purple)",
                                                                                    boxShadow:
                                                                                        "0 0 6px var(--val-purple)",
                                                                                }}
                                                                            />
                                                                            <span
                                                                                style={{
                                                                                    color: "var(--val-purple)",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    ea.filter(
                                                                                        (
                                                                                            a,
                                                                                        ) =>
                                                                                            a.status ===
                                                                                            "played",
                                                                                    )
                                                                                        .length
                                                                                }{" "}
                                                                                Jugaron
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 4,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: 6,
                                                                                height: 6,
                                                                                borderRadius:
                                                                                    "50%",
                                                                                background:
                                                                                    "var(--val-cyan)",
                                                                                boxShadow:
                                                                                    "0 0 6px var(--val-cyan)",
                                                                            }}
                                                                        />
                                                                        <span>
                                                                            {
                                                                                confirmed
                                                                            }{" "}
                                                                            Sí
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 4,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: 6,
                                                                                height: 6,
                                                                                borderRadius:
                                                                                    "50%",
                                                                                background:
                                                                                    "var(--val-yellow)",
                                                                                boxShadow:
                                                                                    "0 0 6px var(--val-yellow)",
                                                                            }}
                                                                        />
                                                                        <span>
                                                                            {
                                                                                maybeCount
                                                                            }{" "}
                                                                            Duda
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 4,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: 6,
                                                                                height: 6,
                                                                                borderRadius:
                                                                                    "50%",
                                                                                background:
                                                                                    "var(--val-red)",
                                                                                boxShadow:
                                                                                    "0 0 6px var(--val-red)",
                                                                            }}
                                                                        />
                                                                        <span>
                                                                            {
                                                                                unavailable
                                                                            }{" "}
                                                                            No
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 4,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: 6,
                                                                                height: 6,
                                                                                borderRadius:
                                                                                    "50%",
                                                                                background:
                                                                                    "rgba(255,255,255,0.25)",
                                                                            }}
                                                                        />
                                                                        <span>
                                                                            {players.length -
                                                                                confirmed -
                                                                                maybeCount -
                                                                                unavailable}{" "}
                                                                            Pendiente
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Actions Panel (Integrated) */}
                                                                {myPlayerId &&
                                                                    !isPast &&
                                                                    ev.status !== "completed" && (
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                gap: 12,
                                                                                marginTop: 14,
                                                                                paddingTop: 12,
                                                                                borderTop: "1px solid rgba(255,255,255,0.05)",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    fontSize: 10,
                                                                                    fontWeight: 800,
                                                                                    color: "var(--text-muted)",
                                                                                    textTransform:
                                                                                        "uppercase",
                                                                                    letterSpacing: 0.5,
                                                                                }}
                                                                            >
                                                                                Mi Estado:
                                                                            </div>
                                                                            <div
                                                                                style={{
                                                                                    display: "flex",
                                                                                    gap: 8,
                                                                                    flex: 1,
                                                                                }}
                                                                            >
                                                                                <button
                                                                                    onClick={() =>
                                                                                        setAvailability(
                                                                                            ev.id,
                                                                                            myStatus === "available" ? "pending" : "available",
                                                                                        )
                                                                                    }
                                                                                    className="transition-smooth"
                                                                                    style={{
                                                                                        flex: 1,
                                                                                        fontSize: 11,
                                                                                        fontWeight: 800,
                                                                                        padding:
                                                                                            "8px 12px",
                                                                                        borderRadius: 8,
                                                                                        cursor: "pointer",
                                                                                        display:
                                                                                            "flex",
                                                                                        alignItems:
                                                                                            "center",
                                                                                        justifyContent:
                                                                                            "center",
                                                                                        gap: 6,
                                                                                        border:
                                                                                            myStatus ===
                                                                                                "available"
                                                                                                ? "1px solid var(--val-cyan)"
                                                                                                : "1px solid rgba(0, 212, 170, 0.15)",
                                                                                        background:
                                                                                            myStatus ===
                                                                                                "available"
                                                                                                ? "var(--val-cyan)"
                                                                                                : "rgba(0, 212, 170, 0.03)",
                                                                                        color:
                                                                                            myStatus ===
                                                                                                "available"
                                                                                                ? "white"
                                                                                                : "rgba(0, 212, 170, 0.85)",
                                                                                        boxShadow:
                                                                                            myStatus ===
                                                                                                "available"
                                                                                                ? "0 0 15px rgba(0, 212, 170, 0.3)"
                                                                                                : "none",
                                                                                        transform:
                                                                                            "scale(1)",
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                                                        e.currentTarget.style.background = myStatus === "available" ? "var(--val-cyan)" : "rgba(0, 212, 170, 0.1)";
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        e.currentTarget.style.transform = "scale(1)";
                                                                                        e.currentTarget.style.background = myStatus === "available" ? "var(--val-cyan)" : "rgba(0, 212, 170, 0.03)";
                                                                                    }}
                                                                                >
                                                                                    <span>SÍ</span> <span>✅</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={() =>
                                                                                        setAvailability(
                                                                                            ev.id,
                                                                                            myStatus === "maybe" ? "pending" : "maybe",
                                                                                        )
                                                                                    }
                                                                                    className="transition-smooth"
                                                                                    style={{
                                                                                        flex: 1,
                                                                                        fontSize: 11,
                                                                                        fontWeight: 800,
                                                                                        padding:
                                                                                            "8px 12px",
                                                                                        borderRadius: 8,
                                                                                        cursor: "pointer",
                                                                                        display:
                                                                                            "flex",
                                                                                        alignItems:
                                                                                            "center",
                                                                                        justifyContent:
                                                                                            "center",
                                                                                        gap: 6,
                                                                                        border:
                                                                                            myStatus ===
                                                                                                "maybe"
                                                                                                ? "1px solid var(--val-yellow)"
                                                                                                : "1px solid rgba(245, 158, 11, 0.15)",
                                                                                        background:
                                                                                            myStatus ===
                                                                                                "maybe"
                                                                                                ? "var(--val-yellow)"
                                                                                                : "rgba(245, 158, 11, 0.03)",
                                                                                        color:
                                                                                            myStatus ===
                                                                                                "maybe"
                                                                                                ? "black"
                                                                                                : "rgba(245, 158, 11, 0.85)",
                                                                                        boxShadow:
                                                                                            myStatus ===
                                                                                                "maybe"
                                                                                                ? "0 0 15px rgba(245, 158, 11, 0.3)"
                                                                                                : "none",
                                                                                        transform:
                                                                                            "scale(1)",
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                                                        e.currentTarget.style.background = myStatus === "maybe" ? "var(--val-yellow)" : "rgba(245, 158, 11, 0.1)";
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        e.currentTarget.style.transform = "scale(1)";
                                                                                        e.currentTarget.style.background = myStatus === "maybe" ? "var(--val-yellow)" : "rgba(245, 158, 11, 0.03)";
                                                                                    }}
                                                                                >
                                                                                    <span>DUDA</span> <span>⚠️</span>
                                                                                </button>

                                                                                <button
                                                                                    onClick={() =>
                                                                                        setAvailability(
                                                                                            ev.id,
                                                                                            myStatus === "unavailable" ? "pending" : "unavailable",
                                                                                        )
                                                                                    }
                                                                                    className="transition-smooth"
                                                                                    style={{
                                                                                        flex: 1,
                                                                                        fontSize: 11,
                                                                                        fontWeight: 800,
                                                                                        padding:
                                                                                            "8px 12px",
                                                                                        borderRadius: 8,
                                                                                        cursor: "pointer",
                                                                                        display:
                                                                                            "flex",
                                                                                        alignItems:
                                                                                            "center",
                                                                                        justifyContent:
                                                                                            "center",
                                                                                        gap: 6,
                                                                                        border:
                                                                                            myStatus ===
                                                                                                "unavailable"
                                                                                                ? "1px solid var(--val-red)"
                                                                                                : "1px solid rgba(255, 70, 85, 0.15)",
                                                                                        background:
                                                                                            myStatus ===
                                                                                                "unavailable"
                                                                                                ? "var(--val-red)"
                                                                                                : "rgba(255, 70, 85, 0.03)",
                                                                                        color:
                                                                                            myStatus ===
                                                                                                "unavailable"
                                                                                                ? "white"
                                                                                                : "rgba(255, 70, 85, 0.85)",
                                                                                        boxShadow:
                                                                                            myStatus ===
                                                                                                "unavailable"
                                                                                                ? "0 0 15px rgba(255, 70, 85, 0.3)"
                                                                                                : "none",
                                                                                        transform:
                                                                                            "scale(1)",
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                                                        e.currentTarget.style.background = myStatus === "unavailable" ? "var(--val-red)" : "rgba(255, 70, 85, 0.1)";
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        e.currentTarget.style.transform = "scale(1)";
                                                                                        e.currentTarget.style.background = myStatus === "unavailable" ? "var(--val-red)" : "rgba(255, 70, 85, 0.03)";
                                                                                    }}
                                                                                >
                                                                                    <span>NO</span> <span>❌</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                            </div>

                                                            {(isCancelled ||
                                                                ev.status ===
                                                                "no_players" ||
                                                                ev.status ===
                                                                "not_played" ||
                                                                isImpossible) && (
                                                                    <div
                                                                        style={{
                                                                            padding:
                                                                                "10px 14px",
                                                                            borderRadius: 8,
                                                                            background:
                                                                                "rgba(133, 107, 77, 0.06)",
                                                                            border: "1px solid rgba(133, 107, 77, 0.2)",
                                                                            color: "var(--val-red)",
                                                                            fontSize: 12,
                                                                            fontWeight: 600,
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 8,
                                                                            boxShadow:
                                                                                "0 4px 20px rgba(133, 107, 77, 0.05)",
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                fontSize: 14,
                                                                            }}
                                                                        >
                                                                            ⚠️
                                                                        </span>
                                                                        <span>
                                                                            {isCancelled &&
                                                                                "Cancelado: Ya se jugaron 2 partidos esta semana."}
                                                                            {ev.status ===
                                                                                "no_players" &&
                                                                                "Sin asistencia: No hay suficientes jugadores confirmados."}
                                                                            {ev.status ===
                                                                                "not_played" &&
                                                                                "No jugado: Evento cancelado/no disputado."}
                                                                            {isImpossible &&
                                                                                ev.status ===
                                                                                "scheduled" &&
                                                                                "Imposible: Falta de jugadores (mínimo 5 confirmados)."}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                            {/* Linked Matches */}
                                                            {matches.length >
                                                                0 ? (
                                                                <div
                                                                    style={{
                                                                        marginTop: 8,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            fontSize: 11,
                                                                            fontWeight: 800,
                                                                            color: "var(--text-muted)",
                                                                            textTransform:
                                                                                "uppercase",
                                                                            letterSpacing: 1,
                                                                            marginBottom: 8,
                                                                        }}
                                                                    >
                                                                        Partidos
                                                                        Jugados
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            flexDirection:
                                                                                "column",
                                                                            gap: 8,
                                                                        }}
                                                                    >
                                                                        {matches.map(
                                                                            (
                                                                                m: LinkedMatch,
                                                                                mIdx: number
                                                                            ) => {
                                                                                const ourWin =
                                                                                    m.our_team_side ===
                                                                                        "Blue"
                                                                                        ? m.team_blue_won
                                                                                        : !m.team_blue_won;
                                                                                const isBlue =
                                                                                    m.our_team_side ===
                                                                                    "Blue";
                                                                                const ourScore =
                                                                                    isBlue
                                                                                        ? m.team_blue_score
                                                                                        : m.team_red_score;
                                                                                const rivalScore =
                                                                                    isBlue
                                                                                        ? m.team_red_score
                                                                                        : m.team_blue_score;
                                                                                return (
                                                                                    <div
                                                                                        key={
                                                                                            m.id
                                                                                        }
                                                                                        onClick={() =>
                                                                                            router.push(
                                                                                                `/matches?id=${m.id}`,
                                                                                            )
                                                                                        }
                                                                                        className="glass-card"
                                                                                        style={{
                                                                                            display:
                                                                                                "flex",
                                                                                            alignItems:
                                                                                                "center",
                                                                                            gap: 12,
                                                                                            padding:
                                                                                                "8px 12px",
                                                                                            borderRadius: 8,
                                                                                            background:
                                                                                                "rgba(255,255,255,0.02)",
                                                                                            cursor: "pointer",
                                                                                            border: `1px solid ${ourWin ? "rgba(0, 212, 170, 0.2)" : "rgba(255, 70, 85, 0.2)"}`,
                                                                                        }}
                                                                                    >
                                                                                        <div
                                                                                            style={{
                                                                                                width: 24,
                                                                                                height: 24,
                                                                                                borderRadius: 4,
                                                                                                background:
                                                                                                    ourWin
                                                                                                        ? "var(--val-cyan)"
                                                                                                        : "var(--val-red)",
                                                                                                display:
                                                                                                    "flex",
                                                                                                alignItems:
                                                                                                    "center",
                                                                                                justifyContent:
                                                                                                    "center",
                                                                                                fontSize: 10,
                                                                                                fontWeight: 900,
                                                                                                color: "white",
                                                                                            }}
                                                                                        >
                                                                                            {ourWin
                                                                                                ? "W"
                                                                                                : "L"}
                                                                                        </div>
                                                                                        <div
                                                                                            style={{
                                                                                                flex: 1,
                                                                                                fontSize: 12,
                                                                                            }}
                                                                                        >
                                                                                                <span
                                                                                                    style={{
                                                                                                        fontWeight: 700,
                                                                                                    }}
                                                                                                >
                                                                                                {
                                                                                                    m.map_name
                                                                                                }
                                                                                            </span>
                                                                                            {ev.type === "playoffs" && (
                                                                                                <span style={{ marginLeft: 6, fontSize: 10, color: "var(--val-cyan)", fontWeight: 800, textTransform: "uppercase", background: "rgba(184, 184, 184, 0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                                                                                    {mIdx === 0 ? "Cuartos" : mIdx === 1 ? "Semis" : "Final"}
                                                                                                </span>
                                                                                            )}
                                                                                            <span
                                                                                                style={{
                                                                                                    marginLeft: 8,
                                                                                                    fontWeight: 800,
                                                                                                    color: ourWin
                                                                                                        ? "var(--val-cyan)"
                                                                                                        : "var(--val-red)",
                                                                                                }}
                                                                                            >
                                                                                                {
                                                                                                    ourScore
                                                                                                }
                                                                                            </span>
                                                                                            <span
                                                                                                style={{
                                                                                                    margin: "0 4px",
                                                                                                    opacity: 0.3,
                                                                                                }}
                                                                                            >
                                                                                                -
                                                                                            </span>
                                                                                            <span
                                                                                                style={{
                                                                                                    color: "var(--text-muted)",
                                                                                                }}
                                                                                            >
                                                                                                {
                                                                                                    rivalScore
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                        <span
                                                                                            style={{
                                                                                                fontSize: 10,
                                                                                                color: "var(--text-muted)",
                                                                                            }}
                                                                                        >
                                                                                            ANALÍTICA
                                                                                            →
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            },
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : null}


                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!hasNextPage && events.length > 0 && isListView && (
                                        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: "10px 0" }}>
                                            No hay más eventos programados.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Floating Quick Navigation Indicators */}
                        {upcomingScrollPosition !== "in-view" &&
                            firstUpcomingId &&
                            (() => {
                                const upcomingEv = events.find(
                                    (e) => e.id === firstUpcomingId,
                                );
                                const upcomingColor = upcomingEv
                                    ? upcomingEv.type === "match"
                                        ? "var(--val-match)"
                                        : upcomingEv.type === "playoffs"
                                            ? "var(--val-yellow)"
                                            : "var(--val-practice)"
                                    : "var(--val-practice)";
                                const upcomingGlow = upcomingEv
                                    ? upcomingEv.type === "match"
                                        ? "rgba(133, 107, 77, 0.25)"
                                        : upcomingEv.type === "playoffs"
                                            ? "rgba(234, 180, 8, 0.25)"
                                            : "rgba(184, 184, 184, 0.25)"
                                    : "rgba(184, 184, 184, 0.25)";
                                const upcomingBorder = upcomingEv
                                    ? upcomingEv.type === "match"
                                        ? "rgba(133, 107, 77, 0.4)"
                                        : upcomingEv.type === "playoffs"
                                            ? "rgba(234, 180, 8, 0.4)"
                                            : "rgba(184, 184, 184, 0.4)"
                                    : "rgba(184, 184, 184, 0.4)";

                                return (
                                    <div
                                        onClick={() => {
                                            const card =
                                                eventRefsMap.current[
                                                firstUpcomingId
                                                ];
                                            if (card) {
                                                card.scrollIntoView({
                                                    behavior: "smooth",
                                                    block: "center",
                                                });
                                                setTimeout(
                                                    checkUpcomingScrollPosition,
                                                    600,
                                                );
                                                setActiveHighlightId(
                                                    firstUpcomingId,
                                                );
                                                setTimeout(() => {
                                                    setActiveHighlightId(null);
                                                }, 1200);
                                            }
                                        }}
                                        className="glass-card hover-lift transition-smooth"
                                        style={{
                                            position: "absolute",
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            top:
                                                upcomingScrollPosition ===
                                                    "above"
                                                    ? 20
                                                    : "auto",
                                            bottom:
                                                upcomingScrollPosition ===
                                                    "below"
                                                    ? 20
                                                    : "auto",
                                            padding: "10px 20px",
                                            borderRadius: 30,
                                            border: `1px solid ${upcomingBorder}`,
                                            background: "rgba(10, 11, 20, 0.9)",
                                            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px ${upcomingGlow}`,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            zIndex: 100,
                                            fontSize: 12,
                                            fontWeight: 800,
                                            color: upcomingColor,
                                            letterSpacing: 1,
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {upcomingScrollPosition === "above" ? (
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="19"
                                                    x2="12"
                                                    y2="5"
                                                ></line>
                                                <polyline points="5 12 12 5 19 12"></polyline>
                                            </svg>
                                        ) : (
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="5"
                                                    x2="12"
                                                    y2="19"
                                                ></line>
                                                <polyline points="19 12 12 19 5 12"></polyline>
                                            </svg>
                                        )}
                                        <span>Ver Próximo Evento</span>
                                    </div>
                                );
                            })()}
                    </div>
                )}
            </div>

            {showNew && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowNew(false)}
                >
                    <div
                        className="card glass-card modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 500 }}
                    >
                        <div className="card-header">
                            <h3 className="card-title">Nuevo Evento</h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowNew(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "white",
                                    fontSize: 20,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            <div className="form-group">
                                <label>Título</label>
                                <input
                                    value={form.title}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="Ej: Premier Semana 3"
                                />
                            </div>
                            <div
                                className="form-row"
                                style={{ display: "flex", gap: 12 }}
                            >
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Tipo</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                type: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="custom">
                                            Personalizado (Custom)
                                        </option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Mapa</label>
                                    <select
                                        value={form.map}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                map: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Sin definir</option>
                                        {maps
                                            .filter(
                                                (m) => m.tacticalDescription,
                                            )
                                            .map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            <div
                                className="form-row"
                                style={{ display: "flex", gap: 12 }}
                            >
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Fecha</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                date: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Hora</label>
                                    <input
                                        type="time"
                                        value={form.time}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                time: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            description: e.target.value,
                                        })
                                    }
                                    rows={2}
                                    placeholder="Opcional..."
                                />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    marginTop: 8,
                                }}
                            >
                                <button
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setShowNew(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={createEvent}
                                >
                                    Crear Evento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExport && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowExport(false)}
                >
                    <div
                        className="card glass-card modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 500 }}
                    >
                        <div className="card-header">
                            <h3 className="card-title">
                                Sincronizar Calendario
                            </h3>
                            <button
                                className="btn-icon"
                                onClick={() => setShowExport(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "white",
                                    fontSize: 20,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                marginBottom: 20,
                                borderBottom: "1px solid var(--border-color)",
                                paddingBottom: 12,
                            }}
                        >
                            <button
                                className={`btn btn-sm ${exportTab === "personal" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => setExportTab("personal")}
                            >
                                👤 Mi Calendario
                            </button>
                            <button
                                className={`btn btn-sm ${exportTab === "team" ? "btn-primary" : "btn-ghost"}`}
                                onClick={() => setExportTab("team")}
                            >
                                👥 Equipo
                            </button>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 20,
                            }}
                        >
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.6,
                                }}
                            >
                                {exportTab === "team"
                                    ? "Sincroniza todos los eventos del equipo directamente con tu aplicación de calendario favorita."
                                    : "Este calendario está personalizado para ti: solo se mostrarán los eventos en los que has jugado o en los que tienes disponibilidad 'Sí' (✅) o 'Duda' (⚠️)."}
                            </p>

                            {/* Botones de Suscripción en 1 Clic */}
                            {isMounted &&
                                (exportTab === "team"
                                    ? calendarToken
                                    : userCalendarToken) && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            marginTop: 4,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                color: "var(--text-secondary)",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            Añadir al instante:
                                        </span>
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "repeat(auto-fit, minmax(130px, 1fr))",
                                                gap: 8,
                                            }}
                                        >
                                            {/* Apple Calendar (Usa webcal:// para abrir la App de iOS/macOS) */}
                                            <a
                                                href={`${origin.replace(/^https?:/, "webcal:")}/api/calendar/${exportTab === "team" ? "" : "user/"}${exportTab === "team" ? calendarToken : userCalendarToken}`}
                                                className="btn btn-sm btn-ghost hover-lift transition-smooth"
                                                style={{
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    background:
                                                        "rgba(255,255,255,0.01)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 8,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: "white",
                                                }}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="14"
                                                    height="14"
                                                    fill="currentColor"
                                                    style={{ flexShrink: 0 }}
                                                >
                                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z" />
                                                </svg>
                                                Apple Calendar
                                            </a>

                                            {/* Google Calendar (Web subscription link) */}
                                            <a
                                                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
                                                    `${origin.replace(/^https?:/, "webcal:")}/api/calendar/${exportTab === "team" ? "" : "user/"}${exportTab === "team" ? calendarToken : userCalendarToken}`,
                                                )}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-ghost hover-lift transition-smooth"
                                                style={{
                                                    border: "1px solid rgba(0, 212, 170, 0.2)",
                                                    background:
                                                        "rgba(0, 212, 170, 0.03)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 8,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: "var(--val-cyan)",
                                                }}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="14"
                                                    height="14"
                                                    style={{ flexShrink: 0 }}
                                                >
                                                    <path
                                                        fill="#4285F4"
                                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                    />
                                                    <path
                                                        fill="#34A853"
                                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                    />
                                                    <path
                                                        fill="#FBBC05"
                                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
                                                    />
                                                    <path
                                                        fill="#EA4335"
                                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                                    />
                                                </svg>
                                                Google Calendar
                                            </a>

                                            {/* Outlook (Web subscription links) */}
                                            <a
                                                href={`https://outlook.live.com/calendar/addcalendar?url=${encodeURIComponent(
                                                    `${origin}/api/calendar/${exportTab === "team" ? "" : "user/"}${exportTab === "team" ? calendarToken : userCalendarToken}`,
                                                )}&name=${encodeURIComponent(exportTab === "team" ? "VHUB Equipo" : "VHUB Personal")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-ghost hover-lift transition-smooth"
                                                style={{
                                                    border: "1px solid rgba(59, 130, 246, 0.2)",
                                                    background:
                                                        "rgba(59, 130, 246, 0.03)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 8,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: "#3B82F6",
                                                }}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="14"
                                                    height="14"
                                                    style={{ flexShrink: 0 }}
                                                    fill="none"
                                                >
                                                    <rect
                                                        x="2"
                                                        y="4"
                                                        width="20"
                                                        height="16"
                                                        rx="2"
                                                        fill="#0078D4"
                                                    />
                                                    <rect
                                                        x="2"
                                                        y="4"
                                                        width="20"
                                                        height="4"
                                                        rx="1"
                                                        fill="#005A9E"
                                                    />
                                                    <rect
                                                        x="5"
                                                        y="10"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                    />
                                                    <rect
                                                        x="10"
                                                        y="10"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                        opacity="0.75"
                                                    />
                                                    <rect
                                                        x="15"
                                                        y="10"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                        opacity="0.75"
                                                    />
                                                    <rect
                                                        x="5"
                                                        y="15"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                        opacity="0.75"
                                                    />
                                                    <rect
                                                        x="10"
                                                        y="15"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                        opacity="0.75"
                                                    />
                                                    <rect
                                                        x="15"
                                                        y="15"
                                                        width="4"
                                                        height="4"
                                                        rx="0.5"
                                                        fill="#FFFFFF"
                                                        opacity="0.75"
                                                    />
                                                </svg>
                                                Outlook / O365
                                            </a>
                                        </div>
                                    </div>
                                )}

                            {/* Separador visual "o" */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    margin: "8px 0",
                                    color: "var(--text-muted)",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: 1.5,
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background:
                                            "linear-gradient(to right, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.08))",
                                    }}
                                />
                                <span
                                    style={{ padding: "0 12px", opacity: 0.5 }}
                                >
                                    o
                                </span>
                                <div
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background:
                                            "linear-gradient(to left, transparent, rgba(255,255,255,0.08), rgba(255,255,255,0.08))",
                                    }}
                                />
                            </div>

                            {/* Enlace iCal para Suscripción Manual */}
                            <div className="form-group">
                                <label>
                                    {exportTab === "team"
                                        ? "Dirección iCal del Equipo"
                                        : "Mi Dirección iCal Personal"}
                                </label>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        marginBottom: 8,
                                    }}
                                >
                                    <input
                                        readOnly
                                        value={
                                            !isMounted ||
                                                (exportTab === "team"
                                                    ? !calendarToken
                                                    : !userCalendarToken)
                                                ? "Cargando enlace..."
                                                : `${origin}/api/calendar/${exportTab === "team" ? "" : "user/"}${exportTab === "team" ? calendarToken : userCalendarToken}`
                                        }
                                        style={{
                                            flex: 1,
                                            background: "rgba(0,0,0,0.3)",
                                            color: (
                                                exportTab === "team"
                                                    ? calendarToken
                                                    : userCalendarToken
                                            )
                                                ? "var(--val-cyan)"
                                                : "var(--text-muted)",
                                            fontWeight: 600,
                                        }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={
                                            exportTab === "team"
                                                ? !calendarToken
                                                : !userCalendarToken
                                        }
                                        onClick={() => {
                                            const token =
                                                exportTab === "team"
                                                    ? calendarToken
                                                    : userCalendarToken;
                                            const path =
                                                exportTab === "team"
                                                    ? ""
                                                    : "user/";
                                            if (token) {
                                                navigator.clipboard.writeText(
                                                    `${origin}/api/calendar/${path}${token}`,
                                                );
                                                alert("¡Enlace copiado!");
                                            }
                                        }}
                                    >
                                        Copiar
                                    </button>

                                    {/* Botón de Regenerar junto con el enlace */}
                                    {(exportTab === "personal" ||
                                        canManage) && (
                                            <button
                                                className="btn btn-ghost"
                                                style={{
                                                    padding: "0 12px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "var(--val-red)",
                                                    border: "1px solid rgba(133, 107, 77, 0.2)",
                                                    background:
                                                        "rgba(133, 107, 77, 0.03)",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onClick={() =>
                                                    regenerateToken(exportTab)
                                                }
                                                disabled={
                                                    isRegenerating ||
                                                    (exportTab === "team"
                                                        ? !calendarToken
                                                        : !userCalendarToken)
                                                }
                                                title={
                                                    exportTab === "team"
                                                        ? "Regenerar Enlace de Seguridad del Equipo"
                                                        : "Regenerar Enlace de Seguridad Personal"
                                                }
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="14"
                                                    height="14"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{
                                                        flexShrink: 0,
                                                        animation: isRegenerating
                                                            ? "spin 1s linear infinite"
                                                            : "none",
                                                    }}
                                                >
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.72" />
                                                </svg>
                                            </button>
                                        )}
                                </div>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-muted)",
                                        lineHeight: 1.4,
                                        margin: 0,
                                    }}
                                >
                                    Copia esta dirección para agregar y mantener
                                    sincronizado el calendario en otras
                                    aplicaciones compatibles (como Thunderbird,
                                    etc.) o importarlo manualmente.
                                </p>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-muted)",
                                        lineHeight: 1.4,
                                        marginTop: 6,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    {exportTab === "team" ? (
                                        canManage ? (
                                            <>
                                                <span style={{ fontSize: 12 }}>
                                                    ⚠️
                                                </span>
                                                <span>
                                                    Como administrador, puedes
                                                    usar el botón de refresco
                                                    rojo para invalidar el
                                                    enlace actual del equipo y
                                                    generar uno nuevo.
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: 12 }}>
                                                    🔒
                                                </span>
                                                <span>
                                                    Solo los administradores del
                                                    equipo pueden regenerar el
                                                    enlace de seguridad del
                                                    equipo.
                                                </span>
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <span style={{ fontSize: 12 }}>
                                                🔄
                                            </span>
                                            <span>
                                                Puedes usar el botón de refresco
                                                rojo para invalidar tu enlace
                                                actual si sospechas que alguien
                                                más lo tiene.
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>

                            <div
                                className="glass-card"
                                style={{
                                    padding: 16,
                                    background: "rgba(255,255,255,0.02)",
                                    borderRadius: 12,
                                }}
                            >
                                <h4
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 800,
                                        marginBottom: 8,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    Instrucciones manuales:
                                </h4>
                                <ul
                                    style={{
                                        fontSize: 12,
                                        color: "var(--text-muted)",
                                        paddingLeft: 20,
                                        lineHeight: 1.8,
                                    }}
                                >
                                    <li>
                                        <strong>Google Calendar:</strong> Añadir
                                        → "Desde URL".
                                    </li>
                                    <li>
                                        <strong>Apple Calendar:</strong> Archivo
                                        → "Nueva suscripción a calendario".
                                    </li>
                                    <li>
                                        <strong>Outlook:</strong> Añadir
                                        calendario → "Desde Internet".
                                    </li>
                                </ul>
                            </div>

                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowExport(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {selectedEventId &&
                (() => {
                    const ev = events.find((e) => e.id === selectedEventId);
                    if (!ev) return null;
                    const ea = avail[ev.id] || [];
                    const matches = ev.linkedMatches || [];
                    const hasPlayed = ev.status === "completed" || matches.length > 0;
                    const confirmed = ea.filter(
                        (a) =>
                            a.status === "available" || a.status === "played",
                    ).length;
                    const maybeCount = ea.filter(
                        (a) => a.status === "maybe",
                    ).length;
                    const myStatus =
                        ea.find(
                            (a) => String(a.player_id) === String(myPlayerId),
                        )?.status || "pending";
                    const isPast =
                        isMounted && (ev as any).localDate < todayStr;
                    const isCancelled = ev.status === "cancelled";
                    const isNoPlayers = ev.status === "no_players";
                    const isNotPlayed = ev.status === "not_played";
                    const unavailable = ea.filter(
                        (a) => a.status === "unavailable",
                    ).length;
                    const isImpossible =
                        isMounted &&
                        !isPast &&
                        players.length >= 5 &&
                        players.length - unavailable < 5;


                    const isRed =
                        isCancelled ||
                        isNoPlayers ||
                        isNotPlayed ||
                        isImpossible;
                    const evColorBase =
                        ev.type === "playoffs"
                            ? "var(--val-yellow)"
                            : ev.type === "match"
                                ? "var(--val-match)"
                                : "var(--val-practice)";
                    const evColor =
                        isRed || myStatus === "unavailable"
                            ? "rgba(255,255,255,0.05)"
                            : evColorBase;
                    const mapObj = ev.map_obj;

                    return (
                        <div
                            className="modal-overlay"
                            onClick={() => setSelectedEventId(null)}
                        >
                            <div
                                className="card glass-card modal-content animate-scale-in"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    maxWidth: 450,
                                    padding: 0,
                                    overflow: "hidden",
                                    border: `1px solid var(--border-color)`,
                                }}
                            >
                                <div
                                    style={{
                                        position: "relative",
                                        height: 160,
                                        backgroundColor:
                                            isRed || myStatus === "unavailable"
                                                ? "rgba(0,0,0,0.5)"
                                                : myStatus === "pending"
                                                    ? "rgba(10, 11, 20, 0.6)"
                                                    : evColorBase,
                                        display: "flex",
                                        alignItems: "end",
                                        padding: 24,
                                        boxShadow: `inset 0 -60px 80px -20px #0a0b14, inset 0 0 100px ${isRed ||
                                            myStatus === "unavailable" ||
                                            myStatus === "pending"
                                            ? "transparent"
                                            : evColorBase
                                            }44`,
                                        borderBottom: `2px solid ${myStatus === "pending"
                                            ? "rgba(255,255,255,0.1)"
                                            : evColorBase
                                            }`,
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* Playoffs Collage Background */}
                                    {ev.type === "playoffs" &&
                                        (() => {
                                            const seasonMaps =
                                                getSeasonMaps(ev);
                                            return renderDiagonalMapSplash(
                                                seasonMaps,
                                                isRed ||
                                                    myStatus === "unavailable"
                                                    ? 0.2
                                                    : myStatus === "pending"
                                                        ? 0.75
                                                        : 0.45,
                                            );
                                        })()}

                                    {/* Match or Practice Splash Background */}
                                    {ev.type !== "playoffs" &&
                                        mapObj?.splash && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    backgroundImage: `url(${mapObj.splash})`,
                                                    backgroundSize: "cover",
                                                    backgroundPosition:
                                                        "center",
                                                    opacity:
                                                        isRed ||
                                                            myStatus ===
                                                            "unavailable"
                                                            ? 0.25
                                                            : myStatus ===
                                                                "pending"
                                                                ? 0.8
                                                                : 0.45,
                                                    pointerEvents: "none",
                                                    zIndex: 0,
                                                }}
                                            />
                                        )}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            background: `linear-gradient(to top, #0a0b14 0%, transparent 100%), radial-gradient(circle at center, ${evColor}22 0%, transparent 70%)`,
                                            zIndex: 1,
                                        }}
                                    />
                                    <button
                                        onClick={() => setSelectedEventId(null)}
                                        style={{
                                            position: "absolute",
                                            top: 16,
                                            right: 16,
                                            background: "rgba(0,0,0,0.3)",
                                            border: "none",
                                            color: "white",
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            cursor: "pointer",
                                            zIndex: 10,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 18,
                                        }}
                                    >
                                        ✕
                                    </button>
                                    <div style={{ zIndex: 1, width: "100%" }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <span
                                                className={`tag ${ev.type === "match" ? "tag-match" : ev.type === "playoffs" ? "tag-gold" : "tag-practice"} ${(myStatus === "available" || myStatus === "maybe") ? "tag-solid" : ""}`}
                                            >
                                                {ev.type === "match"
                                                    ? "Partido"
                                                    : ev.type === "playoffs"
                                                        ? "Playoffs"
                                                        : "Práctica"}
                                            </span>
                                            {ev.season?.name && (
                                                <span
                                                    className="tag tag-neutral"
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        background: "rgba(255,255,255,0.05)"
                                                    }}
                                                >
                                                    {ev.season.name}
                                                </span>
                                            )}
                                        </div>
                                        <h2
                                            style={{
                                                fontSize: 24,
                                                fontWeight: 800,
                                                color: "white",
                                                margin: 0,
                                                textShadow:
                                                    "0 2px 10px rgba(0,0,0,0.5)",
                                            }}
                                        >
                                            {getEventDisplayName(ev)}
                                        </h2>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        padding: 24,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 24,
                                    }}
                                >
                                    {(isCancelled ||
                                        isNoPlayers ||
                                        isNotPlayed ||
                                        isImpossible) && (
                                            <div
                                                style={{
                                                    padding: "12px 16px",
                                                    borderRadius: 8,
                                                    background:
                                                        "rgba(133, 107, 77, 0.06)",
                                                    border: "1px solid rgba(133, 107, 77, 0.2)",
                                                    color: "var(--val-red)",
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    boxShadow:
                                                        "0 4px 20px rgba(133, 107, 77, 0.05)",
                                                }}
                                            >
                                                <span style={{ fontSize: 16 }}>
                                                    ⚠️
                                                </span>
                                                <span>
                                                    {isCancelled &&
                                                        "Cancelado: Ya se jugaron 2 partidos esta semana."}
                                                    {isNoPlayers &&
                                                        "Sin asistencia: No hay suficientes jugadores confirmados."}
                                                    {isNotPlayed &&
                                                        "No jugado: Evento cancelado/no disputado."}
                                                    {isImpossible &&
                                                        ev.status === "scheduled" &&
                                                        "Imposible: Falta de jugadores (mínimo 5 confirmados)."}
                                                </span>
                                            </div>
                                        )}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 12,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                color: "var(--text-secondary)",
                                                fontSize: 14,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background:
                                                        "rgba(255,255,255,0.05)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                >
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                    />
                                                    <path d="M12 6v6l4 2" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {new Date(
                                                        `${ev.date}T00:00:00`,
                                                    ).toLocaleDateString(
                                                        "es-ES",
                                                        {
                                                            weekday: "long",
                                                            day: "numeric",
                                                            month: "long",
                                                        },
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12 }}>
                                                    {ev.localTime}{" "}
                                                    {ev.localEndTime &&
                                                        `— ${ev.localEndTime}`}
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                color: "var(--text-secondary)",
                                                fontSize: 14,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background:
                                                        "rgba(255,255,255,0.05)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                >
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                    <circle
                                                        cx="12"
                                                        cy="10"
                                                        r="3"
                                                    />
                                                </svg>
                                            </div>
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                {ev.map
                                                    ? ev.map_obj?.name || ev.map
                                                    : ev.type === "playoffs"
                                                        ? "Pick & Ban"
                                                        : "Por decidir"}
                                            </div>
                                        </div>
                                    </div>

                                    {ev.description && (
                                        <div
                                            style={{
                                                padding: "12px 16px",
                                                borderRadius: 12,
                                                background:
                                                    "rgba(255,255,255,0.02)",
                                                border: "1px solid var(--border-color)",
                                                fontSize: 14,
                                                color: "var(--text-muted)",
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            {ev.description}
                                        </div>
                                    )}

                                    {ev.linkedMatches &&
                                        ev.linkedMatches.length > 0 && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 10,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 800,
                                                        color: "var(--text-muted)",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: 1,
                                                    }}
                                                >
                                                    Partidas Vinculadas (
                                                    {ev.linkedMatches.length}):
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 8,
                                                    }}
                                                >
                                                    {ev.linkedMatches.map(
                                                        (m: any, mIdx: number) => {
                                                            const isBlue =
                                                                m.our_team_side ===
                                                                "Blue";
                                                            const isWin = isBlue
                                                                ? m.team_blue_won
                                                                : !m.team_blue_won;
                                                            const ourScore =
                                                                isBlue
                                                                    ? m.team_blue_score
                                                                    : m.team_red_score;
                                                            const rivalScore =
                                                                isBlue
                                                                    ? m.team_red_score
                                                                    : m.team_blue_score;
                                                            return (
                                                                <div
                                                                    key={m.id}
                                                                    style={{
                                                                        padding:
                                                                            "10px 14px",
                                                                        borderRadius: 10,
                                                                        background:
                                                                            "rgba(255,255,255,0.03)",
                                                                        border: `1px solid ${isWin ? "rgba(0,255,163,0.2)" : "rgba(133, 107, 77, 0.2)"}`,
                                                                        display:
                                                                            "flex",
                                                                        justifyContent:
                                                                            "space-between",
                                                                        alignItems:
                                                                            "center",
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 8,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                width: 8,
                                                                                height: 8,
                                                                                borderRadius:
                                                                                    "50%",
                                                                                background:
                                                                                    isWin
                                                                                        ? "var(--val-cyan)"
                                                                                        : "var(--val-red)",
                                                                            }}
                                                                        />
                                                                        <span
                                                                            style={{
                                                                                fontWeight: 700,
                                                                                fontSize: 13,
                                                                            }}
                                                                        >
                                                                            {
                                                                                m.map_name
                                                                            }
                                                                        </span>
                                                                        {ev.type === "playoffs" && (
                                                                            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--val-yellow)", fontWeight: 800, textTransform: "uppercase", background: "rgba(234, 180, 8, 0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                                                                {mIdx === 0 ? "Cuartos" : mIdx === 1 ? "Semis" : "Final"}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            fontWeight: 800,
                                                                            fontSize: 14,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                color: isWin
                                                                                    ? "var(--val-cyan)"
                                                                                    : "var(--val-red)",
                                                                            }}
                                                                        >
                                                                            {
                                                                                ourScore
                                                                            }
                                                                        </span>
                                                                        <span
                                                                            style={{
                                                                                margin: "0 4px",
                                                                                opacity: 0.3,
                                                                            }}
                                                                        >
                                                                            —
                                                                        </span>
                                                                        <span
                                                                            style={{
                                                                                color: "var(--text-muted)",
                                                                            }}
                                                                        >
                                                                            {
                                                                                rivalScore
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    <div
                                        className="glass-card"
                                        style={{
                                            background:
                                                "rgba(255,255,255,0.01)",
                                            borderRadius: 16,
                                            padding: 20,
                                            border: "1px solid var(--border-color)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: 16,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 1.5,
                                                    color: "var(--text-muted)",
                                                }}
                                            >
                                                Asistencia ({confirmed}/5)
                                            </span>
                                            <div
                                                className="progress-bar"
                                                style={{
                                                    width: 80,
                                                    height: 6,
                                                    display: "flex",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <div
                                                    className="progress-fill progress-fill-cyan transition-smooth"
                                                    style={{
                                                        width: `${Math.min((confirmed / 5) * 100, 100)}%`,
                                                    }}
                                                />
                                                <div
                                                    className="progress-fill progress-fill-maybe transition-smooth"
                                                    style={{
                                                        width: `${Math.min((maybeCount / 5) * 100, Math.max(0, 100 - (confirmed / 5) * 100))}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                justifyContent: "center",
                                                gap: 12,
                                            }}
                                        >
                                            {[...players].sort((a, b) => {
                                                const order: Record<string, number> = { played: 1, available: 2, maybe: 3, pending: 4, unavailable: 5 };
                                                const stA = ea.find(att => att.player_id === a.id)?.status || "pending";
                                                const stB = ea.find(att => att.player_id === b.id)?.status || "pending";
                                                if (order[stA] !== order[stB]) return (order[stA] || 6) - (order[stB] || 6);
                                                return (a.name || "").localeCompare(b.name || "");
                                            }).map((p) => {
                                                const ps =
                                                    ea.find(
                                                        (a) =>
                                                            a.player_id ===
                                                            p.id,
                                                    )?.status || "pending";
                                                return (
                                                    <Link
                                                        href={`/player/${p.id}`}
                                                        key={p.id}
                                                        title={p.name}
                                                        style={{
                                                            textDecoration: "none", color: "inherit",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            gap: 6,
                                                            width: 60,
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                position: "relative",
                                                                width: 36,
                                                                height: 36,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    borderRadius: "50%",
                                                                    background: p.avatar_color,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontSize: 14,
                                                                    fontWeight: 800,
                                                                    color: "white",
                                                                    border: `2px solid ${ps === "played"
                                                                        ? "var(--val-purple)"
                                                                        : ps === "available"
                                                                            ? "var(--val-cyan)"
                                                                            : ps === "maybe"
                                                                                ? "var(--val-yellow)"
                                                                                : ps === "unavailable"
                                                                                    ? "var(--val-red)"
                                                                                    : "rgba(255,255,255,0.1)"
                                                                        }`,
                                                                    boxShadow:
                                                                        ps !== "pending"
                                                                            ? `0 0 10px ${ps === "played" ? "var(--val-purple)" : ps === "available" ? "var(--val-cyan)" : ps === "maybe" ? "var(--val-yellow)" : "var(--val-red)"}44`
                                                                            : "none",
                                                                    opacity: ps !== "pending" ? 1 : 0.4,
                                                                    transition: "all 0.3s ease",
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                {p.image ? (
                                                                    <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                ) : (
                                                                    p.name[0]
                                                                )}
                                                            </div>
                                                            {/* Status Emblem Indicator */}
                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    bottom: -2,
                                                                    right: -2,
                                                                    width: 14,
                                                                    height: 14,
                                                                    borderRadius: "50%",
                                                                    background:
                                                                        ps === "played"
                                                                            ? "var(--val-purple)"
                                                                            : ps === "available"
                                                                                ? "var(--val-cyan)"
                                                                                : ps === "maybe"
                                                                                    ? "var(--val-yellow)"
                                                                                    : ps === "unavailable"
                                                                                        ? "var(--val-red)"
                                                                                        : "rgba(255,255,255,0.15)",
                                                                    border: "2px solid #11141b",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontSize: 8,
                                                                    fontWeight: 900,
                                                                    color: ps === "maybe" ? "black" : "white",
                                                                    boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                                                                }}
                                                            >
                                                                {ps === "played"
                                                                    ? "🎮"
                                                                    : ps === "available"
                                                                        ? "✓"
                                                                        : ps === "maybe"
                                                                            ? "?"
                                                                            : ps === "unavailable"
                                                                                ? "✗"
                                                                                : "•"}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: 9,
                                                                color: "var(--text-muted)",
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            {p.name.split(" ")[0]}
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>

                                        {/* Legend Row inside Modal */}
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginTop: 14,
                                                paddingTop: 12,
                                                borderTop: "1px solid rgba(255,255,255,0.05)",
                                                justifyContent: "space-between",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "var(--text-muted)",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            {hasPlayed && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                    <span
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: "50%",
                                                            background: "var(--val-purple)",
                                                            boxShadow: "0 0 6px var(--val-purple)",
                                                        }}
                                                    />
                                                    <span style={{ color: "var(--val-purple)" }}>
                                                        {ea.filter((a) => a.status === "played").length} Jugaron
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: "var(--val-cyan)",
                                                        boxShadow: "0 0 6px var(--val-cyan)",
                                                    }}
                                                />
                                                <span>{confirmed} Sí</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: "var(--val-yellow)",
                                                        boxShadow: "0 0 6px var(--val-yellow)",
                                                    }}
                                                />
                                                <span>{maybeCount} Duda</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: "var(--val-red)",
                                                        boxShadow: "0 0 6px var(--val-red)",
                                                    }}
                                                />
                                                <span>{unavailable} No</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: "rgba(255,255,255,0.25)",
                                                    }}
                                                />
                                                <span>
                                                    {players.length - confirmed - maybeCount - unavailable} Pendiente
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {myPlayerId && !isPast && ev.status !== "completed" && (
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 10,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                    color: "var(--text-muted)",
                                                    textTransform: "uppercase",
                                                    letterSpacing: 1,
                                                }}
                                            >
                                                Tu disponibilidad:
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 8,
                                                }}
                                            >
                                                <button
                                                    className={`btn btn-sm ${myStatus === "available" ? "btn-primary" : "btn-secondary"}`}
                                                    onClick={() =>
                                                        setAvailability(
                                                            ev.id,
                                                            myStatus === "available" ? "pending" : "available",
                                                        )
                                                    }
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 10,
                                                    }}
                                                >
                                                    SÍ ✅
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${myStatus === "maybe" ? "btn-primary" : "btn-secondary"}`}
                                                    onClick={() =>
                                                        setAvailability(
                                                            ev.id,
                                                            myStatus === "maybe" ? "pending" : "maybe",
                                                        )
                                                    }
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 10,
                                                    }}
                                                >
                                                    DUDA ⚠️
                                                </button>
                                                <button
                                                    className={`btn btn-sm ${myStatus === "unavailable" ? "btn-primary" : "btn-secondary"}`}
                                                    onClick={() =>
                                                        setAvailability(
                                                            ev.id,
                                                            myStatus === "unavailable" ? "pending" : "unavailable",
                                                        )
                                                    }
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 10,
                                                    }}
                                                >
                                                    NO ❌
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {canManage && ev.type === "custom" && (
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{
                                                    color: "var(--val-red)",
                                                    opacity: 0.6,
                                                    fontSize: 11,
                                                }}
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            "¿Estás seguro de borrar este evento?",
                                                        )
                                                    ) {
                                                        deleteEvent(ev.id);
                                                        setSelectedEventId(
                                                            null,
                                                        );
                                                    }
                                                }}
                                            >
                                                🗑️ Eliminar Evento
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}
        </div>
    );
}

