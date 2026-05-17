/* eslint-disable no-undef */
"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";

interface Player {
    id: number;
    name: string;
    riot_name: string;
    riot_tag: string;
    role: string;
    avatar_color: string;
}
interface ModeStats {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    kdRatio: number;
    kdaRatio: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgACS: number;
    avgADR: number;
    headshotPct: number;
    mostPlayedAgent: string;
    mostPlayedMap: string;
    recentForm: string[];
    agentStats: Record<
        string,
        { agent: string; games: number; wins: number; winRate: number }
    >;
    mapStats: Record<
        string,
        {
            map: string;
            games: number;
            wins: number;
            winRate: number;
            avgKills: number;
            avgDeaths: number;
        }
    >;
}
interface DeathmatchStats {
    gamesPlayed: number;
    totalKills: number;
    totalDeaths: number;
    kdRatio: number;
    avgKills: number;
    avgDeaths: number;
    mostPlayedAgent: string;
    mostPlayedMap: string;
    agentStats: Record<
        string,
        { agent: string; games: number; avgKills: number; avgDeaths: number }
    >;
}
interface PlayerStatsGroup {
    name: string;
    competitive: ModeStats | null;
    premier: ModeStats | null;
    standard: ModeStats | null;
    others: ModeStats | null;
    deathmatch: DeathmatchStats | null;
}
interface MMR {
    currenttierpatched: string;
    ranking_in_tier: number;
    mmr_change_to_last_game: number;
    elo: number;
}
interface Match {
    metadata: {
        map: string;
        game_start_patched: string;
        rounds_played: number;
        mode: string;
        matchid: string;
    };
    players: {
        all_players: Array<{
            name: string;
            tag: string;
            character: string;
            team: string;
            stats: {
                kills: number;
                deaths: number;
                assists: number;
                score: number;
                headshots: number;
            };
            damage_made: number;
        }>;
    };
    teams: {
        red: { has_won: boolean; rounds_won: number; rounds_lost: number };
        blue: { has_won: boolean; rounds_won: number; rounds_lost: number };
    };
}
interface PlayerData {
    stats: PlayerStatsGroup;
    mmr: MMR | null;
    matches: Match[];
    seasons?: Array<{ id: string; name: string }>;
    mock: boolean;
}

export default function StatsPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [selected, setSelected] = useState<Player | null>(null);
    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"competitive" | "premier" | "standard" | "others" | "deathmatch">("competitive");
    const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedSeason, setSelectedSeason] = useState<string>("all");

    useEffect(() => {
        fetch("/api/players")
            .then((r) => r.json())
            .then((d) => setPlayers(d.players || []));
    }, []);

    const loadStats = async (p: Player, season: string = "all") => {
        setSelected(p);
        setLoading(true);
        setError(null);
        if (season === "all") {
            setData(null);
            setSeasons([]);
        }
        const name = p.riot_name || p.name;
        const tag = p.riot_tag || "EUW";
        try {
            const res = await fetch(
                `/api/valorant?action=stats&name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&season=${season}`,
            );
            const d = await res.json();

            if (d.error) {
                if (d.error.includes("401")) {
                    throw new Error(
                        "La Riot API Key ha caducado o es inválida. Por favor, renuévala en el .env",
                    );
                }
                if (d.error.includes("429")) {
                    throw new Error(
                        "Demasiadas solicitudes a Riot. Espera un minuto y vuelve a intentarlo.",
                    );
                }
                throw new Error(d.message || d.error);
            }

            setData(d);
            if (d.seasons) {
                setSeasons(d.seasons);
            }
            if (d.stats) {
                if (d.stats.competitive && d.stats.competitive.gamesPlayed > 0) {
                    setActiveTab("competitive");
                } else if (d.stats.premier && d.stats.premier.gamesPlayed > 0) {
                    setActiveTab("premier");
                } else if (d.stats.standard && d.stats.standard.gamesPlayed > 0) {
                    setActiveTab("standard");
                } else if (d.stats.others && d.stats.others.gamesPlayed > 0) {
                    setActiveTab("others");
                } else if (d.stats.deathmatch && d.stats.deathmatch.gamesPlayed > 0) {
                    setActiveTab("deathmatch");
                } else {
                    setActiveTab("competitive");
                }
            }
        } catch (err) {
            console.error("Error al cargar estadísticas:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Error desconocido al cargar estadísticas",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSeasonChange = async (seasonId: string) => {
        setSelectedSeason(seasonId);
        if (selected) {
            await loadStats(selected, seasonId);
        }
    };


    return (
        <>
            <div
                className="page-header hero-gradient"
                style={{
                    borderBottom: "none",
                    background: "transparent",
                    padding: "24px 0",
                    flexShrink: 0,
                }}
            >
                <h1
                    className="gradient-text"
                    style={{ fontSize: 32, fontWeight: 800 }}
                >
                    Estadísticas
                </h1>
                <p style={{ fontSize: 14, marginTop: 4 }}>
                    Análisis de rendimiento del equipo
                </p>
            </div>
            <div className="page-content animate-in">
                {/* Selector de Jugador */}
                <div
                    className="card glass-card"
                    style={{ marginBottom: 24, padding: "16px" }}
                >
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {players.map((p) => (
                            <button
                                key={p.id}
                                className={`btn ${selected?.id === p.id ? "btn-primary" : "btn-secondary"} hover-lift`}
                                onClick={() => loadStats(p)}
                                style={{
                                    borderColor:
                                        selected?.id === p.id
                                            ? p.avatar_color
                                            : undefined,
                                    boxShadow:
                                        selected?.id === p.id
                                            ? `0 0 15px ${p.avatar_color}44`
                                            : undefined,
                                }}
                            >
                                <div
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        background: p.avatar_color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        color: "#fff",
                                        fontWeight: 800,
                                        boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                                    }}
                                >
                                    {p.name[0]}
                                </div>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                {!selected && (
                    <div
                        style={{
                            textAlign: "center",
                            padding: 60,
                            color: "var(--text-muted)",
                        }}
                    >
                        <p style={{ fontSize: 48, marginBottom: 12 }}>📊</p>
                        <p>Selecciona un jugador para ver sus estadísticas</p>
                    </div>
                )}

                {loading && (
                    <div className="animate-fade-in">
                        {/* MMR Skeleton */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                marginBottom: 24,
                            }}
                        >
                            <Skeleton width={60} height={60} circle />
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                <Skeleton width={120} height={20} />
                                <Skeleton width={180} height={14} />
                            </div>
                        </div>

                        {/* Key Stats Skeleton */}
                        <div
                            className="grid grid-4"
                            style={{ marginBottom: 16 }}
                        >
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="card"
                                    style={{ textAlign: "center" }}
                                >
                                    <Skeleton
                                        width="60%"
                                        height={28}
                                        style={{ margin: "0 auto 8px" }}
                                    />
                                    <Skeleton
                                        width="40%"
                                        height={12}
                                        style={{ margin: "0 auto" }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div
                            className="grid grid-2"
                            style={{ marginBottom: 16 }}
                        >
                            <div className="card">
                                <Skeleton
                                    width={150}
                                    height={18}
                                    style={{ marginBottom: 16 }}
                                />
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 12,
                                    }}
                                >
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton
                                            key={i}
                                            width="100%"
                                            height={14}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="card">
                                <Skeleton
                                    width={120}
                                    height={18}
                                    style={{ marginBottom: 16 }}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 6,
                                        marginBottom: 12,
                                    }}
                                >
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton
                                            key={i}
                                            width={24}
                                            height={24}
                                        />
                                    ))}
                                </div>
                                <Skeleton
                                    width={100}
                                    height={14}
                                    style={{ marginTop: 16, marginBottom: 8 }}
                                />
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton
                                        key={i}
                                        width="100%"
                                        height={20}
                                        style={{ margin: "8px 0" }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div
                        className="card glass-card animate-fade-in"
                        style={{
                            border: error.includes("consentimiento") ? "1px solid rgba(168,85,247,0.3)" : "1px solid var(--val-red)",
                            background: error.includes("consentimiento") ? "rgba(168,85,247,0.03)" : "rgba(255,70,85,0.03)",
                            textAlign: "center",
                            padding: "40px 32px",
                            borderRadius: 16,
                            boxShadow: error.includes("consentimiento") ? "0 8px 32px rgba(168,85,247,0.05)" : "0 8px 32px rgba(255,70,85,0.05)",
                        }}
                    >
                        <p style={{ fontSize: 48, marginBottom: 16 }}>
                            {error.includes("consentimiento") ? "🔒" : "⚠️"}
                        </p>
                        <h4
                            style={{
                                color: error.includes("consentimiento") ? "var(--val-purple)" : "var(--val-red)",
                                fontSize: 20,
                                fontWeight: 700,
                                marginBottom: 12
                            }}
                        >
                            {error.includes("consentimiento") ? "Privacidad de Datos" : "Error al cargar datos"}
                        </h4>
                        <p
                            style={{
                                color: "var(--text-primary)",
                                fontSize: 15,
                                lineHeight: 1.6,
                                maxWidth: 480,
                                margin: "0 auto 20px",
                                opacity: 0.9
                            }}
                        >
                            {error}
                        </p>
                        {error.includes("consentimiento") && (
                            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 420, margin: "0 auto" }}>
                                El jugador puede habilitar el uso compartido de sus estadísticas activando el consentimiento en su pestaña de <strong>Perfil</strong>.
                            </p>
                        )}
                        {error.includes("Key") && (
                            <p style={{ fontSize: 12, opacity: 0.7, color: "var(--text-muted)" }}>
                                Tip: Si usas una clave de desarrollo, recuerda que caducan cada 24 horas.
                            </p>
                        )}
                    </div>
                )}

                {data && data.stats && !loading && selected && (
                    <>
                        {data.mock && (
                            <div
                                style={{
                                    background: "rgba(245,158,11,0.1)",
                                    border: "1px solid rgba(245,158,11,0.3)",
                                    borderRadius: 8,
                                    padding: "10px 16px",
                                    marginBottom: 16,
                                    fontSize: 13,
                                    color: "var(--val-yellow)",
                                }}
                            >
                                ⚠️ Datos de demostración. Configura RIOT_API_KEY
                                para datos reales.
                            </div>
                        )}

                        {/* Tarjeta de Perfil y Rango */}
                        <div
                            className="card glass-card animate-in"
                            style={{
                                marginBottom: 24,
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                className="hero-gradient"
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    opacity: 0.5,
                                }}
                            ></div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 24,
                                    position: "relative",
                                    zIndex: 1,
                                }}
                            >
                                <div
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: "24px",
                                        background: `linear-gradient(135deg, ${selected.avatar_color}, #000)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 32,
                                        color: "#fff",
                                        fontWeight: 900,
                                        boxShadow: `0 10px 20px ${selected.avatar_color}44`,
                                        border: `2px solid ${selected.avatar_color}`,
                                    }}
                                >
                                    {(selected.riot_name || selected.name)[0]}
                                </div>
                                <div>
                                    <h3
                                        className="gradient-text"
                                        style={{
                                            fontSize: 28,
                                            fontWeight: 800,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {selected.riot_name ? `${selected.riot_name}#${selected.riot_tag}` : selected.name}
                                    </h3>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: "4px 12px",
                                                borderRadius: "20px",
                                                background:
                                                    "rgba(255,255,255,0.05)",
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                                border: "1px solid var(--border-color)",
                                            }}
                                        >
                                            {data.mmr
                                                ? data.mmr.currenttierpatched
                                                : "Sin Rango"}
                                        </div>
                                        
                                        {/* Selector de Temporada */}
                                        {seasons.length > 0 && (
                                            <div style={{ marginLeft: 4 }}>
                                                <select
                                                    value={selectedSeason}
                                                    onChange={(e) => handleSeasonChange(e.target.value)}
                                                    style={{
                                                        background: "rgba(255,255,255,0.03)",
                                                        border: "1px solid var(--border-color)",
                                                        borderRadius: "20px",
                                                        color: "var(--text-primary)",
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        padding: "4px 12px",
                                                        cursor: "pointer",
                                                        outline: "none"
                                                    }}
                                                >
                                                    <option value="all" style={{ background: "#0c0d12" }}>📅 Historial de por vida</option>
                                                    {seasons.map(s => (
                                                        <option key={s.id} value={s.id} style={{ background: "#0c0d12" }}>
                                                            🛡️ {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {data.mmr && (
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    color: "var(--text-secondary)",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {data.mmr.ranking_in_tier} RR
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {data.mmr && (
                                    <div
                                        style={{
                                            marginLeft: "auto",
                                            textAlign: "right",
                                        }}
                                    >
                                        <div
                                            className="stat-value"
                                            style={{
                                                fontSize: 24,
                                                color:
                                                    (data.mmr
                                                        ?.mmr_change_to_last_game ??
                                                        0) >= 0
                                                        ? "var(--val-cyan)"
                                                        : "var(--val-red)",
                                                background: "none",
                                                WebkitTextFillColor: "initial",
                                            }}
                                        >
                                            {(data.mmr
                                                ?.mmr_change_to_last_game ??
                                                0) >= 0
                                                ? "+"
                                                : ""}
                                            {data.mmr?.mmr_change_to_last_game}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--text-muted)",
                                                textTransform: "uppercase",
                                                letterSpacing: 1,
                                            }}
                                        >
                                            Última Partida
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selector de Tipo de Partido */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                marginBottom: 20,
                                borderBottom: "1px solid var(--border-color)",
                                paddingBottom: 12
                            }}
                        >
                            {[
                                { id: "competitive", label: "🏆 Competitivo", exists: !!data.stats.competitive },
                                { id: "premier", label: "⚔️ Premier", exists: !!data.stats.premier },
                                { id: "standard", label: "🎮 Standard (Unrated)", exists: !!data.stats.standard },
                                { id: "others", label: "🎲 Otros Modos", exists: !!data.stats.others },
                                { id: "deathmatch", label: "💀 Deathmatch", exists: !!data.stats.deathmatch }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`btn ${activeTab === tab.id ? "btn-primary" : "btn-secondary"}`}
                                    onClick={() => setActiveTab(tab.id as "competitive" | "premier" | "standard" | "others" | "deathmatch")}
                                    style={{
                                        opacity: tab.exists ? 1 : 0.4,
                                        cursor: tab.exists ? "pointer" : "not-allowed",
                                        pointerEvents: tab.exists ? "auto" : "none",
                                        fontSize: 13,
                                        padding: "6px 14px",
                                        borderRadius: "20px"
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {(() => {
                            const stats = data.stats[activeTab];
                            if (!stats || stats.gamesPlayed === 0) {
                                return (
                                    <div
                                        className="card glass-card"
                                        style={{
                                            textAlign: "center",
                                            padding: "60px 40px",
                                            color: "var(--text-muted)",
                                            borderRadius: 16
                                        }}
                                    >
                                        <p style={{ fontSize: 48, marginBottom: 16 }}>📊</p>
                                        <h4 style={{ color: "var(--text-primary)", marginBottom: 8, fontSize: 18 }}>
                                            Sin partidas registradas
                                        </h4>
                                        <p style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
                                            No hay partidas de este tipo en el historial reciente (últimas 10 partidas sincronizadas).
                                        </p>
                                    </div>
                                );
                            }

                            // Filtrar historial de partidas por el tipo activo
                            const filteredMatches = data.matches.filter(m => {
                                const mode = (m.metadata.mode || '').toLowerCase();
                                const isDM = mode.includes('deathmatch') || mode.includes('tdm') || mode.includes('escalation');
                                if (activeTab === "deathmatch") return isDM;
                                if (activeTab === "competitive") return mode === 'competitive';
                                if (activeTab === "premier") return mode === 'premier';
                                if (activeTab === "standard") return mode === 'unrated';
                                // others (round-based others)
                                return !isDM && mode !== 'competitive' && mode !== 'premier' && mode !== 'unrated';
                            });

                            return (
                                <>
                                    {/* Estadísticas Clave */}
                                    {activeTab === "deathmatch" ? (
                                        <div
                                            className="grid grid-3 animate-in"
                                            style={{ marginBottom: 24 }}
                                        >
                                            {[
                                                {
                                                    label: "K/D Ratio",
                                                    value: (stats as DeathmatchStats).kdRatio || "0.0",
                                                    color: "var(--val-red)",
                                                },
                                                {
                                                    label: "Avg Kills",
                                                    value: (stats as DeathmatchStats).avgKills || 0,
                                                    color: "var(--val-cyan)",
                                                },
                                                {
                                                    label: "Avg Deaths",
                                                    value: (stats as DeathmatchStats).avgDeaths || 0,
                                                    color: "var(--val-purple)",
                                                },
                                            ].map((s) => (
                                                <div
                                                    key={s.label}
                                                    className="card glass-card stat-card hover-lift"
                                                    style={
                                                        {
                                                            textAlign: "center",
                                                            "--glow-color": s.color,
                                                        } as React.CSSProperties
                                                    }
                                                >
                                                    <div
                                                        className="stat-value"
                                                        style={{ fontSize: 32 }}
                                                    >
                                                        {s.value}
                                                    </div>
                                                    <div
                                                        className="stat-label"
                                                        style={{ fontWeight: 600 }}
                                                    >
                                                        {s.label}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            className="grid grid-4 animate-in"
                                            style={{ marginBottom: 24 }}
                                        >
                                            {[
                                                {
                                                    label: "K/D Ratio",
                                                    value: (stats as ModeStats).kdRatio || "0.0",
                                                    color: "var(--val-red)",
                                                },
                                                {
                                                    label: "Win Rate",
                                                    value: `${(stats as ModeStats).winRate || 0}%`,
                                                    color: "var(--val-cyan)",
                                                },
                                                {
                                                    label: "Avg Score",
                                                    value: (stats as ModeStats).avgACS || 0,
                                                    color: "var(--val-purple)",
                                                },
                                                {
                                                    label: "HS Percentage",
                                                    value: `${(stats as ModeStats).headshotPct || 0}%`,
                                                    color: "var(--val-yellow)",
                                                },
                                            ].map((s) => (
                                                <div
                                                    key={s.label}
                                                    className="card glass-card stat-card hover-lift"
                                                    style={
                                                        {
                                                            textAlign: "center",
                                                            "--glow-color": s.color,
                                                        } as React.CSSProperties
                                                    }
                                                >
                                                    <div
                                                        className="stat-value"
                                                        style={{ fontSize: 32 }}
                                                    >
                                                        {s.value}
                                                    </div>
                                                    <div
                                                        className="stat-label"
                                                        style={{ fontWeight: 600 }}
                                                    >
                                                        {s.label}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div
                                        className="grid grid-2 animate-in"
                                        style={{ marginBottom: 24, animationDelay: "0.2s" }}
                                    >
                                        {/* Resumen */}
                                        <div className="card glass-card">
                                            <div className="card-header">
                                                <h4 className="card-title">
                                                    Resumen de Temporada
                                                </h4>
                                                <div
                                                    className="nav-badge"
                                                    style={{
                                                        background: "rgba(255,255,255,0.1)",
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {stats.gamesPlayed || 0} Games
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr 1fr",
                                                    gap: 16,
                                                    fontSize: 14,
                                                }}
                                            >
                                                {activeTab === "deathmatch" ? (
                                                    <>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Total Kills</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as DeathmatchStats).totalKills}</div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Total Deaths</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as DeathmatchStats).totalDeaths}</div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Avg Kills</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as DeathmatchStats).avgKills}</div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Avg Deaths</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as DeathmatchStats).avgDeaths}</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>W/L Ratio</span>
                                                            <div style={{ fontWeight: 700 }}>
                                                                <span style={{ color: "var(--val-cyan)" }}>{(stats as ModeStats).wins || 0}W</span>{" "}
                                                                /{" "}
                                                                <span style={{ color: "var(--val-red)" }}>{(stats as ModeStats).losses || 0}L</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>Avg Kills</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as ModeStats).avgKills || 0}</div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>KDA Ratio</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as ModeStats).kdaRatio || 0}</div>
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>ADR</span>
                                                            <div style={{ fontWeight: 700 }}>{(stats as ModeStats).avgADR || 0}</div>
                                                        </div>
                                                    </>
                                                )}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 4,
                                                        gridColumn: "span 2",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            color: "var(--text-muted)",
                                                            fontSize: 11,
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        Top Agente
                                                    </span>
                                                    <div
                                                        style={{
                                                            fontWeight: 700,
                                                            color: "var(--val-red)",
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        {stats.mostPlayedAgent || "N/A"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Agentes & Forma Reciente */}
                                        <div className="card glass-card">
                                            {activeTab !== "deathmatch" && (
                                                <>
                                                    <div className="card-header">
                                                        <h4 className="card-title">Rendimiento Reciente</h4>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                                                        {(stats as ModeStats).recentForm?.map((f, i) => (
                                                            <span
                                                                key={i}
                                                                className={`form-indicator form-${f.toLowerCase()}`}
                                                                style={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    fontSize: 12,
                                                                    fontWeight: 800,
                                                                    borderRadius: "8px",
                                                                    boxShadow:
                                                                        f === "W"
                                                                            ? "0 0 10px rgba(0, 212, 170, 0.2)"
                                                                            : "0 0 10px rgba(255, 70, 85, 0.2)",
                                                                }}
                                                            >
                                                                {f}
                                                            </span>
                                                        )) || (
                                                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Sin datos</span>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            <h4
                                                className="card-title"
                                                style={{
                                                    marginBottom: 12,
                                                    fontSize: 13,
                                                    opacity: 0.8,
                                                }}
                                            >
                                                Top 3 Agentes
                                            </h4>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 8,
                                                }}
                                            >
                                                {(Object.values(stats.agentStats || {}) as Array<{ agent: string; games: number; winRate?: number; avgKills?: number }>)
                                                    .sort((a, b) => b.games - a.games)
                                                    .slice(0, 3)
                                                    .map((a) => (
                                                        <div
                                                            key={a.agent}
                                                            className="hover-row"
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                fontSize: 13,
                                                                padding: "10px 12px",
                                                                background: "rgba(255,255,255,0.02)",
                                                                borderRadius: "8px",
                                                                border: "1px solid var(--border-color)",
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 600 }}>{a.agent}</span>
                                                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                                                    {a.games} games
                                                                </span>
                                                                {activeTab === "deathmatch" ? (
                                                                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                                        {a.avgKills} Avg Kills
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        style={{
                                                                            color:
                                                                                (a.winRate || 0) >= 50
                                                                                    ? "var(--val-cyan)"
                                                                                    : "var(--val-red)",
                                                                            fontWeight: 700,
                                                                        }}
                                                                    >
                                                                        {a.winRate || 0}% WR
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Historial de Partidas */}
                                    <div
                                        className="card glass-card animate-in"
                                        style={{ animationDelay: "0.3s" }}
                                    >
                                        <div className="card-header">
                                            <h4 className="card-title">
                                                Historial de Partidas
                                            </h4>
                                        </div>
                                        {filteredMatches.length === 0 ? (
                                            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                                                Sin partidas de este tipo registradas en tu historial reciente.
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table
                                                    style={{
                                                        width: "100%",
                                                        borderCollapse: "separate",
                                                        borderSpacing: "0 8px",
                                                    }}
                                                >
                                                    <thead>
                                                        <tr
                                                            style={{
                                                                color: "var(--text-muted)",
                                                                textTransform: "uppercase",
                                                                fontSize: 11,
                                                                letterSpacing: 1,
                                                            }}
                                                        >
                                                            <th style={{ padding: "8px 16px", textAlign: "left" }}>
                                                                Resultado
                                                            </th>
                                                            <th style={{ padding: "8px 16px", textAlign: "left" }}>
                                                                Mapa
                                                            </th>
                                                            <th style={{ padding: "8px 16px", textAlign: "left" }}>
                                                                Agente
                                                            </th>
                                                            <th style={{ padding: "8px 16px", textAlign: "center" }}>
                                                                KDA
                                                            </th>
                                                            <th style={{ padding: "8px 16px", textAlign: "center" }}>
                                                                {activeTab === "deathmatch" ? "K/D" : "ACS"}
                                                            </th>
                                                            <th style={{ padding: "8px 16px", textAlign: "right" }}>
                                                                Fecha
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredMatches.map((m, i) => {
                                                            const me =
                                                                m.players.all_players.find(
                                                                    (p) =>
                                                                        p.name.toLowerCase() ===
                                                                            (
                                                                                selected.riot_name ||
                                                                                selected.name
                                                                            ).toLowerCase() &&
                                                                        p.tag.toLowerCase() ===
                                                                            (
                                                                                selected.riot_tag ||
                                                                                "EUW"
                                                                            ).toLowerCase(),
                                                                ) ||
                                                                m.players.all_players.find(
                                                                    (p) =>
                                                                        p.name.toLowerCase() ===
                                                                        (
                                                                            selected.riot_name ||
                                                                            selected.name
                                                                        ).toLowerCase(),
                                                                ) ||
                                                                m.players.all_players[0];

                                                            if (!me) return null;
                                                            const team =
                                                                (me.team?.toLowerCase() || "red") as
                                                                    | "red"
                                                                    | "blue";
                                                            const won = m.teams?.[team]?.has_won || false;
                                                            const rw =
                                                                m.teams?.[team]?.rounds_won || 0;
                                                            const rl =
                                                                m.teams?.[team]?.rounds_lost || 0;
                                                            const acs =
                                                                m.metadata.rounds_played > 0
                                                                    ? Math.round(
                                                                          me.stats.score /
                                                                              m.metadata
                                                                                  .rounds_played,
                                                                      )
                                                                    : 0;
                                                            return (
                                                                <tr
                                                                    key={i}
                                                                    className="hover-row"
                                                                    style={{
                                                                        background:
                                                                            "rgba(255,255,255,0.03)",
                                                                        transition:
                                                                            "var(--transition)",
                                                                    }}
                                                                >
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                            borderRadius:
                                                                                "8px 0 0 8px",
                                                                            borderLeft: `4px solid ${activeTab === "deathmatch" ? "var(--val-red)" : (won ? "var(--val-cyan)" : "var(--val-red)")}`,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap: 12,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                className={`form-indicator ${activeTab === "deathmatch" ? "form-l" : (won ? "form-w" : "form-l")}`}
                                                                                style={{
                                                                                    width: 24,
                                                                                    height: 24,
                                                                                    fontSize: 10,
                                                                                    background: activeTab === "deathmatch" ? "var(--val-red)" : undefined,
                                                                                    borderColor: activeTab === "deathmatch" ? "var(--val-red)" : undefined,
                                                                                }}
                                                                            >
                                                                                {activeTab === "deathmatch"
                                                                                    ? "DM"
                                                                                    : (won ? "W" : "L")}
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    fontFamily:
                                                                                        "var(--font-valorant)",
                                                                                    fontWeight: 700,
                                                                                    fontSize: 14,
                                                                                }}
                                                                            >
                                                                                {activeTab === "deathmatch"
                                                                                    ? `${me.stats.kills} K`
                                                                                    : `${rw}-${rl}`}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                            fontWeight: 500,
                                                                        }}
                                                                    >
                                                                        {m.metadata.map}
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap: 8,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                {me.character}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                            textAlign: "center",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                justifyContent:
                                                                                    "center",
                                                                                gap: 4,
                                                                                fontFamily:
                                                                                    "var(--font-valorant)",
                                                                                fontSize: 13,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    color: "var(--val-cyan)",
                                                                                }}
                                                                            >
                                                                                {me.stats.kills}
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    opacity: 0.3,
                                                                                }}
                                                                            >
                                                                                /
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    color: "var(--val-red)",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    me.stats
                                                                                        .deaths
                                                                                }
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    opacity: 0.3,
                                                                                }}
                                                                            >
                                                                                /
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    color: "var(--text-secondary)",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    me.stats
                                                                                        .assists
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                            textAlign: "center",
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                fontWeight: 800,
                                                                                color:
                                                                                    activeTab === "deathmatch"
                                                                                        ? (Number(me.stats.kills / (me.stats.deaths || 1)) >= 1.0 ? "var(--val-cyan)" : "var(--val-red)")
                                                                                        : (acs >= 250 ? "var(--val-yellow)" : "inherit"),
                                                                            }}
                                                                        >
                                                                            {activeTab === "deathmatch"
                                                                                ? (me.stats.kills / (me.stats.deaths || 1)).toFixed(2)
                                                                                : acs}
                                                                        </span>
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding:
                                                                                "12px 16px",
                                                                            textAlign: "right",
                                                                            borderRadius:
                                                                                "0 8px 8px 0",
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                color: "var(--text-muted)",
                                                                                fontSize: 12,
                                                                            }}
                                                                        >
                                                                            {new Date(
                                                                                m.metadata
                                                                                    .game_start_patched,
                                                                            ).toLocaleDateString(
                                                                                "es-ES",
                                                                                {
                                                                                    day: "numeric",
                                                                                    month: "short",
                                                                                },
                                                                            )}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </>
                )}
            </div>
        </>
    );
}
